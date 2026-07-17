import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { HuggyClient, HuggyRequestError } from '../satisfaction/huggy.client';
import {
  formatInspectionDateTime,
  tomorrowWindow,
} from './inspection-reminder-time';

const JOB_NAME = 'inspection-reminder-daily';
const RETRY_MINUTES = [1, 5, 30];

@Injectable()
export class InspectionReminderScheduler
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(InspectionReminderScheduler.name);
  private workerInterval?: NodeJS.Timeout;
  private processing = false;

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly config: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly huggyClient: HuggyClient,
  ) {}

  onModuleInit() {
    if (this.config.get<string>('INSPECTION_REMINDER_ENABLED') !== 'true') {
      this.logger.log('Lembretes de vistoria desativados');
      return;
    }

    const expression =
      this.config.get<string>('INSPECTION_REMINDER_CRON')?.trim() ||
      '0 0 9 * * *';
    const timeZone = this.timeZone;
    const job = CronJob.from({
      cronTime: expression,
      onTick: () => void this.runDaily(),
      start: false,
      timeZone,
      waitForCompletion: true,
    });
    this.schedulerRegistry.addCronJob(JOB_NAME, job);
    job.start();

    this.workerInterval = setInterval(() => void this.processDue(), 60_000);
    this.workerInterval.unref();
    setTimeout(() => void this.processDue(), 1_000).unref();

    this.logger.log(
      `Lembretes de vistoria agendados (${expression}, ${timeZone})`,
    );
  }

  onModuleDestroy() {
    if (this.workerInterval) clearInterval(this.workerInterval);
    if (this.schedulerRegistry.doesExist('cron', JOB_NAME)) {
      this.schedulerRegistry.deleteCronJob(JOB_NAME);
    }
  }

  async runDaily(now = new Date()) {
    try {
      const queued = await this.enqueueTomorrow(now);
      this.logger.log(`${queued} lembrete(s) de vistoria enfileirado(s)`);
      await this.processDue();
    } catch (error) {
      this.logger.error(
        `Falha no cron de lembretes: ${(error as Error).message}`,
      );
    }
  }

  async enqueueTomorrow(now = new Date()) {
    const admin = this.supabaseService.getAdmin();
    const window = tomorrowWindow(now, this.timeZone);
    const { data, error } = await admin
      .from('tb_inspections')
      .select(
        `
        id,
        datetime,
        status,
        tb_clients!inner (phone)
      `,
      )
      .eq('status', 'AGUARDANDO')
      .gte('datetime', window.start)
      .lt('datetime', window.end);

    if (error) throw new Error(error.message);

    const rows = (data ?? [])
      .filter((inspection: any) => {
        const client = this.unwrap(inspection.tb_clients);
        return String(client?.phone ?? '').trim().length > 0;
      })
      .map((inspection: any) => ({
        idinspection: inspection.id,
        inspection_date: window.dateKey,
        next_attempt_at: now.toISOString(),
      }));

    if (rows.length === 0) return 0;

    const { error: insertError } = await admin
      .from('tb_inspection_reminder_notifications')
      .upsert(rows, {
        onConflict: 'idinspection,inspection_date',
        ignoreDuplicates: true,
      });
    if (insertError) throw new Error(insertError.message);
    return rows.length;
  }

  async processDue() {
    if (this.processing) return;
    this.processing = true;
    try {
      const admin = this.supabaseService.getAdmin();
      const { data, error } = await admin.rpc(
        'claim_inspection_reminder_notifications',
        { p_limit: 10 },
      );
      if (error) {
        this.logger.error(`Falha ao buscar lembretes: ${error.message}`);
        return;
      }

      for (const notification of data ?? []) {
        await this.processNotification(notification as any);
      }
    } finally {
      this.processing = false;
    }
  }

  private async processNotification(notification: any) {
    const admin = this.supabaseService.getAdmin();
    const { data: inspection, error } = await admin
      .from('tb_inspections')
      .select(
        `
        id,
        datetime,
        status,
        tb_clients!inner (name, unit, phone)
      `,
      )
      .eq('id', notification.idinspection)
      .maybeSingle();

    if (error || !inspection) {
      await this.cancel(
        notification.id,
        error?.message ?? 'Vistoria nao encontrada',
      );
      return;
    }

    const context = formatInspectionDateTime(
      (inspection as any).datetime,
      this.timeZone,
    );
    const expected = tomorrowWindow(new Date(), this.timeZone).dateKey;
    if (
      (inspection as any).status !== 'AGUARDANDO' ||
      context.dateKey !== notification.inspection_date ||
      context.dateKey !== expected
    ) {
      await this.cancel(
        notification.id,
        'Vistoria nao esta mais agendada para amanha',
      );
      return;
    }

    const client = this.unwrap((inspection as any).tb_clients);
    if (!String(client?.phone ?? '').trim()) {
      await this.cancel(notification.id, 'Cliente sem telefone cadastrado');
      return;
    }

    try {
      const result = await this.huggyClient.sendInspectionReminder({
        clientName: client?.name ?? 'Cliente',
        unit: client?.unit ?? '',
        phone: client.phone,
        inspectionDate: context.date,
        inspectionTime: context.time,
      });
      const timestamp = new Date().toISOString();
      await admin
        .from('tb_inspection_reminder_notifications')
        .update({
          status: 'SENT',
          sent_at: timestamp,
          updated_at: timestamp,
          last_error: null,
          huggy_contact_id: result.contactId,
          huggy_chat_id: result.chatId,
          huggy_message_id: result.messageId,
        })
        .eq('id', notification.id);
    } catch (error) {
      const huggyError =
        error instanceof HuggyRequestError
          ? error
          : new HuggyRequestError((error as Error).message, true);
      await this.fail(notification, huggyError.message, huggyError.transient);
    }
  }

  private async cancel(id: number, reason: string) {
    await this.supabaseService
      .getAdmin()
      .from('tb_inspection_reminder_notifications')
      .update({
        status: 'CANCELED',
        last_error: reason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
  }

  private async fail(notification: any, message: string, transient: boolean) {
    const attempts = Number(notification.attempts ?? 1);
    const canRetry = transient && attempts < 4;
    const delay = RETRY_MINUTES[Math.min(attempts - 1, 2)];
    const nextAttempt = new Date(Date.now() + delay * 60_000).toISOString();

    await this.supabaseService
      .getAdmin()
      .from('tb_inspection_reminder_notifications')
      .update({
        status: canRetry ? 'PENDING' : 'FAILED',
        next_attempt_at: canRetry ? nextAttempt : notification.next_attempt_at,
        last_error: message.slice(0, 2000),
        updated_at: new Date().toISOString(),
      })
      .eq('id', notification.id);

    this.logger.warn(
      `Lembrete ${notification.id} falhou (${attempts}): ${message}`,
    );
  }

  private get timeZone() {
    return (
      this.config.get<string>('INSPECTION_REMINDER_TIMEZONE')?.trim() ||
      'America/Sao_Paulo'
    );
  }

  private unwrap(value: any) {
    return Array.isArray(value) ? value[0] : value;
  }
}

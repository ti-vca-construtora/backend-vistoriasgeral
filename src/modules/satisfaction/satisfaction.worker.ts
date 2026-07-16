import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { HuggyClient, HuggyRequestError } from './huggy.client';

const RETRY_MINUTES = [1, 5, 30];

@Injectable()
export class SatisfactionWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SatisfactionWorker.name);
  private interval?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly config: ConfigService,
    private readonly huggyClient: HuggyClient,
  ) {}

  onModuleInit() {
    const enabled = this.config.get<string>('SATISFACTION_WORKER_ENABLED');
    if (enabled === 'false') return;

    this.interval = setInterval(() => void this.processDue(), 60_000);
    this.interval.unref();
    setTimeout(() => void this.processDue(), 1_000).unref();
  }

  onModuleDestroy() {
    if (this.interval) clearInterval(this.interval);
  }

  async processDue() {
    if (this.running) return;
    this.running = true;
    try {
      const admin = this.supabaseService.getAdmin();
      const { data, error } = await admin.rpc(
        'claim_satisfaction_notifications',
        { p_limit: 10 },
      );
      if (error) {
        this.logger.error(`Falha ao buscar notificacoes: ${error.message}`);
        return;
      }

      for (const notification of data ?? []) {
        await this.processNotification(notification as any);
      }
    } finally {
      this.running = false;
    }
  }

  private async processNotification(notification: any) {
    const admin = this.supabaseService.getAdmin();
    const { data: survey, error } = await admin
      .from('tb_satisfaction_surveys')
      .select(
        `
        id,
        public_token,
        status,
        tb_inspections!inner (
          datetime,
          tb_clients!inner (name, unit, phone)
        )
      `,
      )
      .eq('id', notification.idsurvey)
      .maybeSingle();

    if (error || !survey) {
      await this.fail(
        notification,
        error?.message ?? 'Pesquisa nao encontrada',
        false,
      );
      return;
    }

    if (survey.status === 'ANSWERED') {
      await admin
        .from('tb_satisfaction_notifications')
        .update({ status: 'CANCELED', updated_at: new Date().toISOString() })
        .eq('id', notification.id);
      return;
    }

    const inspection = this.unwrap((survey as any).tb_inspections);
    const client = this.unwrap(inspection?.tb_clients);
    const surveyPath = `pesquisa/${survey.public_token}`;
    const publicBase = (
      this.config.get<string>('PUBLIC_SURVEY_BASE_URL') ||
      'http://localhost:3010'
    ).replace(/\/$/, '');

    try {
      const result = await this.huggyClient.sendSurveyMessage({
        kind: notification.kind,
        clientName: client?.name ?? 'Cliente',
        unit: client?.unit ?? '',
        phone: client?.phone ?? '',
        inspectionDate: new Date(inspection.datetime).toLocaleDateString(
          'pt-BR',
          {
            timeZone: 'America/Sao_Paulo',
          },
        ),
        surveyPath,
        surveyUrl: `${publicBase}/${surveyPath}`,
      });
      const now = new Date().toISOString();
      await admin
        .from('tb_satisfaction_notifications')
        .update({
          status: 'SENT',
          sent_at: now,
          updated_at: now,
          last_error: null,
          huggy_contact_id: result.contactId,
          huggy_chat_id: result.chatId,
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

  private async fail(notification: any, message: string, transient: boolean) {
    const admin = this.supabaseService.getAdmin();
    const attempts = Number(notification.attempts ?? 1);
    const canRetry = transient && attempts < 4;
    const delayMinutes = RETRY_MINUTES[Math.min(attempts - 1, 2)];
    const nextAttempt = new Date(
      Date.now() + delayMinutes * 60_000,
    ).toISOString();

    await admin
      .from('tb_satisfaction_notifications')
      .update({
        status: canRetry ? 'PENDING' : 'FAILED',
        next_attempt_at: canRetry ? nextAttempt : notification.next_attempt_at,
        last_error: message.slice(0, 2000),
        updated_at: new Date().toISOString(),
      })
      .eq('id', notification.id);

    this.logger.warn(
      `Notificacao ${notification.id} falhou (${attempts}): ${message}`,
    );
  }

  private unwrap(value: any) {
    return Array.isArray(value) ? value[0] : value;
  }
}

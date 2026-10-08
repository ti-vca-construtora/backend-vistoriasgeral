import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { HuggyClient } from '../satisfaction/huggy.client';
import { InspectionReminderScheduler } from './inspection-reminder.scheduler';

describe('InspectionReminderScheduler', () => {
  it.each([
    ['same day', '2026-10-08T20:00:00.000Z', '2026-10-08'],
    ['next day', '2026-10-09T20:00:00.000Z', '2026-10-09'],
  ])('queues and processes a %s booking immediately', async (_, datetime, dateKey) => {
    const notificationTable = {
      upsert: jest.fn().mockResolvedValue({ error: null }),
    };
    const service = new InspectionReminderScheduler(
      { getAdmin: () => ({ from: () => notificationTable }) } as any,
      {
        get: (key: string) =>
          key === 'INSPECTION_REMINDER_ENABLED'
            ? 'true'
            : 'America/Sao_Paulo',
      } as any,
      {} as SchedulerRegistry,
      {} as HuggyClient,
    );
    const processDue = jest.spyOn(service, 'processDue').mockResolvedValue();
    const now = new Date('2026-10-08T15:00:00.000Z');

    await service.enqueueOnScheduling(
      { id: 22, datetime, status: 'AGUARDANDO' },
      '5577981243447',
      now,
    );

    expect(notificationTable.upsert).toHaveBeenCalledWith(
      {
        idinspection: 22,
        inspection_date: dateKey,
        next_attempt_at: now.toISOString(),
      },
      { onConflict: 'idinspection,inspection_date', ignoreDuplicates: true },
    );
    expect(processDue).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['distant booking', '2026-10-10T20:00:00.000Z', '5577981243447'],
    ['missing phone', '2026-10-09T20:00:00.000Z', null],
    ['past booking', '2026-10-08T14:00:00.000Z', '5577981243447'],
  ])('does not queue a %s', async (_, datetime, phone) => {
    const notificationTable = {
      upsert: jest.fn().mockResolvedValue({ error: null }),
    };
    const service = new InspectionReminderScheduler(
      { getAdmin: () => ({ from: () => notificationTable }) } as any,
      {
        get: (key: string) =>
          key === 'INSPECTION_REMINDER_ENABLED'
            ? 'true'
            : 'America/Sao_Paulo',
      } as any,
      {} as SchedulerRegistry,
      {} as HuggyClient,
    );
    const processDue = jest.spyOn(service, 'processDue').mockResolvedValue();

    await service.enqueueOnScheduling(
      { id: 22, datetime, status: 'AGUARDANDO' },
      phone,
      new Date('2026-10-08T15:00:00.000Z'),
    );

    expect(notificationTable.upsert).not.toHaveBeenCalled();
    expect(processDue).not.toHaveBeenCalled();
  });

  it('queues only next-day inspections whose clients have a phone', async () => {
    const inspectionQuery: any = {};
    inspectionQuery.select = jest.fn(() => inspectionQuery);
    inspectionQuery.eq = jest.fn(() => inspectionQuery);
    inspectionQuery.gte = jest.fn(() => inspectionQuery);
    inspectionQuery.lt = jest.fn().mockResolvedValue({
      data: [
        {
          id: 10,
          datetime: '2026-07-18T13:00:00.000Z',
          status: 'AGUARDANDO',
          tb_clients: { phone: '5577981243447' },
        },
        {
          id: 11,
          datetime: '2026-07-18T14:00:00.000Z',
          status: 'AGUARDANDO',
          tb_clients: [{ phone: null }],
        },
      ],
      error: null,
    });
    const notificationTable = {
      upsert: jest.fn().mockResolvedValue({ error: null }),
    };
    const admin = {
      from: jest.fn((table: string) =>
        table === 'tb_inspections' ? inspectionQuery : notificationTable,
      ),
    };
    const supabase = {
      getAdmin: jest.fn(() => admin),
    } as unknown as SupabaseService;
    const config = {
      get: jest.fn((key: string) =>
        key === 'INSPECTION_REMINDER_TIMEZONE'
          ? 'America/Sao_Paulo'
          : undefined,
      ),
    } as unknown as ConfigService;
    const service = new InspectionReminderScheduler(
      supabase,
      config,
      {} as SchedulerRegistry,
      {} as HuggyClient,
    );

    await expect(
      service.enqueueTomorrow(new Date('2026-07-17T15:00:00.000Z')),
    ).resolves.toBe(1);
    expect(inspectionQuery.eq).toHaveBeenCalledWith('status', 'AGUARDANDO');
    expect(inspectionQuery.gte).toHaveBeenCalledWith(
      'datetime',
      '2026-07-18T03:00:00.000Z',
    );
    expect(inspectionQuery.lt).toHaveBeenCalledWith(
      'datetime',
      '2026-07-19T03:00:00.000Z',
    );
    expect(notificationTable.upsert).toHaveBeenCalledWith(
      [
        {
          idinspection: 10,
          inspection_date: '2026-07-18',
          next_attempt_at: '2026-07-17T15:00:00.000Z',
        },
      ],
      {
        onConflict: 'idinspection,inspection_date',
        ignoreDuplicates: true,
      },
    );
  });
});

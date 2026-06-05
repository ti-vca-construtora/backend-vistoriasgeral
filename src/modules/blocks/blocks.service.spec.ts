import { BadRequestException } from '@nestjs/common';
import { UserRole } from '../../infra/auth/auth-user';
import { BlocksService } from './blocks.service';

class QueryMock {
  constructor(private readonly result: unknown) {}

  select() {
    return this;
  }

  eq() {
    return this;
  }

  gte() {
    return this;
  }

  lt() {
    return this;
  }

  in() {
    return this;
  }

  order() {
    return this;
  }

  insert() {
    return this;
  }

  maybeSingle() {
    return Promise.resolve(this.result);
  }

  then(resolve: (value: unknown) => void) {
    return Promise.resolve(this.result).then(resolve);
  }
}

const makeService = (results: unknown[]) => {
  const queue = [...results];
  const admin = {
    from: jest.fn(() => new QueryMock(queue.shift())),
  };

  const service = new BlocksService({
    getAdmin: () => admin,
  } as any);

  return { service, admin };
};

describe('BlocksService', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  const adminUser = {
    id: 'admin-id',
    email: 'admin@email.com',
    name: 'Admin',
    role: UserRole.ADMIN,
    enterpriseIds: [],
    enterprises: [],
  };

  it('rejects overlapping blocks for the same enterprise and date', async () => {
    const { service } = makeService([
      { data: { id: 1 }, error: null },
      {
        data: [
          {
            id: 10,
            start_time: '09:00',
            end_time: '10:00',
          },
        ],
        error: null,
      },
    ]);

    await expect(
      service.create(
        {
          identerprise: 1,
          date: '2030-01-20',
          startTime: '09:30',
          endTime: '10:30',
        },
        adminUser,
      ),
    ).rejects.toThrow('Ja existe bloqueio para parte deste intervalo');
  });

  it('creates individual 30-minute blocks from times', async () => {
    const { service } = makeService([
      { data: { id: 1 }, error: null },
      { data: [], error: null },
      { data: [], error: null },
      {
        data: [
          { id: 1, start_time: '09:00', end_time: '09:30' },
          { id: 2, start_time: '14:30', end_time: '15:00' },
        ],
        error: null,
      },
    ]);

    await expect(
      service.create(
        {
          identerprise: 1,
          date: '2030-01-20',
          times: ['09:00', '14:30'],
        },
        adminUser,
      ),
    ).resolves.toHaveLength(2);
  });

  it('rejects blocking an interval with an existing inspection', async () => {
    const { service } = makeService([
      { data: { id: 1 }, error: null },
      { data: [], error: null },
      {
        data: [
          {
            id: 99,
            datetime: '2030-01-20T12:00:00.000Z',
          },
        ],
        error: null,
      },
    ]);

    await expect(
      service.create(
        {
          identerprise: 1,
          date: '2030-01-20',
          startTime: '09:00',
          endTime: '10:00',
        },
        adminUser,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects blocks with a start time earlier than the current Brazil time', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-05T14:48:00.000Z'));

    const { service } = makeService([
      { data: { id: 1 }, error: null },
    ]);

    await expect(
      service.create(
        {
          identerprise: 1,
          date: '2026-06-05',
          startTime: '09:00',
          endTime: '09:30',
        },
        adminUser,
      ),
    ).rejects.toThrow('Nao e permitido criar bloqueio em horario passado');
  });

  it('allows blocks later than the current Brazil time on the same date', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-05T14:48:00.000Z'));

    const { service } = makeService([
      { data: { id: 1 }, error: null },
      { data: [], error: null },
      { data: [], error: null },
      {
        data: [
          { id: 1, start_time: '12:00', end_time: '12:30' },
        ],
        error: null,
      },
    ]);

    await expect(
      service.create(
        {
          identerprise: 1,
          date: '2026-06-05',
          startTime: '12:00',
          endTime: '12:30',
        },
        adminUser,
      ),
    ).resolves.toHaveLength(1);
  });
});

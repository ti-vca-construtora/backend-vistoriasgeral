import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { UserRole } from '../../infra/auth/auth-user';
import { InspectionsService } from './inspections.service';

class QueryMock {
  constructor(private readonly result: unknown) {}

  select() {
    return this;
  }

  eq() {
    return this;
  }

  in() {
    return this;
  }

  limit() {
    return this;
  }

  insert() {
    return this;
  }

  gte() {
    return this;
  }

  lt() {
    return this;
  }

  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return Promise.resolve(this.result).then(onfulfilled, onrejected);
  }

  single() {
    return Promise.resolve(this.result);
  }

  maybeSingle() {
    return Promise.resolve(this.result);
  }
}

const makeService = (results: unknown[]) => {
  const queue = [...results];
  const admin = {
    from: jest.fn(() => new QueryMock(queue.shift())),
  };

  const service = new InspectionsService({
    getAdmin: () => admin,
  } as any);

  return { service, admin };
};

describe('InspectionsService', () => {
  const user = {
    id: 'user-id',
    email: 'user@email.com',
    name: 'User',
    role: UserRole.USER,
    enterpriseIds: [1],
    enterprises: [{ id: 1, name: 'Obra 1' }],
  };

  it('rejects scheduling when the user has no access to the client enterprise', async () => {
    const { service } = makeService([
      { data: { id: 10, identerprise: 99 }, error: null },
    ]);

    await expect(
      service.create(
        {
          idclient: 10,
          datetime: '2030-01-20T12:00:00.000Z',
        },
        user,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects scheduling when the selected time is blocked for the enterprise', async () => {
    const { service } = makeService([
      { data: { id: 10, identerprise: 1 }, error: null },
      {
        data: [
          {
            id: 1,
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
          idclient: 10,
          datetime: '2030-01-20T12:00:00.000Z',
        },
        user,
      ),
    ).rejects.toThrow('Horario bloqueado para este empreendimento');
  });

  it('schedules directly when there is no block for the enterprise time', async () => {
    const { service, admin } = makeService([
      { data: { id: 10, identerprise: 1 }, error: null },
      { data: [], error: null },
      { data: { status: 'LIBERADA' }, error: null },
      { data: [], error: null },
      {
        data: {
          id: 99,
          idclient: 10,
          datetime: '2030-01-20T12:00:00.000Z',
          status: 'AGUARDANDO',
        },
        error: null,
      },
    ]);

    await expect(
      service.create(
        {
          idclient: 10,
          datetime: '2030-01-20T12:00:00.000Z',
        },
        user,
      ),
    ).resolves.toMatchObject({ id: 99 });

    expect(admin.from).not.toHaveBeenCalledWith('tb_inspection_slots');
  });

  it('allows scheduling with a past date when the enterprise time is not blocked', async () => {
    const { service } = makeService([
      { data: { id: 10, identerprise: 1 }, error: null },
      { data: [], error: null },
      { data: { status: 'LIBERADA' }, error: null },
      { data: [], error: null },
      {
        data: {
          id: 100,
          idclient: 10,
          datetime: '2020-01-20T12:00:00.000Z',
          status: 'AGUARDANDO',
        },
        error: null,
      },
    ]);

    await expect(
      service.create(
        {
          idclient: 10,
          datetime: '2020-01-20T12:00:00.000Z',
        },
        user,
      ),
    ).resolves.toMatchObject({ id: 100 });
  });
});


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

  it('rejects scheduling when there is no active slot for the date', async () => {
    const { service } = makeService([
      { data: { id: 10, identerprise: 1 }, error: null },
      { data: null, error: null },
    ]);

    await expect(
      service.create(
        {
          idclient: 10,
          datetime: '2030-01-20T12:00:00.000Z',
        },
        user,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});


import { BadRequestException } from '@nestjs/common';
import { SlotsService } from './slots.service';

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

  const service = new SlotsService({
    getAdmin: () => admin,
  } as any);

  return { service, admin };
};

describe('SlotsService', () => {
  it('rejects creating a slot in the past', async () => {
    const { service } = makeService([]);

    await expect(
      service.create({ identerprise: 1, date: '2020-01-01' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects blocking a time that already has an inspection', async () => {
    const { service } = makeService([
      { data: { id: 1 }, error: null },
      { data: [], error: null },
      { data: [{ id: 10, datetime: '2030-01-20T12:00:00.000Z' }], error: null },
    ]);

    await expect(
      service.createBlocks(1, { times: ['09:00'] }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});


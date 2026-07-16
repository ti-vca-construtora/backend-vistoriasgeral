import { TimelineEventType } from './dto/timeline-event.dto';
import { TimelineService } from './timeline.service';

class QueryMock {
  constructor(private readonly result: unknown) {}
  select() {
    return this;
  }
  eq() {
    return this;
  }
  order() {
    return this;
  }
  single() {
    return Promise.resolve(this.result);
  }
  then(resolve: (value: unknown) => void) {
    return Promise.resolve(this.result).then(resolve);
  }
}

describe('TimelineService', () => {
  it('inclui o aceite mesmo sem updated_at e usa datetime como fallback', async () => {
    const results = [
      {
        data: {
          id: 7,
          name: 'Cliente',
          unit: 'A-01',
          created_at: '2026-01-01T10:00:00Z',
        },
        error: null,
      },
      { data: null, error: null },
      {
        data: [
          {
            id: 20,
            datetime: '2026-02-10T13:00:00Z',
            inspector: 'Vistoriador',
            status: 'ACEITE',
            created_at: '2026-02-01T10:00:00Z',
            updated_at: null,
            obs: 'Tudo certo',
            tb_rejections: [],
          },
        ],
        error: null,
      },
    ];
    const admin = { from: jest.fn(() => new QueryMock(results.shift())) };
    const service = new TimelineService({ getAdmin: () => admin } as any);

    const timeline = await service.getClientTimeline(7);
    const accepted = timeline.events.find(
      (event) => event.type === TimelineEventType.INSPECTION_APPROVED,
    );

    expect(accepted).toMatchObject({
      date: '2026-02-10T13:00:00Z',
      description: 'Vistoria aceita',
      metadata: {
        datetime: '2026-02-10T13:00:00Z',
        status: 'ACEITE',
        inspector: 'Vistoriador',
        obs: 'Tudo certo',
      },
    });
  });
});

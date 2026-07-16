import {
  calculateSatisfactionMetrics,
  SatisfactionMetricRow,
} from './satisfaction-metrics';

const answered = (score: number, rating: number): SatisfactionMetricRow => ({
  status: 'ANSWERED',
  recommendation_score: score,
  service_rating: rating,
  broker_rating: rating,
  inspector_rating: rating,
  common_areas_rating: rating,
  unit_quality_rating: rating,
});

describe('calculateSatisfactionMetrics', () => {
  it('calcula NPS classico, taxa de resposta e medias', () => {
    const result = calculateSatisfactionMetrics([
      answered(10, 4),
      answered(8, 3),
      answered(5, 2),
      { ...answered(0, 1), status: 'PENDING', recommendation_score: null },
    ]);

    expect(result).toMatchObject({
      invitations: 4,
      answered: 3,
      pending: 1,
      responseRate: 75,
      nps: 0,
      promoters: 1,
      passives: 1,
      detractors: 1,
    });
    expect(result.averages.service).toBe(3);
  });

  it('retorna indicadores neutros quando nao ha pesquisas', () => {
    expect(calculateSatisfactionMetrics([])).toEqual({
      invitations: 0,
      answered: 0,
      pending: 0,
      responseRate: 0,
      nps: null,
      promoters: 0,
      passives: 0,
      detractors: 0,
      averages: {
        service: null,
        broker: null,
        inspector: null,
        commonAreas: null,
        unitQuality: null,
      },
    });
  });
});

export type SatisfactionMetricRow = {
  status: string;
  recommendation_score: number | null;
  service_rating: number | null;
  broker_rating: number | null;
  inspector_rating: number | null;
  common_areas_rating: number | null;
  unit_quality_rating: number | null;
};

export const calculateSatisfactionMetrics = (rows: SatisfactionMetricRow[]) => {
  const answered = rows.filter((row) => row.status === 'ANSWERED');
  const scores = answered.map((row) => Number(row.recommendation_score));
  const promoters = scores.filter((score) => score >= 9).length;
  const passives = scores.filter((score) => score >= 7 && score <= 8).length;
  const detractors = scores.filter((score) => score <= 6).length;
  const average = (field: keyof SatisfactionMetricRow) => {
    if (answered.length === 0) return null;
    const total = answered.reduce(
      (sum, row) => sum + Number(row[field] ?? 0),
      0,
    );
    return Math.round((total / answered.length) * 100) / 100;
  };

  return {
    invitations: rows.length,
    answered: answered.length,
    pending: rows.length - answered.length,
    responseRate:
      rows.length === 0
        ? 0
        : Math.round((answered.length / rows.length) * 1000) / 10,
    nps:
      answered.length === 0
        ? null
        : Math.round(((promoters - detractors) / answered.length) * 100),
    promoters,
    passives,
    detractors,
    averages: {
      service: average('service_rating'),
      broker: average('broker_rating'),
      inspector: average('inspector_rating'),
      commonAreas: average('common_areas_rating'),
      unitQuality: average('unit_quality_rating'),
    },
  };
};

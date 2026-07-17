import {
  dateKeyInTimeZone,
  formatInspectionDateTime,
  tomorrowWindow,
} from './inspection-reminder-time';

describe('inspection reminder time helpers', () => {
  const timeZone = 'America/Sao_Paulo';

  it('builds the next-day UTC window from the Sao Paulo calendar', () => {
    expect(
      tomorrowWindow(new Date('2026-07-17T15:00:00.000Z'), timeZone),
    ).toEqual({
      dateKey: '2026-07-18',
      start: '2026-07-18T03:00:00.000Z',
      end: '2026-07-19T03:00:00.000Z',
    });
  });

  it('formats the inspection date and time in Sao Paulo', () => {
    expect(
      formatInspectionDateTime('2026-07-18T13:00:00.000Z', timeZone),
    ).toEqual({
      dateKey: '2026-07-18',
      date: '18/07/2026',
      time: '10:00',
    });
    expect(
      dateKeyInTimeZone(new Date('2026-07-18T02:30:00.000Z'), timeZone),
    ).toBe('2026-07-17');
  });
});

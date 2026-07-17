type DateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function partsInTimeZone(date: Date, timeZone: string): DateParts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);

  return {
    year: value('year'),
    month: value('month'),
    day: value('day'),
    hour: value('hour'),
    minute: value('minute'),
    second: value('second'),
  };
}

function dateKeyFromParts(parts: Pick<DateParts, 'year' | 'month' | 'day'>) {
  return `${parts.year.toString().padStart(4, '0')}-${parts.month
    .toString()
    .padStart(2, '0')}-${parts.day.toString().padStart(2, '0')}`;
}

function addDays(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days, 12));
  return date.toISOString().slice(0, 10);
}

function timeZoneOffsetMs(date: Date, timeZone: string) {
  const parts = partsInTimeZone(date, timeZone);
  const representedAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return representedAsUtc - date.getTime();
}

function localMidnightAsUtc(dateKey: string, timeZone: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const localAsUtc = Date.UTC(year, month - 1, day);
  let candidate = new Date(localAsUtc);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    candidate = new Date(localAsUtc - timeZoneOffsetMs(candidate, timeZone));
  }

  return candidate;
}

export function dateKeyInTimeZone(date: Date, timeZone: string) {
  return dateKeyFromParts(partsInTimeZone(date, timeZone));
}

export function tomorrowWindow(now: Date, timeZone: string) {
  const today = dateKeyInTimeZone(now, timeZone);
  const dateKey = addDays(today, 1);
  const followingDateKey = addDays(dateKey, 1);

  return {
    dateKey,
    start: localMidnightAsUtc(dateKey, timeZone).toISOString(),
    end: localMidnightAsUtc(followingDateKey, timeZone).toISOString(),
  };
}

export function formatInspectionDateTime(value: string, timeZone: string) {
  const date = new Date(value);
  return {
    dateKey: dateKeyInTimeZone(date, timeZone),
    date: new Intl.DateTimeFormat('pt-BR', {
      timeZone,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date),
    time: new Intl.DateTimeFormat('pt-BR', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date),
  };
}

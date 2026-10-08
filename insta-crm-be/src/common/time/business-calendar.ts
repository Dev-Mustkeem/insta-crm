export const DEFAULT_BUSINESS_TIME_ZONE = "Asia/Kolkata";

interface CalendarParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export function safeBusinessTimeZone(value: string): string {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return value;
  } catch {
    return DEFAULT_BUSINESS_TIME_ZONE;
  }
}

export function startOfBusinessMonth(now: Date, timeZone: string): Date {
  const zone = safeBusinessTimeZone(timeZone);
  const local = partsInZone(now, zone);
  return wallTimeToUtc(local.year, local.month, 1, zone);
}

export function startOfBusinessWeek(now: Date, timeZone: string): Date {
  const zone = safeBusinessTimeZone(timeZone);
  const local = partsInZone(now, zone);
  const localDate = new Date(Date.UTC(local.year, local.month - 1, local.day));
  const daysSinceMonday = (localDate.getUTCDay() + 6) % 7;
  localDate.setUTCDate(localDate.getUTCDate() - daysSinceMonday);
  return wallTimeToUtc(
    localDate.getUTCFullYear(),
    localDate.getUTCMonth() + 1,
    localDate.getUTCDate(),
    zone,
  );
}

function wallTimeToUtc(
  year: number,
  month: number,
  day: number,
  timeZone: string,
): Date {
  const target = Date.UTC(year, month - 1, day, 0, 0, 0);
  let guess = target;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const rendered = partsInZone(new Date(guess), timeZone);
    const renderedTimestamp = Date.UTC(
      rendered.year,
      rendered.month - 1,
      rendered.day,
      rendered.hour,
      rendered.minute,
      rendered.second,
    );
    guess += target - renderedTimestamp;
  }
  return new Date(guess);
}

function partsInZone(date: Date, timeZone: string): CalendarParts {
  const values = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(values.find((item) => item.type === type)?.value ?? 0);
  return {
    year: part("year"),
    month: part("month"),
    day: part("day"),
    hour: part("hour"),
    minute: part("minute"),
    second: part("second"),
  };
}

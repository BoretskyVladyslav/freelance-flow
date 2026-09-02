export function parseIsoDate(value: string): Date {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid ISO date: ${value}`);
  }
  return parsed;
}

export function getIsoWeek(date: Date): number {
  const tmp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  return Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export function getIsoWeekYear(date: Date): number {
  const tmp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
  return tmp.getUTCFullYear();
}

export function isoWeekFromIsoDate(isoDate: string): number {
  return getIsoWeek(parseIsoDate(isoDate));
}

export function weekKeyFromIsoDate(isoDate: string): string {
  const date = parseIsoDate(isoDate);
  const week = String(getIsoWeek(date)).padStart(2, "0");
  return `${getIsoWeekYear(date)}-W${week}`;
}

export function monthKeyFromIsoDate(isoDate: string): string {
  const date = parseIsoDate(isoDate);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${date.getFullYear()}-${month}`;
}

export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

const WEEK_KEY_PATTERN = /^(\d{4})-W(\d{2})$/;

function toIsoDateUtc(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function isoWeekRange(weekKey: string): { start: string; end: string } {
  const match = WEEK_KEY_PATTERN.exec(weekKey);
  if (!match) {
    throw new Error(`Invalid ISO week key: ${weekKey}`);
  }
  const year = Number(match[1]);
  const week = Number(match[2]);
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - (jan4Day - 1) + (week - 1) * 7);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return { start: toIsoDateUtc(monday), end: toIsoDateUtc(sunday) };
}

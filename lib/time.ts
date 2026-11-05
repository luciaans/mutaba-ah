const APP_TIME_ZONE = process.env.NEXT_PUBLIC_APP_TIMEZONE ?? "Asia/Pontianak";

export type PrayerName = "subuh" | "zuhur" | "asar" | "magrib" | "isya";

export function dateInTimeZone(date: Date, timeZone = APP_TIME_ZONE): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function todayInAppTimeZone(now = new Date()): string {
  return dateInTimeZone(now);
}

export function prayerForTime(now = new Date()): PrayerName {
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: APP_TIME_ZONE, hour: "2-digit", hourCycle: "h23" }).format(now));
  if (hour >= 4 && hour < 11) return "subuh";
  if (hour >= 11 && hour < 15) return "zuhur";
  if (hour >= 15 && hour < 18) return "asar";
  if (hour >= 18 && hour < 20) return "magrib";
  return "isya";
}

export function formatDateId(date: string | Date, options: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long", year: "numeric" }): string {
  const value = typeof date === "string" ? new Date(`${date}T12:00:00+07:00`) : date;
  return new Intl.DateTimeFormat("id-ID", { ...options, timeZone: APP_TIME_ZONE }).format(value);
}

export function formatTimeId(timestamp: string): string {
  return new Intl.DateTimeFormat("id-ID", { timeZone: APP_TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(timestamp));
}

export function weekRangeInAppTimeZone(date: string, weekStart: "monday" | "saturday" = "monday"): { start: string; end: string } {
  const [year, month, day] = date.split("-").map(Number);
  const local = new Date(Date.UTC(year, month - 1, day));
  const weekday = local.getUTCDay();
  const offset = weekStart === "monday" ? (weekday + 6) % 7 : (weekday + 1) % 7;
  local.setUTCDate(local.getUTCDate() - offset);
  const start = local.toISOString().slice(0, 10);
  local.setUTCDate(local.getUTCDate() + 6);
  return { start, end: local.toISOString().slice(0, 10) };
}

export function monthRangeInAppTimeZone(date: string): { start: string; end: string } {
  const [year, month] = date.split("-").map(Number);
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { start: `${year}-${String(month).padStart(2, "0")}-01`, end: `${year}-${String(month).padStart(2, "0")}-${String(days).padStart(2, "0")}` };
}

export function shiftIsoDate(date: string, offsetDays: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1, day + offsetDays));
  return value.toISOString().slice(0, 10);
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function plural(n: number, unit: string) {
  return `${n} ${unit}${n === 1 ? "" : "s"} ago`;
}

export function timeAgo(value: string | Date, now: Date = new Date()): string {
  const then = value instanceof Date ? value : new Date(value);
  const diff = now.getTime() - then.getTime();
  if (Number.isNaN(diff)) return "";
  if (diff < 45_000) return "just now";
  if (diff < HOUR) return plural(Math.max(1, Math.floor(diff / MINUTE)), "minute");
  if (diff < DAY) return plural(Math.floor(diff / HOUR), "hour");
  if (diff < 30 * DAY) return plural(Math.floor(diff / DAY), "day");
  if (diff < 365 * DAY) return plural(Math.floor(diff / (30 * DAY)), "month");
  return plural(Math.floor(diff / (365 * DAY)), "year");
}

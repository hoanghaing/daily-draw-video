const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** The Vietnam calendar day of an instant, as YYYY-MM-DD (UTC+7, no daylight saving). */
export function todayKey(now: Date): string {
  return new Date(Math.floor((now.getTime() + VN_OFFSET_MS) / DAY_MS) * DAY_MS).toISOString().slice(0, 10);
}

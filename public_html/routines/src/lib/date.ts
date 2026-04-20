export function nowKST(): Date {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" })
  );
}

export function todayKST(): Date {
  const now = nowKST();
  now.setHours(0, 0, 0, 0);
  return now;
}

export function yesterdayKST(): Date {
  const d = todayKST();
  d.setDate(d.getDate() - 1);
  return d;
}

export function isSameDateKST(a: Date, b: Date): boolean {
  const aKST = new Date(a.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  const bKST = new Date(b.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  return (
    aKST.getFullYear() === bKST.getFullYear() &&
    aKST.getMonth() === bKST.getMonth() &&
    aKST.getDate() === bKST.getDate()
  );
}

export function formatDateKST(date: Date): string {
  return new Date(date.toLocaleString("en-US", { timeZone: "Asia/Seoul" }))
    .toISOString()
    .split("T")[0];
}

/**
 * Today's KST calendar date as UTC midnight. This is the correct form
 * for comparing against MySQL `@db.Date` columns because MySQL strips
 * the time component and only matches on date portion. Use this for
 * DB writes and equality comparisons on Content.publishedAt.
 *
 * Note the difference from `todayKST()`, which returns KST local
 * midnight (offset -9 from UTC). Streak code uses `todayKST()`; Content
 * date matching uses this.
 */
export function todayKSTDate(): Date {
  const kstDateStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
  return new Date(kstDateStr);
}

/**
 * Same form as `todayKSTDate()` but for tomorrow. Used by the
 * generation cron/endpoint as the default target date.
 */
export function tomorrowKSTDate(): Date {
  const d = todayKSTDate();
  d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

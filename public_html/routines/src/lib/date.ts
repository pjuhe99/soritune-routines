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

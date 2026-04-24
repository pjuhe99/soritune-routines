export const CATEGORIES = ["웰빙", "교육", "자기개발", "환경", "일상"] as const;
export type Category = (typeof CATEGORIES)[number];

export function isCategory(value: unknown): value is Category {
  return typeof value === "string" && (CATEGORIES as readonly string[]).includes(value);
}

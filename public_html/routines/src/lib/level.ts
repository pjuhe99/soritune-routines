export const LEVELS = ["beginner", "intermediate", "advanced"] as const;
export type Level = (typeof LEVELS)[number];

export const DEFAULT_LEVEL: Level = "intermediate";

export const LEVEL_LABELS: Record<Level, string> = {
  beginner: "초급",
  intermediate: "중급",
  advanced: "고급",
};

export const LEVEL_DESCRIPTIONS: Record<Level, string> = {
  beginner: "쉬운 단어, 많은 주석",
  intermediate: "자연스러운 영어",
  advanced: "원어민 수준",
};

export const LEVEL_STORAGE_KEY = "routines_level";

export function isLevel(value: unknown): value is Level {
  return typeof value === "string" && (LEVELS as readonly string[]).includes(value);
}

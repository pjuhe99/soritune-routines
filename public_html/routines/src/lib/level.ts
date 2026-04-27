export const LEVELS = ["beginner", "intermediate", "advanced"] as const;
export type Level = (typeof LEVELS)[number];

export const LEVEL_LABELS: Record<Level, string> = {
  beginner: "초급",
  intermediate: "중급",
  advanced: "고급",
};

export function parseLevel(value: unknown): Level | null {
  if (typeof value !== "string") return null;
  return (LEVELS as readonly string[]).includes(value) ? (value as Level) : null;
}

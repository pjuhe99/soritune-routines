import type { LearningStep, ContentLevel } from "@prisma/client";
import { prisma } from "./prisma";

export const STEP_ORDER: readonly LearningStep[] = [
  "reading",
  "listening",
  "expressions",
  "quiz",
  "interview",
  "speaking",
] as const;

export type StepState = { completed: boolean; skipped: boolean };
export type ProgressMap = Record<LearningStep, StepState>;

interface ProgressRow {
  step: LearningStep;
  completed: boolean;
  skipped: boolean;
}

const EMPTY_STATE: StepState = { completed: false, skipped: false };

export function progressRowsToMap(rows: ProgressRow[]): ProgressMap {
  const map = Object.fromEntries(
    STEP_ORDER.map((s) => [s, { ...EMPTY_STATE }]),
  ) as ProgressMap;
  for (const row of rows) {
    map[row.step] = { completed: row.completed, skipped: row.skipped };
  }
  return map;
}

export function pickNextStep(map: ProgressMap): LearningStep | "complete" {
  for (const step of STEP_ORDER) {
    const s = map[step];
    if (!s.completed && !s.skipped) return step;
  }
  return "complete";
}

export function isStepDone(state: StepState): boolean {
  return state.completed || state.skipped;
}

// ───────────── Prisma-backed helpers ─────────────

export async function progressMapForLevel(
  userId: string,
  contentId: number,
  level: ContentLevel,
): Promise<ProgressMap> {
  const rows = await prisma.userProgress.findMany({
    where: { userId, contentId, level },
    select: { step: true, completed: true, skipped: true },
  });
  return progressRowsToMap(rows);
}

export async function nextStepForLevel(
  userId: string,
  contentId: number,
  level: ContentLevel,
): Promise<LearningStep | "complete"> {
  const map = await progressMapForLevel(userId, contentId, level);
  return pickNextStep(map);
}

export interface LevelSummary {
  nextStep: LearningStep | "complete";
  completedCount: number;
}

export async function progressSummaryByLevel(
  userId: string,
  contentId: number,
): Promise<Record<ContentLevel, LevelSummary>> {
  const rows = await prisma.userProgress.findMany({
    where: { userId, contentId },
    select: { level: true, step: true, completed: true, skipped: true },
  });
  const byLevel: Record<ContentLevel, ProgressRow[]> = {
    beginner: [],
    intermediate: [],
    advanced: [],
  };
  for (const r of rows) {
    byLevel[r.level].push(r);
  }
  const result = {} as Record<ContentLevel, LevelSummary>;
  for (const lvl of Object.keys(byLevel) as ContentLevel[]) {
    const map = progressRowsToMap(byLevel[lvl]);
    result[lvl] = {
      nextStep: pickNextStep(map),
      completedCount: STEP_ORDER.filter((s) => isStepDone(map[s])).length,
    };
  }
  return result;
}

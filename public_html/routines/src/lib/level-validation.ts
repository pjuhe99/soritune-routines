import type { Level } from "./generation-prompts";

interface Range {
  hardMin: number;
  hardMax: number;
  tolMin: number;
  tolMax: number;
}

const LEVEL_RANGES: Record<Level, Range> = {
  beginner: { hardMin: 5, hardMax: 9, tolMin: 3, tolMax: 10 },
  intermediate: { hardMin: 10, hardMax: 16, tolMin: 9, tolMax: 18 },
  advanced: { hardMin: 14, hardMax: 22, tolMin: 12, tolMax: 25 },
};

export const ADVANCED_FORBIDDEN = [
  "seismic",
  "relentless",
  "unprecedented",
  "landscape of",
  "in the wake of",
  "burgeoning",
  "ubiquitous",
  "paradigm",
  "quintessential",
  "ostensibly",
];

const SOFT_FAIL_RATIO = 0.3;
const HARD_OUTLIER_WORDS = 2;

export interface ValidationResult {
  ok: boolean;         // true if can be saved (hardFail never overrides this)
  hardFail: boolean;   // true if a retry should be triggered
  warnings: string[];  // non-blocking issues to log
  reasons: string[];   // human-readable fail reasons (for generation_logs)
}

export function countWords(text: string): number {
  const tokens = text.trim().split(/\s+/).filter((t) => /[A-Za-z0-9]/.test(t));
  return tokens.length;
}

export function splitSentences(paragraph: string): string[] {
  return paragraph
    .trim()
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function validateLevelRules(
  paragraphs: string[],
  level: Level
): ValidationResult {
  const range = LEVEL_RANGES[level];
  const result: ValidationResult = { ok: true, hardFail: false, warnings: [], reasons: [] };

  const allSentences = paragraphs.flatMap(splitSentences);
  if (allSentences.length === 0) {
    return { ok: false, hardFail: true, warnings: [], reasons: ["no sentences parsed"] };
  }

  let violations = 0;
  let anyFarOutlier = false;

  for (const sentence of allSentences) {
    const words = countWords(sentence);
    const inTolerance = words >= range.tolMin && words <= range.tolMax;
    if (!inTolerance) {
      violations++;
      const distance =
        words < range.tolMin ? range.tolMin - words : words - range.tolMax;
      if (distance > HARD_OUTLIER_WORDS) anyFarOutlier = true;
    }
  }

  const violationRatio = violations / allSentences.length;

  if (anyFarOutlier) {
    result.ok = false;
    result.hardFail = true;
    result.reasons.push(
      `sentence more than ${HARD_OUTLIER_WORDS} words outside tolerance (${range.tolMin}-${range.tolMax})`
    );
  } else if (violationRatio > SOFT_FAIL_RATIO) {
    result.ok = false;
    result.hardFail = true;
    result.reasons.push(
      `${violations}/${allSentences.length} sentences outside tolerance (>${Math.round(SOFT_FAIL_RATIO * 100)}%)`
    );
  } else if (violations > 0) {
    result.warnings.push(
      `${violations}/${allSentences.length} sentences outside ${range.hardMin}-${range.hardMax} range`
    );
  }

  if (level === "advanced") {
    const haystack = paragraphs.join(" ").toLowerCase();
    for (const term of ADVANCED_FORBIDDEN) {
      if (haystack.includes(term.toLowerCase())) {
        result.ok = false;
        result.hardFail = true;
        result.reasons.push(`forbidden advanced-register term: "${term}"`);
      }
    }
  }

  return result;
}

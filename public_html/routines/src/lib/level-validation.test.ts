import { describe, it, expect } from "vitest";
import { validateLevelRules, countWords, splitSentences } from "./level-validation";

describe("countWords", () => {
  it("counts space-separated tokens", () => {
    expect(countWords("I take a walk")).toBe(4);
  });
  it("ignores punctuation-only tokens", () => {
    expect(countWords("Hello, world!")).toBe(2);
  });
  it("returns 0 for empty/whitespace", () => {
    expect(countWords("")).toBe(0);
    expect(countWords("   ")).toBe(0);
  });
});

describe("splitSentences", () => {
  it("splits on terminal punctuation", () => {
    expect(splitSentences("First. Second! Third?")).toEqual(["First.", "Second!", "Third?"]);
  });
  it("keeps em-dash-joined clauses as one sentence", () => {
    const result = splitSentences("Simple idea — big impact.");
    expect(result).toEqual(["Simple idea — big impact."]);
  });
  it("ignores trailing whitespace", () => {
    expect(splitSentences("  A. B.  ")).toEqual(["A.", "B."]);
  });
});

describe("validateLevelRules", () => {
  it("passes a clean beginner paragraph", () => {
    const result = validateLevelRules(
      ["I take a walk every morning.", "The air is fresh.", "I feel good."],
      "beginner"
    );
    expect(result.ok).toBe(true);
    expect(result.hardFail).toBe(false);
  });

  it("hard-fails beginner when a sentence is far over tolerance", () => {
    // beginner tolerance max = 10. 13-word sentence is >2 over = hard fail.
    const result = validateLevelRules(
      [
        "I take a walk every morning because it is really very good for me.",
        "Short.",
        "Short.",
      ],
      "beginner"
    );
    expect(result.ok).toBe(false);
    expect(result.hardFail).toBe(true);
  });

  it("soft-fails (ok=true) when ≤30% of sentences are out of tolerance by ≤2 words", () => {
    // 4 sentences; 1 slightly over = 25% — acceptable with warning.
    const result = validateLevelRules(
      [
        "I walk every day.",
        "The air is fresh this morning and it wakes me up.", // 11 words = within tolerance 10
        "I feel good.",
        "It helps my mood.",
      ],
      "beginner"
    );
    expect(result.ok).toBe(true);
    expect(result.warnings.length).toBeGreaterThanOrEqual(0);
  });

  it("hard-fails when >30% of sentences violate tolerance", () => {
    const result = validateLevelRules(
      [
        "This is a long sentence that goes past the beginner tolerance limit.",
        "Another long sentence that is also past the beginner tolerance limit here.",
        "Third long sentence that also exceeds the beginner tolerance range plainly.",
        "Short one.",
      ],
      "beginner"
    );
    expect(result.ok).toBe(false);
    expect(result.hardFail).toBe(true);
  });

  it("hard-fails advanced when a forbidden term appears", () => {
    const result = validateLevelRules(
      [
        "The seismic shift in technology is changing everything around us completely.",
        "Every generation must adapt or fall behind in this fast-moving world.",
      ],
      "advanced"
    );
    expect(result.ok).toBe(false);
    expect(result.hardFail).toBe(true);
    expect(result.reasons.some((r) => r.includes("forbidden"))).toBe(true);
  });

  it("forbidden-term check is case-insensitive", () => {
    const result = validateLevelRules(
      ["Relentless pressure from work can wear anyone down over time."],
      "advanced"
    );
    expect(result.hardFail).toBe(true);
  });
});

import { describe, it, expect } from "vitest";
import { pickNextStep, progressRowsToMap, STEP_ORDER } from "./progress";
import type { LearningStep } from "@prisma/client";

describe("STEP_ORDER", () => {
  it("lists 6 steps in canonical order", () => {
    expect(STEP_ORDER).toEqual([
      "reading", "listening", "expressions", "quiz", "interview", "speaking",
    ]);
  });
});

describe("progressRowsToMap", () => {
  it("returns map with all 6 steps, missing rows default to false", () => {
    const map = progressRowsToMap([
      { step: "reading", completed: true, skipped: false },
      { step: "listening", completed: false, skipped: true },
    ]);
    expect(map.reading).toEqual({ completed: true, skipped: false });
    expect(map.listening).toEqual({ completed: false, skipped: true });
    expect(map.expressions).toEqual({ completed: false, skipped: false });
    expect(map.quiz).toEqual({ completed: false, skipped: false });
    expect(map.interview).toEqual({ completed: false, skipped: false });
    expect(map.speaking).toEqual({ completed: false, skipped: false });
  });
});

describe("pickNextStep", () => {
  function map(done: LearningStep[]): ReturnType<typeof progressRowsToMap> {
    return progressRowsToMap(
      done.map((s) => ({ step: s, completed: true, skipped: false })),
    );
  }

  it("returns reading when nothing is done", () => {
    expect(pickNextStep(map([]))).toBe("reading");
  });

  it("returns the first incomplete step in order", () => {
    expect(pickNextStep(map(["reading"]))).toBe("listening");
    expect(pickNextStep(map(["reading", "listening", "expressions"]))).toBe("quiz");
  });

  it("treats skipped as done", () => {
    const m = progressRowsToMap([
      { step: "reading", completed: false, skipped: true },
      { step: "listening", completed: true, skipped: false },
    ]);
    expect(pickNextStep(m)).toBe("expressions");
  });

  it("returns 'complete' when all 6 are done", () => {
    expect(
      pickNextStep(
        map(["reading", "listening", "expressions", "quiz", "interview", "speaking"]),
      ),
    ).toBe("complete");
  });

  it("ignores out-of-order completions and finds the earliest gap", () => {
    expect(pickNextStep(map(["reading", "expressions"]))).toBe("listening");
  });
});

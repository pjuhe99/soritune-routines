import { describe, it, expect } from "vitest";
import { parseLevel, LEVELS, LEVEL_LABELS } from "./level";

describe("parseLevel", () => {
  it("returns the value if it is a known level", () => {
    expect(parseLevel("beginner")).toBe("beginner");
    expect(parseLevel("intermediate")).toBe("intermediate");
    expect(parseLevel("advanced")).toBe("advanced");
  });

  it("returns null for unknown strings", () => {
    expect(parseLevel("expert")).toBeNull();
    expect(parseLevel("")).toBeNull();
    expect(parseLevel("BEGINNER")).toBeNull();
  });

  it("returns null for non-string inputs", () => {
    expect(parseLevel(null)).toBeNull();
    expect(parseLevel(undefined)).toBeNull();
    expect(parseLevel(123)).toBeNull();
    expect(parseLevel({})).toBeNull();
  });
});

describe("LEVELS / LEVEL_LABELS", () => {
  it("has 3 levels in beginner→advanced order", () => {
    expect(LEVELS).toEqual(["beginner", "intermediate", "advanced"]);
  });

  it("has Korean label per level", () => {
    expect(LEVEL_LABELS.beginner).toBe("초급");
    expect(LEVEL_LABELS.intermediate).toBe("중급");
    expect(LEVEL_LABELS.advanced).toBe("고급");
  });
});

import { describe, it, expect } from "vitest";
import { CATEGORIES, isCategory, type Category } from "./categories";

describe("categories module", () => {
  it("exports exactly 5 categories in rotation order", () => {
    expect(CATEGORIES).toEqual(["웰빙", "교육", "자기개발", "환경", "일상"]);
  });

  it("isCategory accepts all known categories", () => {
    for (const c of CATEGORIES) {
      expect(isCategory(c)).toBe(true);
    }
  });

  it("isCategory rejects unknown values", () => {
    expect(isCategory("Daily Life")).toBe(false);
    expect(isCategory("")).toBe(false);
    expect(isCategory(null)).toBe(false);
    expect(isCategory(undefined)).toBe(false);
    expect(isCategory(123)).toBe(false);
  });

  it("Category type is a narrowed union", () => {
    const c: Category = "웰빙";
    expect(CATEGORIES).toContain(c);
  });
});

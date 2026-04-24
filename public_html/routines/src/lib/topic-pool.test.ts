import { describe, it, expect } from "vitest";
import { nextCategoryAfter } from "./topic-pool";

describe("nextCategoryAfter", () => {
  it("starts at 웰빙 when last is null", () => {
    expect(nextCategoryAfter(null)).toBe("웰빙");
  });

  it("wraps after 일상 back to 웰빙", () => {
    expect(nextCategoryAfter("일상")).toBe("웰빙");
  });

  it("advances through the full cycle", () => {
    expect(nextCategoryAfter("웰빙")).toBe("교육");
    expect(nextCategoryAfter("교육")).toBe("자기개발");
    expect(nextCategoryAfter("자기개발")).toBe("환경");
    expect(nextCategoryAfter("환경")).toBe("일상");
  });

  it("starts at 웰빙 for unknown inputs (defensive)", () => {
    expect(nextCategoryAfter("UnknownGenre")).toBe("웰빙");
  });
});

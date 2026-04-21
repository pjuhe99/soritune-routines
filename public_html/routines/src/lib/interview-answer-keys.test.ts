import { describe, it, expect } from "vitest";
import { buildInterviewAnswerUniqueKey } from "./interview-answer-keys";

describe("buildInterviewAnswerUniqueKey", () => {
  it("returns Prisma composite key object", () => {
    const key = buildInterviewAnswerUniqueKey({
      userId: "u1",
      contentId: 42,
      level: "beginner",
      questionIndex: 0,
    });
    expect(key).toEqual({
      userId_contentId_level_questionIndex: {
        userId: "u1",
        contentId: 42,
        level: "beginner",
        questionIndex: 0,
      },
    });
  });
  it("preserves all four fields", () => {
    const key = buildInterviewAnswerUniqueKey({
      userId: "u2",
      contentId: 7,
      level: "advanced",
      questionIndex: 3,
    });
    const inner = key.userId_contentId_level_questionIndex;
    expect(Object.keys(inner).sort()).toEqual(
      ["contentId", "level", "questionIndex", "userId"]
    );
  });
});

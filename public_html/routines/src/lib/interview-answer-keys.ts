import type { ContentLevel } from "@prisma/client";

export interface InterviewAnswerKey {
  userId: string;
  contentId: number;
  level: ContentLevel;
  questionIndex: number;
}

export function buildInterviewAnswerUniqueKey(k: InterviewAnswerKey) {
  return {
    userId_contentId_level_questionIndex: {
      userId: k.userId,
      contentId: k.contentId,
      level: k.level,
      questionIndex: k.questionIndex,
    },
  };
}

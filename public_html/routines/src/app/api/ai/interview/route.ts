import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { getInterviewFeedback } from "@/lib/ai-service";
import { buildInterviewAnswerUniqueKey } from "@/lib/interview-answer-keys";
import { Prisma } from "@prisma/client";
import type { ContentLevel } from "@prisma/client";

const VALID_LEVELS: readonly ContentLevel[] = ["beginner", "intermediate", "advanced"] as const;

export async function POST(req: NextRequest) {
  const { userId } = await requireUser();

  try {
    const body = await req.json() as {
      contentId?: number;
      questionIndex?: number;
      question?: string;
      answer?: string;
      level?: ContentLevel;
    };
    const { contentId, questionIndex, question, answer, level } = body;

    if (
      typeof contentId !== "number" ||
      typeof questionIndex !== "number" ||
      typeof question !== "string" ||
      typeof answer !== "string" ||
      typeof level !== "string" ||
      !VALID_LEVELS.includes(level)
    ) {
      return NextResponse.json(
        { error: "Missing or invalid fields" },
        { status: 400 }
      );
    }

    const content = await prisma.content.findUnique({
      where: { id: contentId },
      select: { title: true, keyPhrase: true },
    });

    const contentContext = content
      ? `${content.title} - ${content.keyPhrase}`
      : "General English conversation";

    const { feedback, recommendedSentence } = await getInterviewFeedback(
      question,
      answer,
      contentContext
    );

    const feedbackJson = feedback as unknown as Prisma.InputJsonValue;

    await prisma.interviewAnswer.upsert({
      where: buildInterviewAnswerUniqueKey({ userId, contentId, level, questionIndex }),
      update: {
        question,
        userAnswer: answer,
        recommendedSentence,
        feedback: feedbackJson,
      },
      create: {
        userId,
        contentId,
        level,
        questionIndex,
        question,
        userAnswer: answer,
        recommendedSentence,
        feedback: feedbackJson,
      },
    });

    return NextResponse.json({ feedback, recommendedSentence });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";

    if (message === "AI provider not configured") {
      return NextResponse.json(
        { error: "AI service is not configured" },
        { status: 503 }
      );
    }

    console.error("[AI interview error]", message);
    return NextResponse.json(
      { error: "Failed to get AI feedback" },
      { status: 500 }
    );
  }
}

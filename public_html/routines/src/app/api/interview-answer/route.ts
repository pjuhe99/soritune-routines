import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import type { ContentLevel } from "@prisma/client";

const VALID_LEVELS: readonly ContentLevel[] = ["beginner", "intermediate", "advanced"] as const;

export async function GET(req: NextRequest) {
  const { userId } = await requireUser();

  const { searchParams } = new URL(req.url);
  const contentIdStr = searchParams.get("contentId");
  const levelStr = searchParams.get("level");

  const contentId = contentIdStr ? parseInt(contentIdStr, 10) : NaN;
  if (Number.isNaN(contentId)) {
    return NextResponse.json({ error: "Invalid contentId" }, { status: 400 });
  }
  if (!levelStr || !VALID_LEVELS.includes(levelStr as ContentLevel)) {
    return NextResponse.json({ error: "Invalid level" }, { status: 400 });
  }
  const level = levelStr as ContentLevel;

  const answers = await prisma.interviewAnswer.findMany({
    where: { userId, contentId, level },
    orderBy: { questionIndex: "asc" },
    include: {
      recordings: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  return NextResponse.json({
    answers: answers.map((a) => ({
      id: a.id,
      questionIndex: a.questionIndex,
      question: a.question,
      recommendedSentence: a.recommendedSentence,
      latestRecording: a.recordings[0]
        ? {
            id: a.recordings[0].id,
            targetSentence: a.recordings[0].targetSentence,
            createdAt: a.recordings[0].createdAt.toISOString(),
            expiresAt: a.recordings[0].expiresAt.toISOString(),
            durationMs: a.recordings[0].durationMs,
          }
        : null,
    })),
  });
}

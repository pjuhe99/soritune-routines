import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { getInterviewFeedback } from "@/lib/ai-service";

export async function POST(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  try {
    const { contentId, question, answer } = await req.json();

    if (!contentId || !question || !answer) {
      return NextResponse.json(
        { error: "Missing required fields" },
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

    const feedback = await getInterviewFeedback(question, answer, contentContext);

    return NextResponse.json({ feedback });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";

    if (message === "AI provider not configured") {
      return NextResponse.json(
        { error: "AI service is not configured" },
        { status: 503 }
      );
    }

    console.error("AI interview error:", message);
    return NextResponse.json(
      { error: "Failed to get AI feedback" },
      { status: 500 }
    );
  }
}

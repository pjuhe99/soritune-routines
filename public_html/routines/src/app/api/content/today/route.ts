import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Level = "beginner" | "intermediate" | "advanced";
const LEVELS: readonly Level[] = ["beginner", "intermediate", "advanced"] as const;
const DEFAULT_LEVEL: Level = "intermediate";

function parseLevel(input: string | null): Level {
  if (input && (LEVELS as readonly string[]).includes(input)) return input as Level;
  return DEFAULT_LEVEL;
}

// Today's KST calendar date represented as UTC midnight so equality
// comparisons against MySQL `@db.Date` columns (which strip the time)
// match stored values written with the same convention.
function todayKSTDate(): Date {
  const kstDateStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
  return new Date(kstDateStr);
}

export async function GET(req: NextRequest) {
  const today = todayKSTDate();
  const level = parseLevel(req.nextUrl.searchParams.get("level"));

  const topic = await prisma.content.findFirst({
    where: { publishedAt: today, isActive: true },
    orderBy: { priority: "desc" },
    include: { variants: true },
  });

  if (!topic) {
    return NextResponse.json({ error: "No content for today" }, { status: 404 });
  }

  let variant = topic.variants.find((v) => v.level === level);
  if (!variant && level !== DEFAULT_LEVEL) {
    console.warn("variant missing — falling back to intermediate", {
      contentId: topic.id,
      requestedLevel: level,
    });
    variant = topic.variants.find((v) => v.level === DEFAULT_LEVEL);
  }
  if (!variant) {
    return NextResponse.json(
      { error: "No variant available for this content" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    id: topic.id,
    genre: topic.genre,
    title: topic.title,
    subtitle: topic.subtitle,
    keyPhrase: topic.keyPhrase,
    keyKo: topic.keyKo,
    publishedAt: topic.publishedAt,
    level: variant.level,
    paragraphs: variant.paragraphs,
    sentences: variant.sentences,
    expressions: variant.expressions,
    quiz: variant.quiz,
    interview: variant.interview,
    speakSentences: variant.speakSentences,
  });
}

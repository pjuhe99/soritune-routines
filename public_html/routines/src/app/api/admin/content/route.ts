import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";

type Level = "beginner" | "intermediate" | "advanced";
const REQUIRED_LEVELS: readonly Level[] = ["beginner", "intermediate", "advanced"] as const;

interface VariantPayload {
  level: Level;
  paragraphs: unknown;
  sentences: unknown;
  expressions: unknown;
  quiz: unknown;
  interview: unknown;
  speakSentences: unknown;
}

function validateVariants(raw: unknown): VariantPayload[] | null {
  if (!Array.isArray(raw) || raw.length !== 3) return null;
  const seen = new Set<string>();
  for (const v of raw) {
    if (typeof v !== "object" || v === null) return null;
    const entry = v as Record<string, unknown>;
    if (typeof entry.level !== "string") return null;
    if (!(REQUIRED_LEVELS as readonly string[]).includes(entry.level)) return null;
    if (seen.has(entry.level)) return null;
    seen.add(entry.level);
    for (const field of ["paragraphs", "sentences", "expressions", "quiz", "interview", "speakSentences"]) {
      if (entry[field] === undefined) return null;
    }
  }
  return raw as VariantPayload[];
}

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const contents = await prisma.content.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true, genre: true, title: true, publishedAt: true,
      priority: true, isActive: true, createdAt: true,
    },
  });

  return NextResponse.json(contents);
}

export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const data = await req.json();
  const variants = validateVariants(data.variants);
  if (!variants) {
    return NextResponse.json(
      { error: "variants must be an array of exactly 3 entries (beginner, intermediate, advanced), each with all learning fields" },
      { status: 400 }
    );
  }

  const content = await prisma.$transaction(async (tx) => {
    const topic = await tx.content.create({
      data: {
        genre: data.genre,
        title: data.title,
        subtitle: data.subtitle || null,
        keyPhrase: data.keyPhrase,
        keyKo: data.keyKo,
        publishedAt: data.publishedAt ? new Date(data.publishedAt) : null,
        priority: data.priority || 0,
        isActive: data.isActive ?? true,
      },
    });
    for (const v of variants) {
      await tx.contentVariant.create({
        data: {
          contentId: topic.id,
          level: v.level,
          paragraphs: v.paragraphs as object,
          sentences: v.sentences as object,
          expressions: v.expressions as object,
          quiz: v.quiz as object,
          interview: v.interview as object,
          speakSentences: v.speakSentences as object,
        },
      });
    }
    return topic;
  });

  return NextResponse.json(content, { status: 201 });
}

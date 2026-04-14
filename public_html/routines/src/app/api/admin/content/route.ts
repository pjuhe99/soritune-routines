import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";

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

  const content = await prisma.content.create({
    data: {
      genre: data.genre,
      title: data.title,
      subtitle: data.subtitle || null,
      keyPhrase: data.keyPhrase,
      keyKo: data.keyKo,
      paragraphs: data.paragraphs,
      sentences: data.sentences,
      expressions: data.expressions,
      quiz: data.quiz,
      interview: data.interview,
      speakSentences: data.speakSentences,
      publishedAt: data.publishedAt ? new Date(data.publishedAt) : null,
      priority: data.priority || 0,
      isActive: data.isActive ?? true,
    },
  });

  return NextResponse.json(content, { status: 201 });
}

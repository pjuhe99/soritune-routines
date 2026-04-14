import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const content = await prisma.content.findUnique({
    where: { id: parseInt(id) },
  });

  if (!content) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(content);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const data = await req.json();

  const content = await prisma.content.update({
    where: { id: parseInt(id) },
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

  return NextResponse.json(content);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  await prisma.content.delete({ where: { id: parseInt(id) } });

  return NextResponse.json({ success: true });
}

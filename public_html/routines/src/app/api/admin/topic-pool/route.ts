import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { isCategory } from "@/lib/categories";

interface PoolInput {
  category: string;
  subtopicKo: string;
  keyPhraseEn: string;
  keyKo: string;
  isActive: boolean;
  notes: string | null;
}

function validateInput(data: Record<string, unknown>): PoolInput | string {
  if (!isCategory(data.category)) return "category must be one of 웰빙, 교육, 자기개발, 환경, 일상";
  for (const k of ["subtopicKo", "keyPhraseEn", "keyKo"] as const) {
    const v = data[k];
    if (typeof v !== "string" || v.trim() === "") return `${k} is required and must be non-empty`;
  }
  const isActive = typeof data.isActive === "boolean" ? data.isActive : true;
  const notes =
    typeof data.notes === "string" && data.notes.trim() !== "" ? data.notes.trim() : null;
  return {
    category: data.category,
    subtopicKo: (data.subtopicKo as string).trim(),
    keyPhraseEn: (data.keyPhraseEn as string).trim(),
    keyKo: (data.keyKo as string).trim(),
    isActive,
    notes,
  };
}

export async function GET(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const where = category && isCategory(category) ? { category } : {};

  const rows = await prisma.topicPool.findMany({
    where,
    orderBy: [{ category: "asc" }, { lastUsedAt: { sort: "asc", nulls: "first" } }, { id: "asc" }],
  });
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = (await req.json()) as Record<string, unknown>;
  const input = validateInput(body);
  if (typeof input === "string") {
    return NextResponse.json({ error: input }, { status: 400 });
  }

  try {
    const created = await prisma.topicPool.create({ data: input });
    return NextResponse.json(created, { status: 201 });
  } catch (err: unknown) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "이미 같은 카테고리에 같은 세부주제가 존재합니다." },
        { status: 409 }
      );
    }
    throw err;
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { isCategory } from "@/lib/categories";

async function parseId(params: Promise<{ id: string }>): Promise<number | null> {
  const { id } = await params;
  const n = Number(id);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const id = await parseId(params);
  if (!id) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  const body = (await req.json()) as Record<string, unknown>;
  const data: Record<string, unknown> = {};

  if ("category" in body) {
    if (!isCategory(body.category))
      return NextResponse.json({ error: "invalid category" }, { status: 400 });
    data.category = body.category;
  }
  for (const k of ["subtopicKo", "keyPhraseEn", "keyKo"] as const) {
    if (k in body) {
      const v = body[k];
      if (typeof v !== "string" || v.trim() === "") {
        return NextResponse.json({ error: `${k} must be non-empty` }, { status: 400 });
      }
      data[k] = v.trim();
    }
  }
  if ("isActive" in body) {
    if (typeof body.isActive !== "boolean")
      return NextResponse.json({ error: "isActive must be boolean" }, { status: 400 });
    data.isActive = body.isActive;
  }
  if ("notes" in body) {
    data.notes =
      typeof body.notes === "string" && body.notes.trim() !== "" ? body.notes.trim() : null;
  }

  try {
    const updated = await prisma.topicPool.update({ where: { id }, data });
    return NextResponse.json(updated);
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
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: string }).code === "P2025"
    ) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    throw err;
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const id = await parseId(params);
  if (!id) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  try {
    await prisma.topicPool.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: string }).code === "P2025"
    ) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    throw err;
  }
}

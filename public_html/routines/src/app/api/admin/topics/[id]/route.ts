import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";

function parseDateString(raw: unknown): Date | null {
  if (typeof raw !== "string") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const idNum = parseInt(id, 10);
  if (!Number.isFinite(idNum)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const body = await req.json();
  const date = parseDateString(body.date);
  if (!date) return NextResponse.json({ error: "date must be YYYY-MM-DD" }, { status: 400 });
  for (const k of ["genre", "keyPhrase", "keyKo"] as const) {
    const v = body[k];
    if (typeof v !== "string" || v.trim() === "") {
      return NextResponse.json(
        { error: `${k} is required and must be a non-empty string` },
        { status: 400 }
      );
    }
  }
  const hint =
    typeof body.hint === "string" && body.hint.trim() !== "" ? body.hint.trim() : null;

  try {
    const updated = await prisma.upcomingTopic.update({
      where: { id: idNum },
      data: {
        date,
        genre: (body.genre as string).trim(),
        keyPhrase: (body.keyPhrase as string).trim(),
        keyKo: (body.keyKo as string).trim(),
        hint,
      },
    });
    return NextResponse.json(updated);
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Another topic for this date already exists" },
        { status: 409 }
      );
    }
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: string }).code === "P2025"
    ) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    throw err;
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const idNum = parseInt(id, 10);
  if (!Number.isFinite(idNum)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    await prisma.upcomingTopic.delete({ where: { id: idNum } });
    return NextResponse.json({ success: true });
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: string }).code === "P2025"
    ) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    throw err;
  }
}

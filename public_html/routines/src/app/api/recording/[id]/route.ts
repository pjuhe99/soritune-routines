import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  const recordingId = parseInt(id, 10);
  if (Number.isNaN(recordingId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const rec = await prisma.recording.findUnique({
    where: { id: recordingId },
    select: { id: true, userId: true, filePath: true },
  });
  if (!rec || rec.userId !== session!.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (rec.filePath) {
    const abs = path.join(process.cwd(), rec.filePath);
    await fs.unlink(abs).catch(() => undefined);
  }
  await prisma.recording.delete({ where: { id: recordingId } });

  return NextResponse.json({ ok: true });
}

export const runtime = "nodejs";

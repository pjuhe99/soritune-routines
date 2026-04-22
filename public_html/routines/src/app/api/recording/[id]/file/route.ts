import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await requireUser();

  const { id } = await params;
  const recordingId = parseInt(id, 10);
  if (Number.isNaN(recordingId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const rec = await prisma.recording.findUnique({
    where: { id: recordingId },
    include: { interviewAnswer: { select: { contentId: true, questionIndex: true } } },
  });
  if (!rec || rec.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (rec.expiresAt.getTime() < Date.now()) {
    return NextResponse.json({ error: "Expired" }, { status: 404 });
  }
  if (!rec.filePath) {
    return NextResponse.json({ error: "File missing" }, { status: 404 });
  }

  const abs = path.join(process.cwd(), rec.filePath);
  let buffer: Buffer;
  try {
    buffer = await fs.readFile(abs);
  } catch {
    return NextResponse.json({ error: "File missing" }, { status: 404 });
  }

  const download = new URL(req.url).searchParams.get("download") === "1";
  const dateStr = rec.createdAt.toISOString().slice(0, 10).replace(/-/g, "");
  const filename = `soritune-${rec.interviewAnswer.contentId}-q${rec.interviewAnswer.questionIndex}-${dateStr}.${rec.fileExt}`;

  const headers: Record<string, string> = {
    "Content-Type": rec.mimeType,
    "Content-Length": String(rec.sizeBytes),
    "Cache-Control": "private, no-store",
  };
  headers["Content-Disposition"] = download
    ? `attachment; filename="${filename}"`
    : `inline; filename="${filename}"`;

  return new NextResponse(new Uint8Array(buffer), { status: 200, headers });
}

export const runtime = "nodejs";

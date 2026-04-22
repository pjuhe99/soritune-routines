import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { mimeToExt } from "@/lib/audio-mime";
import {
  getUserDir,
  getRecordingAbsPath,
  getRecordingRelPath,
  getTempAbsPath,
} from "@/lib/upload-paths";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MiB
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function POST(req: NextRequest) {
  const { userId } = await requireUser();

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const interviewAnswerIdRaw = form.get("interviewAnswerId");
  const audio = form.get("audio");
  const durationMsRaw = form.get("durationMs");

  const interviewAnswerId = typeof interviewAnswerIdRaw === "string"
    ? parseInt(interviewAnswerIdRaw, 10)
    : NaN;
  if (Number.isNaN(interviewAnswerId)) {
    return NextResponse.json({ error: "Missing interviewAnswerId" }, { status: 400 });
  }

  if (!(audio instanceof File)) {
    return NextResponse.json({ error: "Missing audio file" }, { status: 400 });
  }
  if (audio.size === 0) {
    return NextResponse.json({ error: "Empty audio file" }, { status: 400 });
  }
  if (audio.size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large (max 10 MiB)" }, { status: 413 });
  }

  let fileExt: "webm" | "ogg" | "mp4";
  try {
    fileExt = mimeToExt(audio.type);
  } catch {
    return NextResponse.json({ error: `Unsupported MIME: ${audio.type}` }, { status: 400 });
  }

  const durationMsParsed = typeof durationMsRaw === "string" ? parseInt(durationMsRaw, 10) : NaN;
  const durationMs = Number.isFinite(durationMsParsed) ? Math.max(0, durationMsParsed) : null;

  // Ownership check — InterviewAnswer must belong to this user, and snapshot its current recommendedSentence.
  const answer = await prisma.interviewAnswer.findUnique({
    where: { id: interviewAnswerId },
    select: { id: true, userId: true, recommendedSentence: true },
  });
  if (!answer || answer.userId !== userId) {
    return NextResponse.json({ error: "Interview answer not found" }, { status: 404 });
  }

  const userDir = getUserDir(userId);
  await fs.mkdir(userDir, { recursive: true });

  // Step A: save to temp file
  const tmpId = crypto.randomBytes(8).toString("hex");
  const tmpPath = getTempAbsPath(userId, tmpId, fileExt);
  const buffer = Buffer.from(await audio.arrayBuffer());
  await fs.writeFile(tmpPath, buffer);

  // Step B: DB tx — delete old rows, create new row
  let newRecordingId: number;
  let oldPaths: string[] = [];
  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.recording.findMany({
        where: { interviewAnswerId, userId },
        select: { id: true, filePath: true },
      });
      if (existing.length > 0) {
        await tx.recording.deleteMany({
          where: { id: { in: existing.map((r) => r.id) } },
        });
      }
      const created = await tx.recording.create({
        data: {
          userId,
          interviewAnswerId,
          targetSentence: answer.recommendedSentence,
          filePath: "", // filled after rename
          fileExt,
          mimeType: audio.type,
          sizeBytes: audio.size,
          durationMs,
          expiresAt: new Date(Date.now() + TTL_MS),
        },
      });
      return { newId: created.id, oldPaths: existing.map((r) => r.filePath) };
    });
    newRecordingId = result.newId;
    oldPaths = result.oldPaths;
  } catch (err) {
    await fs.unlink(tmpPath).catch(() => undefined);
    console.error("Recording DB tx failed:", err);
    return NextResponse.json({ error: "Failed to save recording" }, { status: 500 });
  }

  // Step C: rename temp → final, update filePath
  const finalAbs = getRecordingAbsPath(userId, newRecordingId, fileExt);
  const finalRel = getRecordingRelPath(userId, newRecordingId, fileExt);
  try {
    await fs.rename(tmpPath, finalAbs);
    await prisma.recording.update({
      where: { id: newRecordingId },
      data: { filePath: finalRel },
    });
  } catch (err) {
    console.error("Recording rename failed:", err);
    await fs.unlink(tmpPath).catch(() => undefined);
    // Row remains with filePath="" so the cron will eventually clean it up.
    return NextResponse.json(
      { error: "Failed to finalize recording" },
      { status: 500 }
    );
  }

  // Step D: unlink old files (best-effort, cron is safety net)
  for (const p of oldPaths) {
    if (!p) continue;
    const abs = path.join(process.cwd(), p);
    await fs.unlink(abs).catch(() => undefined);
  }

  const rec = await prisma.recording.findUnique({
    where: { id: newRecordingId },
    select: { id: true, createdAt: true, expiresAt: true, durationMs: true, targetSentence: true },
  });
  if (!rec) {
    console.error("Recording disappeared after creation:", newRecordingId);
    return NextResponse.json({ error: "Recording not found" }, { status: 500 });
  }

  return NextResponse.json({
    id: rec.id,
    targetSentence: rec.targetSentence,
    createdAt: rec.createdAt.toISOString(),
    expiresAt: rec.expiresAt.toISOString(),
    durationMs: rec.durationMs,
  });
}

export const runtime = "nodejs";

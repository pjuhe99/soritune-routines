import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const secret = process.env.CLEANUP_CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CLEANUP_CRON_SECRET not configured" }, { status: 503 });
  }
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  const expired = await prisma.recording.findMany({
    where: { expiresAt: { lt: new Date() } },
    select: { id: true, filePath: true },
  });

  let fileDeleteFailures = 0;
  for (const rec of expired) {
    if (!rec.filePath) continue;
    const abs = path.join(process.cwd(), rec.filePath);
    try {
      await fs.unlink(abs);
    } catch (err) {
      const code = (err as NodeJS.ErrnoException)?.code;
      if (code !== "ENOENT") {
        fileDeleteFailures += 1;
        console.error("cleanup unlink failed:", rec.filePath, err);
      }
    }
  }

  const { count } = await prisma.recording.deleteMany({
    where: { id: { in: expired.map((r) => r.id) } },
  });

  return NextResponse.json({
    deletedCount: count,
    fileDeleteFailures,
    elapsedMs: Date.now() - startedAt,
  });
}

export const runtime = "nodejs";

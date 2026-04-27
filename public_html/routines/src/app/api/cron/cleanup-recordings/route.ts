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
  // 2026-04-27: 만료 녹음이 누적되면 메모리 폭증 위험 → 1회 호출당 500건 배치 처리.
  // 더 많은 녹음이 만료된 상태라면 다음 cron 호출에서 이어서 처리됨.
  const expired = await prisma.recording.findMany({
    where: { expiresAt: { lt: new Date() } },
    select: { id: true, filePath: true },
    take: 500,
    orderBy: { expiresAt: "asc" },
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

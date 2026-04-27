import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { todayKST, yesterdayKST, isSameDateKST } from "@/lib/date";
import { parseLevel } from "@/lib/level";
import { progressMapForLevel, progressRowsToMap, STEP_ORDER } from "@/lib/progress";
import type { LearningStep } from "@prisma/client";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ contentId: string }> }
) {
  const { userId } = await requireUser();
  const { contentId } = await params;
  const cId = parseInt(contentId, 10);

  if (Number.isNaN(cId)) {
    return NextResponse.json({ error: "Invalid contentId" }, { status: 400 });
  }

  const url = new URL(req.url);
  const level = parseLevel(url.searchParams.get("level"));
  if (!level) {
    return NextResponse.json(
      { error: "Missing or invalid `level` query param" },
      { status: 400 },
    );
  }

  const progressMap = await progressMapForLevel(userId, cId, level);
  return NextResponse.json(progressMap);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ contentId: string }> }
) {
  const { userId } = await requireUser();
  const { contentId } = await params;
  const cId = parseInt(contentId, 10);

  if (Number.isNaN(cId)) {
    return NextResponse.json({ error: "Invalid contentId" }, { status: 400 });
  }

  const body = await req.json() as {
    step?: LearningStep;
    level?: string;
    score?: number;
    skipped?: boolean;
  };
  const { step, score, skipped } = body;
  const level = parseLevel(body.level);

  if (!level) {
    return NextResponse.json(
      { error: "Missing or invalid `level` in body" },
      { status: 400 },
    );
  }
  if (!step || !STEP_ORDER.includes(step)) {
    return NextResponse.json({ error: "Invalid step" }, { status: 400 });
  }

  // Upsert progress (idempotent within a level)
  await prisma.userProgress.upsert({
    where: {
      userId_contentId_level_step: { userId, contentId: cId, level, step },
    },
    update: {},
    create: {
      userId,
      contentId: cId,
      level,
      step,
      completed: !skipped,
      skipped: skipped || false,
      score: score ?? null,
      completedAt: new Date(),
    },
  });

  // Per-level done check
  const map = await progressMapForLevel(userId, cId, level);
  const allDone = STEP_ORDER.every((s) => map[s].completed || map[s].skipped);

  if (!allDone) {
    return NextResponse.json({ success: true, allDone: false });
  }

  // First time this content is fully completed (any level) → bump streak.
  // Otherwise just confirm.
  await prisma.$transaction(async (tx) => {
    const existingComplete = await tx.analyticsEvent.findFirst({
      where: { userId, type: "complete", contentId: cId },
      select: { id: true },
    });
    if (existingComplete) return; // Streak already counted for this content

    // Re-verify per-level done inside transaction
    const verified = await tx.userProgress.findMany({
      where: { userId, contentId: cId, level },
      select: { step: true, completed: true, skipped: true },
    });
    const verifiedMap = progressRowsToMap(verified);
    const verifiedDone = STEP_ORDER.every(
      (s) => verifiedMap[s].completed || verifiedMap[s].skipped,
    );
    if (!verifiedDone) return;

    // Lock and update streak
    const streakRows = await tx.$queryRaw<Array<{
      id: number;
      user_id: string;
      current_streak: number;
      longest_streak: number;
      last_completed: Date | null;
    }>>`SELECT * FROM streaks WHERE user_id = ${userId} FOR UPDATE`;

    let streak = streakRows[0];
    if (!streak) {
      await tx.streak.create({
        data: { userId, currentStreak: 0, longestStreak: 0 },
      });
      const newRows = await tx.$queryRaw<typeof streakRows>`SELECT * FROM streaks WHERE user_id = ${userId} FOR UPDATE`;
      streak = newRows[0];
    }

    const today = todayKST();
    const yesterday = yesterdayKST();

    if (streak.last_completed && isSameDateKST(streak.last_completed, today)) {
      // Same-day double-bump guard (kept for safety; existingComplete check above
      // also catches this because complete event would already exist for today's content)
      return;
    }

    const newStreak =
      streak.last_completed && isSameDateKST(streak.last_completed, yesterday)
        ? streak.current_streak + 1
        : 1;

    await tx.streak.update({
      where: { userId },
      data: {
        currentStreak: newStreak,
        longestStreak: Math.max(newStreak, streak.longest_streak),
        lastCompleted: today,
      },
    });

    await tx.analyticsEvent.create({
      data: { userId, type: "complete", contentId: cId, metadata: { level } },
    });
  });

  return NextResponse.json({ success: true, allDone: true });
}

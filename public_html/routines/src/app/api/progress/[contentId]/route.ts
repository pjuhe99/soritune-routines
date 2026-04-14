import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { todayKST, yesterdayKST, isSameDateKST } from "@/lib/date";
import { LearningStep } from "@prisma/client";

const ALL_STEPS: LearningStep[] = [
  "reading", "listening", "expressions", "quiz", "interview", "speaking",
];

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ contentId: string }> }
) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const { contentId } = await params;

  const progress = await prisma.userProgress.findMany({
    where: {
      userId: session!.user.id,
      contentId: parseInt(contentId),
    },
  });

  return NextResponse.json(progress);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ contentId: string }> }
) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const { contentId } = await params;
  const { step, score, skipped } = await req.json() as {
    step: LearningStep;
    score?: number;
    skipped?: boolean;
  };

  if (!ALL_STEPS.includes(step)) {
    return NextResponse.json({ error: "Invalid step" }, { status: 400 });
  }

  const userId = session!.user.id;
  const cId = parseInt(contentId);

  // Upsert progress (idempotent)
  await prisma.userProgress.upsert({
    where: {
      userId_contentId_step: { userId, contentId: cId, step },
    },
    update: {},  // No update if already exists — idempotent
    create: {
      userId,
      contentId: cId,
      step,
      completed: !skipped,
      skipped: skipped || false,
      score: score ?? null,
      completedAt: new Date(),
    },
  });

  // Check if all 6 steps are done
  const allProgress = await prisma.userProgress.findMany({
    where: { userId, contentId: cId },
  });

  const allDone = ALL_STEPS.every((s) => {
    const p = allProgress.find((pr) => pr.step === s);
    return p && (p.completed || p.skipped);
  });

  if (allDone) {
    // Update streak in a transaction with row lock
    await prisma.$transaction(async (tx) => {
      // Re-verify all steps inside transaction
      const verified = await tx.userProgress.findMany({
        where: { userId, contentId: cId },
      });
      const verifiedDone = ALL_STEPS.every((s) => {
        const p = verified.find((pr) => pr.step === s);
        return p && (p.completed || p.skipped);
      });
      if (!verifiedDone) return;

      // Get or create streak with row-level lock (SELECT ... FOR UPDATE)
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
        // Already completed today — no change (idempotent)
        return;
      }

      let newStreak: number;
      if (streak.last_completed && isSameDateKST(streak.last_completed, yesterday)) {
        newStreak = streak.current_streak + 1;
      } else {
        newStreak = 1;
      }

      await tx.streak.update({
        where: { userId },
        data: {
          currentStreak: newStreak,
          longestStreak: Math.max(newStreak, streak.longest_streak),
          lastCompleted: today,
        },
      });

      // Record complete event
      await tx.analyticsEvent.create({
        data: { userId, type: "complete", contentId: cId },
      });
    });
  }

  return NextResponse.json({ success: true, allDone });
}

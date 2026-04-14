import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";

export async function GET() {
  const { error, session } = await requireAuth();
  if (error) return error;

  let streak = await prisma.streak.findUnique({
    where: { userId: session!.user.id },
  });

  if (!streak) {
    streak = await prisma.streak.create({
      data: { userId: session!.user.id },
    });
  }

  return NextResponse.json({
    currentStreak: streak.currentStreak,
    longestStreak: streak.longestStreak,
    lastCompleted: streak.lastCompleted,
  });
}

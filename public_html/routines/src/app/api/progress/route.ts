import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";

export async function GET() {
  const { error, session } = await requireAuth();
  if (error) return error;

  const progress = await prisma.userProgress.findMany({
    where: { userId: session!.user.id },
    select: {
      contentId: true,
      step: true,
      completed: true,
      skipped: true,
      score: true,
      completedAt: true,
    },
  });

  return NextResponse.json(progress);
}

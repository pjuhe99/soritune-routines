import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const users = await prisma.user.findMany({
    select: {
      id: true, email: true, name: true, role: true,
      subscriptionStatus: true, createdAt: true, lastLoginAt: true,
      streak: { select: { currentStreak: true, longestStreak: true } },
      _count: { select: { progress: { where: { completed: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(users);
}

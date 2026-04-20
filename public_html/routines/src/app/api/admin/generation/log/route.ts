import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";

export async function GET(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const limitParam = req.nextUrl.searchParams.get("limit");
  let limit = 10;
  if (limitParam !== null) {
    const n = parseInt(limitParam, 10);
    if (Number.isFinite(n) && n > 0 && n <= 100) limit = n;
  }

  const logs = await prisma.generationLog.findMany({
    orderBy: { runAt: "desc" },
    take: limit,
    select: {
      id: true,
      targetDate: true,
      runAt: true,
      status: true,
      provider: true,
      model: true,
      durationMs: true,
      contentId: true,
      errorMessage: true,
      attempt: true,
    },
  });

  return NextResponse.json(logs);
}

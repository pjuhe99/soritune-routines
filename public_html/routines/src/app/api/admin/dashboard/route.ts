import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [
    todayDau,
    newSignups,
    todayCompletions,
    todayShares,
    totalUsers,
    avgStreak,
    streakOver7,
  ] = await Promise.all([
    prisma.analyticsEvent.groupBy({
      by: ["userId"],
      where: { createdAt: { gte: todayStart }, userId: { not: null } },
    }).then((r) => r.length),
    prisma.user.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.analyticsEvent.count({
      where: { type: "complete", createdAt: { gte: todayStart } },
    }),
    prisma.share.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.user.count(),
    prisma.streak.aggregate({ _avg: { currentStreak: true } }),
    prisma.streak.count({ where: { currentStreak: { gte: 7 } } }),
  ]);

  // Per-content metrics: view count ranking + completion rate
  const contentMetrics = await prisma.content.findMany({
    where: { isActive: true, publishedAt: { not: null } },
    select: {
      id: true,
      title: true,
      _count: {
        select: {
          analyticsEvents: { where: { type: "view" } },
          progress: { where: { completed: true } },
        },
      },
    },
    orderBy: { analyticsEvents: { _count: "desc" } },
    take: 10,
  });

  const contentRanking = contentMetrics.map((c) => ({
    id: c.id,
    title: c.title,
    views: c._count.analyticsEvents,
    completions: c._count.progress,
    completionRate:
      c._count.analyticsEvents > 0
        ? Math.round((c._count.progress / c._count.analyticsEvents) * 100)
        : 0,
  }));

  // 30-day DAU trend
  const dailyDau = await prisma.$queryRaw<Array<{ date: string; dau: bigint }>>`
    SELECT DATE(created_at) as date, COUNT(DISTINCT user_id) as dau
    FROM analytics_events
    WHERE created_at >= ${thirtyDaysAgo} AND user_id IS NOT NULL
    GROUP BY DATE(created_at)
    ORDER BY date ASC
  `;

  const dauTrend = dailyDau.map((d) => ({
    date: String(d.date),
    dau: Number(d.dau),
  }));

  return NextResponse.json({
    today: {
      dau: todayDau,
      newSignups,
      completions: todayCompletions,
      shares: todayShares,
    },
    totals: {
      users: totalUsers,
      avgStreak: Math.round(avgStreak._avg.currentStreak || 0),
      streakOver7,
    },
    contentRanking,
    dauTrend,
  });
}

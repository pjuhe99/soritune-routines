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

  const [todayDau, todayCompletions, todayShares, totalUsers] = await Promise.all([
    prisma.analyticsEvent
      .groupBy({
        by: ["userId"],
        where: { createdAt: { gte: todayStart }, userId: { not: null } },
      })
      .then((r) => r.length),
    prisma.analyticsEvent.count({
      where: { type: "complete", createdAt: { gte: todayStart } },
    }),
    prisma.share.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.user.count(),
  ]);

  // Per-content metrics: ranked by total view events; completion counted as
  // distinct users who hit /complete for the content (UserProgress is no
  // longer populated in the pilot login-less flow).
  const contentMetrics = await prisma.content.findMany({
    where: { isActive: true, publishedAt: { not: null } },
    select: {
      id: true,
      title: true,
      _count: {
        select: {
          analyticsEvents: { where: { type: "view" } },
        },
      },
    },
    orderBy: { analyticsEvents: { _count: "desc" } },
    take: 10,
  });

  const topContentIds = contentMetrics.map((c) => c.id);

  // Distinct (contentId, userId) pairs for complete events → one row per
  // unique completer per content; count per contentId gives unique completers.
  const completionPairs =
    topContentIds.length > 0
      ? await prisma.analyticsEvent.groupBy({
          by: ["contentId", "userId"],
          where: {
            type: "complete",
            contentId: { in: topContentIds },
            userId: { not: null },
          },
        })
      : [];
  // Distinct viewers (not raw view events) for denominator so the ratio
  // answers "what % of unique visitors finished this content".
  const viewerPairs =
    topContentIds.length > 0
      ? await prisma.analyticsEvent.groupBy({
          by: ["contentId", "userId"],
          where: {
            type: "view",
            contentId: { in: topContentIds },
            userId: { not: null },
          },
        })
      : [];

  const uniqueCompleters = new Map<number, number>();
  for (const r of completionPairs) {
    if (r.contentId === null) continue;
    uniqueCompleters.set(r.contentId, (uniqueCompleters.get(r.contentId) ?? 0) + 1);
  }
  const uniqueViewers = new Map<number, number>();
  for (const r of viewerPairs) {
    if (r.contentId === null) continue;
    uniqueViewers.set(r.contentId, (uniqueViewers.get(r.contentId) ?? 0) + 1);
  }

  const contentRanking = contentMetrics.map((c) => {
    const completions = uniqueCompleters.get(c.id) ?? 0;
    const viewers = uniqueViewers.get(c.id) ?? 0;
    return {
      id: c.id,
      title: c.title,
      views: c._count.analyticsEvents, // raw view events (sessions)
      completions,
      completionRate:
        viewers > 0 ? Math.round((completions / viewers) * 100) : 0,
    };
  });

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
      completions: todayCompletions,
      shares: todayShares,
    },
    totals: {
      users: totalUsers,
    },
    contentRanking,
    dauTrend,
  });
}

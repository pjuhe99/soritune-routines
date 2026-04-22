import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

type Range = "today" | "7d" | "30d" | "all";

function rangeStart(range: Range): Date | null {
  const now = new Date();
  if (range === "today") {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (range === "7d") return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  if (range === "30d") return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  return null;
}

interface GroupRow {
  key: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  totalUsd: number;
  failures: number;
}

function addRow(
  map: Map<string, GroupRow>,
  key: string,
  row: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheCreationTokens: number;
    estimatedCostUsd: Prisma.Decimal;
    success: boolean;
  }
): void {
  const agg = map.get(key) ?? {
    key,
    calls: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheCreationTokens: 0,
    totalUsd: 0,
    failures: 0,
  };
  agg.calls += 1;
  agg.inputTokens += row.inputTokens;
  agg.outputTokens += row.outputTokens;
  agg.cacheReadTokens += row.cacheReadTokens;
  agg.cacheCreationTokens += row.cacheCreationTokens;
  agg.totalUsd += Number(row.estimatedCostUsd);
  if (!row.success) agg.failures += 1;
  map.set(key, agg);
}

async function aggregate(range: Range) {
  const since = rangeStart(range);
  const where = since ? { createdAt: { gte: since } } : undefined;

  const rows = await prisma.apiUsage.findMany({
    where,
    select: {
      provider: true,
      model: true,
      endpoint: true,
      inputTokens: true,
      outputTokens: true,
      cacheReadTokens: true,
      cacheCreationTokens: true,
      estimatedCostUsd: true,
      success: true,
    },
  });

  const byModel = new Map<string, GroupRow>();
  const byEndpoint = new Map<string, GroupRow>();
  let totalCalls = 0;
  let totalUsd = 0;
  let totalFailures = 0;

  for (const r of rows) {
    addRow(byModel, `${r.provider}:${r.model}`, r);
    addRow(byEndpoint, r.endpoint, r);
    totalCalls += 1;
    totalUsd += Number(r.estimatedCostUsd);
    if (!r.success) totalFailures += 1;
  }

  return {
    totals: { calls: totalCalls, totalUsd, failures: totalFailures },
    byModel: Array.from(byModel.values()).sort((a, b) => b.totalUsd - a.totalUsd),
    byEndpoint: Array.from(byEndpoint.values()).sort((a, b) => b.totalUsd - a.totalUsd),
  };
}

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const [today, last7, last30, all] = await Promise.all([
    aggregate("today"),
    aggregate("7d"),
    aggregate("30d"),
    aggregate("all"),
  ]);

  const recent = await prisma.apiUsage.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      createdAt: true,
      provider: true,
      model: true,
      endpoint: true,
      inputTokens: true,
      outputTokens: true,
      estimatedCostUsd: true,
      durationMs: true,
      success: true,
      errorMessage: true,
      contentId: true,
    },
  });

  return NextResponse.json({
    today,
    last7,
    last30,
    all,
    recent: recent.map((r) => ({
      ...r,
      estimatedCostUsd: Number(r.estimatedCostUsd),
      createdAt: r.createdAt.toISOString(),
    })),
  });
}

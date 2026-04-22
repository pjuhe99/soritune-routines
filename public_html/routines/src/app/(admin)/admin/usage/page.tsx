"use client";

import { useEffect, useState } from "react";

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

interface RangeSummary {
  totals: { calls: number; totalUsd: number; failures: number };
  byModel: GroupRow[];
  byEndpoint: GroupRow[];
}

interface RecentRow {
  id: number;
  createdAt: string;
  provider: string;
  model: string;
  endpoint: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  durationMs: number | null;
  success: boolean;
  errorMessage: string | null;
  contentId: number | null;
}

interface UsageResponse {
  today: RangeSummary;
  last7: RangeSummary;
  last30: RangeSummary;
  all: RangeSummary;
  recent: RecentRow[];
}

const ENDPOINT_LABEL: Record<string, string> = {
  generation_stage1: "콘텐츠 생성 (주제)",
  generation_stage2: "콘텐츠 생성 (레벨별)",
  interview: "AI 인터뷰",
};

function fmtUsd(n: number): string {
  return `$${n.toFixed(4)}`;
}

function fmtNum(n: number): string {
  return n.toLocaleString("en-US");
}

function StatCard({ label, summary }: { label: string; summary: RangeSummary }) {
  return (
    <div className="bg-near-black rounded-xl p-5 border border-white/5">
      <p className="text-[12px] text-muted-silver uppercase tracking-[2px] mb-2">{label}</p>
      <p className="text-[32px] font-semibold tracking-[-1px] text-white">
        {fmtUsd(summary.totals.totalUsd)}
      </p>
      <p className="text-[13px] text-muted-silver mt-2">
        {summary.totals.calls} 호출
        {summary.totals.failures > 0 && (
          <span className="text-red-400"> · {summary.totals.failures} 실패</span>
        )}
      </p>
    </div>
  );
}

function BreakdownTable({
  title,
  rows,
  labelMap,
}: {
  title: string;
  rows: GroupRow[];
  labelMap?: Record<string, string>;
}) {
  if (rows.length === 0) {
    return (
      <div className="bg-near-black rounded-xl p-5 border border-white/5">
        <h3 className="text-[14px] font-medium text-white mb-3">{title}</h3>
        <p className="text-[13px] text-muted-silver">데이터 없음</p>
      </div>
    );
  }
  return (
    <div className="bg-near-black rounded-xl p-5 border border-white/5 overflow-x-auto">
      <h3 className="text-[14px] font-medium text-white mb-3">{title}</h3>
      <table className="w-full text-[13px]">
        <thead>
          <tr className="text-muted-silver">
            <th className="text-left font-normal pb-2">항목</th>
            <th className="text-right font-normal pb-2">호출</th>
            <th className="text-right font-normal pb-2">입력 토큰</th>
            <th className="text-right font-normal pb-2">출력 토큰</th>
            <th className="text-right font-normal pb-2">합계 (USD)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-t border-white/5">
              <td className="py-2 text-white">{labelMap?.[r.key] ?? r.key}</td>
              <td className="py-2 text-right text-white/80">{fmtNum(r.calls)}</td>
              <td className="py-2 text-right text-white/80">{fmtNum(r.inputTokens)}</td>
              <td className="py-2 text-right text-white/80">{fmtNum(r.outputTokens)}</td>
              <td className="py-2 text-right text-framer-blue font-medium">
                {fmtUsd(r.totalUsd)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function UsagePage() {
  const [data, setData] = useState<UsageResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/admin/usage", { signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error(`Failed (${r.status})`);
        return r.json() as Promise<UsageResponse>;
      })
      .then(setData)
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "불러오기 실패");
      });
    return () => controller.abort();
  }, []);

  if (error) return <div className="text-red-400">오류: {error}</div>;
  if (!data) return <div className="text-muted-silver">불러오는 중...</div>;

  return (
    <div className="max-w-[960px] space-y-6">
      <h1 className="text-[24px] font-semibold tracking-[-0.01px]">API 사용량</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="오늘" summary={data.today} />
        <StatCard label="최근 7일" summary={data.last7} />
        <StatCard label="최근 30일" summary={data.last30} />
        <StatCard label="전체" summary={data.all} />
      </div>

      <section className="space-y-4">
        <h2 className="text-[18px] font-semibold text-white">브레이크다운 (최근 30일)</h2>
        <BreakdownTable title="모델별" rows={data.last30.byModel} />
        <BreakdownTable
          title="용도별"
          rows={data.last30.byEndpoint}
          labelMap={ENDPOINT_LABEL}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-[18px] font-semibold text-white">최근 20건</h2>
        <div className="bg-near-black rounded-xl p-5 border border-white/5 overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-muted-silver">
                <th className="text-left font-normal pb-2">시각</th>
                <th className="text-left font-normal pb-2">모델</th>
                <th className="text-left font-normal pb-2">용도</th>
                <th className="text-right font-normal pb-2">In/Out</th>
                <th className="text-right font-normal pb-2">USD</th>
                <th className="text-right font-normal pb-2">ms</th>
                <th className="text-left font-normal pb-2">상태</th>
              </tr>
            </thead>
            <tbody>
              {data.recent.map((r) => (
                <tr key={r.id} className="border-t border-white/5">
                  <td className="py-2 text-white/70">
                    {new Date(r.createdAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}
                  </td>
                  <td className="py-2 text-white">{r.model}</td>
                  <td className="py-2 text-white/80">{ENDPOINT_LABEL[r.endpoint] ?? r.endpoint}</td>
                  <td className="py-2 text-right text-white/70">
                    {fmtNum(r.inputTokens)} / {fmtNum(r.outputTokens)}
                  </td>
                  <td className="py-2 text-right text-framer-blue">
                    {fmtUsd(r.estimatedCostUsd)}
                  </td>
                  <td className="py-2 text-right text-white/60">{r.durationMs ?? "-"}</td>
                  <td className="py-2">
                    {r.success ? (
                      <span className="text-green-400">✓</span>
                    ) : (
                      <span className="text-red-400" title={r.errorMessage ?? ""}>
                        ✗ {r.errorMessage?.slice(0, 40)}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-[12px] text-muted-silver leading-[1.6]">
        추정 금액은 코드 내 모델별 단가표 기반이며 Anthropic/OpenAI 실제 청구와
        소수 % 차이가 있을 수 있습니다 (프롬프트 캐시·배치 할인 등). 단가표는{" "}
        <code className="text-white/80">src/lib/ai-pricing.ts</code>에서 관리.
      </p>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";

interface ContentRank {
  id: number;
  title: string;
  views: number;
  completions: number;
  completionRate: number;
}

interface DauPoint {
  date: string;
  dau: number;
}

interface Dashboard {
  today: { dau: number; completions: number; shares: number };
  totals: { users: number };
  contentRanking: ContentRank[];
  dauTrend: DauPoint[];
}

export default function AdminDashboard() {
  const [data, setData] = useState<Dashboard | null>(null);

  useEffect(() => {
    fetch("/api/admin/dashboard")
      .then((r) => r.json())
      .then(setData);
  }, []);

  if (!data) return <div className="text-muted-silver">로딩 중...</div>;

  const cards = [
    { label: "오늘 DAU", value: data.today.dau },
    { label: "오늘 학습 완료", value: data.today.completions },
    { label: "오늘 공유", value: data.today.shares },
    { label: "전체 회원", value: data.totals.users },
  ];

  const maxDau = Math.max(...data.dauTrend.map((d) => d.dau), 1);

  return (
    <div>
      <h1 className="text-[24px] font-semibold tracking-[-0.01px] mb-6">대시보드</h1>

      {/* Overview cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map((c) => (
          <Card key={c.label} variant="surface">
            <p className="text-[12px] text-muted-silver mb-1">{c.label}</p>
            <p className="text-[24px] font-semibold tracking-[-0.01px]">{c.value}</p>
          </Card>
        ))}
      </div>

      {/* 30-day DAU trend */}
      <h2 className="text-[20px] font-semibold tracking-[-0.8px] mb-4">일별 DAU (최근 30일)</h2>
      <Card variant="surface" className="mb-8">
        <div className="flex items-end gap-1 h-[120px]">
          {data.dauTrend.map((d) => (
            <div
              key={d.date}
              className="flex-1 bg-framer-blue/60 rounded-t hover:bg-framer-blue transition-colors"
              style={{ height: `${(d.dau / maxDau) * 100}%`, minHeight: "2px" }}
              title={`${d.date}: ${d.dau}`}
            />
          ))}
        </div>
        <div className="flex justify-between mt-2 text-[11px] text-muted-silver">
          <span>{data.dauTrend[0]?.date.slice(5)}</span>
          <span>{data.dauTrend[data.dauTrend.length - 1]?.date.slice(5)}</span>
        </div>
      </Card>

      {/* Content ranking */}
      <h2 className="text-[20px] font-semibold tracking-[-0.8px] mb-4">콘텐츠별 조회/완료율</h2>
      <Card variant="surface">
        <div className="space-y-3">
          {data.contentRanking.map((c, i) => (
            <div key={c.id} className="flex items-center justify-between text-[14px]">
              <div className="flex items-center gap-3">
                <span className="text-muted-silver w-5">{i + 1}</span>
                <span className="text-white truncate max-w-[300px]">{c.title}</span>
              </div>
              <div className="flex items-center gap-4 text-[13px] text-muted-silver shrink-0">
                <span>조회 {c.views}</span>
                <span>완료 {c.completions}</span>
                <span className="text-framer-blue font-medium">{c.completionRate}%</span>
              </div>
            </div>
          ))}
          {data.contentRanking.length === 0 && (
            <p className="text-muted-silver text-[14px]">아직 데이터가 없습니다.</p>
          )}
        </div>
      </Card>
    </div>
  );
}

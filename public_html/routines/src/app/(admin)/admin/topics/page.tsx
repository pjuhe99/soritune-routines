"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { GenerationTrigger } from "@/components/admin/generation-trigger";
import {
  UpcomingTopicForm,
  UpcomingTopicRow,
} from "@/components/admin/upcoming-topic-form";

function formatDate(iso: string): string {
  return iso.split("T")[0];
}

function todayKSTDateStr(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
}

export default function AdminTopicsPage() {
  const [topics, setTopics] = useState<UpcomingTopicRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<UpcomingTopicRow | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/topics");
    if (res.ok) setTopics(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDelete(id: number) {
    if (!confirm("이 예약을 삭제하시겠습니까?")) return;
    await fetch(`/api/admin/topics/${id}`, { method: "DELETE" });
    load();
  }

  const today = todayKSTDateStr();

  return (
    <div className="max-w-[960px]">
      <h1 className="text-[24px] font-semibold tracking-[-0.01px] mb-6">주제 스케줄</h1>

      <GenerationTrigger />

      <section className="bg-near-black rounded-xl p-6 border border-white/5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[18px] font-semibold text-white">예약된 주제</h2>
          {!creating && !editing && (
            <Button onClick={() => setCreating(true)}>+ 새 주제 예약</Button>
          )}
        </div>

        {(creating || editing) && (
          <div className="mb-6">
            <UpcomingTopicForm
              initial={editing ?? undefined}
              onSaved={() => {
                setCreating(false);
                setEditing(null);
                load();
              }}
              onCancel={() => {
                setCreating(false);
                setEditing(null);
              }}
            />
          </div>
        )}

        {loading ? (
          <p className="text-muted-silver text-[14px]">로딩 중...</p>
        ) : topics.length === 0 ? (
          <p className="text-muted-silver text-[14px]">예약된 주제가 없습니다.</p>
        ) : (
          <table className="w-full text-[14px]">
            <thead>
              <tr className="text-left text-muted-silver border-b border-white/5">
                <th className="py-2">날짜</th>
                <th className="py-2">장르</th>
                <th className="py-2">핵심 표현</th>
                <th className="py-2">힌트</th>
                <th className="py-2 w-[120px]">액션</th>
              </tr>
            </thead>
            <tbody>
              {topics.map((t) => {
                const past = formatDate(t.date) < today;
                return (
                  <tr
                    key={t.id}
                    className={`border-b border-white/5 ${past ? "opacity-50" : ""}`}
                  >
                    <td className="py-3 text-white">{formatDate(t.date)}</td>
                    <td className="py-3 text-white/80">{t.genre}</td>
                    <td className="py-3 text-white/80">
                      <div>{t.keyPhrase}</div>
                      <div className="text-[12px] text-muted-silver">{t.keyKo}</div>
                    </td>
                    <td className="py-3 text-white/60 text-[12px] max-w-[240px] truncate">
                      {t.hint ?? "-"}
                    </td>
                    <td className="py-3">
                      <div className="flex gap-2">
                        <Button variant="ghost" onClick={() => setEditing(t)}>
                          수정
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => handleDelete(t.id)}
                        >
                          삭제
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

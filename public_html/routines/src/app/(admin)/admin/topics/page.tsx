"use client";

import { useEffect, useState } from "react";
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
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/admin/topics", { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) return;
        const data = await res.json();
        setTopics(data);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setLoading(false);
      });
    return () => controller.abort();
  }, [refreshToken]);

  async function handleDelete(id: number) {
    if (!confirm("이 예약을 삭제하시겠습니까?")) return;
    await fetch(`/api/admin/topics/${id}`, { method: "DELETE" });
    setRefreshToken((t) => t + 1);
  }

  const today = todayKSTDateStr();

  return (
    <div className="max-w-[960px]">
      <h1 className="text-title font-semibold mb-6">주제 스케줄</h1>

      <GenerationTrigger />

      <section className="bg-surface rounded-lg p-6 border border-border-default">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-body font-semibold text-text-primary">예약된 주제</h2>
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
                setRefreshToken((t) => t + 1);
              }}
              onCancel={() => {
                setCreating(false);
                setEditing(null);
              }}
            />
          </div>
        )}

        {loading ? (
          <p className="text-text-secondary text-body">로딩 중...</p>
        ) : topics.length === 0 ? (
          <p className="text-text-secondary text-body">예약된 주제가 없습니다.</p>
        ) : (
          <table className="w-full text-[14px]">
            <thead>
              <tr className="text-left text-text-secondary border-b border-border-default">
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
                    className={`border-b border-border-default ${past ? "opacity-50" : ""}`}
                  >
                    <td className="py-3 text-text-primary">{formatDate(t.date)}</td>
                    <td className="py-3 text-text-primary">{t.genre}</td>
                    <td className="py-3 text-text-primary">
                      <div>{t.keyPhrase}</div>
                      <div className="text-caption text-text-secondary">{t.keyKo}</div>
                    </td>
                    <td className="py-3 text-text-tertiary text-caption max-w-[240px] truncate">
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

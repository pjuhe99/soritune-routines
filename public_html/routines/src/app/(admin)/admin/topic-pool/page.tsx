"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { CATEGORIES } from "@/lib/categories";
import { TopicPoolForm, type TopicPoolRow } from "@/components/admin/topic-pool-form";
import { TopicPoolTable } from "@/components/admin/topic-pool-table";

export default function AdminTopicPoolPage() {
  const [rows, setRows] = useState<TopicPoolRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("전체");
  const [editing, setEditing] = useState<TopicPoolRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const controller = new AbortController();
    const url = filter === "전체" ? "/api/admin/topic-pool" : `/api/admin/topic-pool?category=${encodeURIComponent(filter)}`;
    fetch(url, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          setError(`목록을 불러올 수 없어요 (${res.status})`);
          setLoading(false);
          return;
        }
        setRows(await res.json());
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError("네트워크 오류가 발생했어요.");
        setLoading(false);
      });
    return () => controller.abort();
  }, [refreshToken, filter]);

  async function handleDelete(row: TopicPoolRow) {
    if (!confirm(`"${row.subtopicKo}" 삭제할까요?`)) return;
    const res = await fetch(`/api/admin/topic-pool/${row.id}`, { method: "DELETE" });
    if (!res.ok) {
      alert(`삭제 실패 (${res.status})`);
      return;
    }
    setRefreshToken((x) => x + 1);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-title font-semibold">주제 풀</h1>
      <div className="flex gap-2 items-center">
        <label className="text-caption text-text-secondary">카테고리 필터</label>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="border border-border-default rounded-md px-3 py-1 text-body"
        >
          <option value="전체">전체</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <div className="ml-auto">
          <Button onClick={() => { setCreating(true); setEditing(null); }}>주제 추가</Button>
        </div>
      </div>

      {(creating || editing) && (
        <div className="border border-border-default rounded-lg p-4 bg-bg-subtle">
          <h2 className="text-body font-semibold mb-3">{editing ? "주제 수정" : "새 주제"}</h2>
          <TopicPoolForm
            initial={editing}
            onSaved={() => { setCreating(false); setEditing(null); setRefreshToken((x) => x + 1); }}
            onCancel={() => { setCreating(false); setEditing(null); }}
          />
        </div>
      )}

      {error && <div className="text-caption text-danger">{error}</div>}
      {loading ? <div>불러오는 중...</div> : <TopicPoolTable rows={rows} onEdit={(r) => { setEditing(r); setCreating(false); }} onDelete={handleDelete} />}
    </div>
  );
}

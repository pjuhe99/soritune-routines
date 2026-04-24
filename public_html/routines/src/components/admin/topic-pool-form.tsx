"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CATEGORIES } from "@/lib/categories";

export interface TopicPoolRow {
  id: number;
  category: string;
  subtopicKo: string;
  keyPhraseEn: string;
  keyKo: string;
  isActive: boolean;
  notes: string | null;
  lastUsedAt: string | null;
  useCount: number;
}

interface Props {
  initial?: TopicPoolRow | null;
  onSaved: () => void;
  onCancel: () => void;
}

export function TopicPoolForm({ initial, onSaved, onCancel }: Props) {
  const [category, setCategory] = useState(initial?.category ?? CATEGORIES[0]);
  const [subtopicKo, setSubtopicKo] = useState(initial?.subtopicKo ?? "");
  const [keyPhraseEn, setKeyPhraseEn] = useState(initial?.keyPhraseEn ?? "");
  const [keyKo, setKeyKo] = useState(initial?.keyKo ?? "");
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const method = initial ? "PATCH" : "POST";
    const url = initial ? `/api/admin/topic-pool/${initial.id}` : "/api/admin/topic-pool";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category,
        subtopicKo: subtopicKo.trim(),
        keyPhraseEn: keyPhraseEn.trim(),
        keyKo: keyKo.trim(),
        isActive,
        notes: notes.trim() || null,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || `요청 실패 (${res.status})`);
      return;
    }
    onSaved();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <label className="block">
          <span className="text-caption text-text-secondary block mb-1">카테고리</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full border border-border-default rounded-md px-3 py-2 text-body"
          >
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <Input label="세부 주제 (한국어)" value={subtopicKo} onChange={(e) => setSubtopicKo(e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input label="핵심 표현 (영)" value={keyPhraseEn} onChange={(e) => setKeyPhraseEn(e.target.value)} required />
        <Input label="핵심 표현 (한)" value={keyKo} onChange={(e) => setKeyKo(e.target.value)} required />
      </div>
      <label className="block">
        <span className="text-caption text-text-secondary block mb-1">메모 (선택)</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full border border-border-default rounded-md px-3 py-2 text-body min-h-[60px]"
        />
      </label>
      <label className="flex items-center gap-2 text-body text-text-primary cursor-pointer">
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="w-4 h-4" />
        활성 (회전에 포함)
      </label>
      {error && <div className="text-caption text-red-600">{error}</div>}
      <div className="flex gap-2">
        <Button type="submit" disabled={saving}>{saving ? "저장 중..." : initial ? "수정" : "추가"}</Button>
        <Button type="button" variant="ghost" onClick={onCancel}>취소</Button>
      </div>
    </form>
  );
}

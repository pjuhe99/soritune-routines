"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface UpcomingTopicRow {
  id: number;
  date: string;
  genre: string;
  keyPhrase: string;
  keyKo: string;
  hint: string | null;
}

interface Props {
  initial?: UpcomingTopicRow;
  onSaved: () => void;
  onCancel: () => void;
}

export function UpcomingTopicForm({ initial, onSaved, onCancel }: Props) {
  const isEdit = !!initial;
  const [date, setDate] = useState(initial?.date.split("T")[0] ?? "");
  const [genre, setGenre] = useState(initial?.genre ?? "");
  const [keyPhrase, setKeyPhrase] = useState(initial?.keyPhrase ?? "");
  const [keyKo, setKeyKo] = useState(initial?.keyKo ?? "");
  const [hint, setHint] = useState(initial?.hint ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);

    const body = {
      date,
      genre: genre.trim(),
      keyPhrase: keyPhrase.trim(),
      keyKo: keyKo.trim(),
      hint: hint.trim() || undefined,
    };

    const url = isEdit ? `/api/admin/topics/${initial!.id}` : "/api/admin/topics";
    const method = isEdit ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "저장 실패");
      return;
    }

    onSaved();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-near-black rounded-xl p-6 border border-white/5">
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="날짜"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />
        <Input
          label="장르"
          value={genre}
          onChange={(e) => setGenre(e.target.value)}
          placeholder="Workplace"
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="핵심 표현 (영)"
          value={keyPhrase}
          onChange={(e) => setKeyPhrase(e.target.value)}
          placeholder="burn out"
          required
        />
        <Input
          label="핵심 표현 (한)"
          value={keyKo}
          onChange={(e) => setKeyKo(e.target.value)}
          placeholder="번아웃 되다"
          required
        />
      </div>
      <div>
        <label className="text-[13px] font-medium text-muted-silver block mb-2">
          힌트 (선택)
        </label>
        <textarea
          value={hint}
          onChange={(e) => setHint(e.target.value)}
          placeholder="AI 에게 추가 컨텍스트를 줄 수 있는 한 두 문장"
          className="w-full bg-void-black border border-white/10 rounded-xl px-4 py-3 text-[13px] text-white leading-[1.6] placeholder:text-white/40 focus:border-framer-blue focus:outline-none min-h-[80px] resize-y"
        />
      </div>

      {error && <p className="text-red-400 text-[13px]">{error}</p>}

      <div className="flex gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? "저장 중..." : isEdit ? "수정" : "추가"}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          취소
        </Button>
      </div>
    </form>
  );
}

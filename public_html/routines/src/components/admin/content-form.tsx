"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface ContentFormProps {
  initialData?: Record<string, unknown>;
  contentId?: number;
}

type Variant = {
  level: "beginner" | "intermediate" | "advanced";
  paragraphs: unknown;
  sentences: unknown;
  expressions: unknown;
  quiz: unknown;
  interview: unknown;
  speakSentences: unknown;
};

function pickIntermediateVariant(data?: Record<string, unknown>): Variant | null {
  if (!data) return null;
  const vs = data.variants as Variant[] | undefined;
  if (!Array.isArray(vs)) return null;
  return vs.find((v) => v.level === "intermediate") ?? vs[0] ?? null;
}

export function ContentForm({ initialData, contentId }: ContentFormProps) {
  const router = useRouter();
  const isEdit = !!contentId;
  const seed = pickIntermediateVariant(initialData);

  const [form, setForm] = useState({
    genre: (initialData?.genre as string) || "",
    title: (initialData?.title as string) || "",
    subtitle: (initialData?.subtitle as string) || "",
    keyPhrase: (initialData?.keyPhrase as string) || "",
    keyKo: (initialData?.keyKo as string) || "",
    paragraphs: JSON.stringify(seed?.paragraphs ?? [""], null, 2),
    sentences: JSON.stringify(seed?.sentences ?? [""], null, 2),
    expressions: JSON.stringify(seed?.expressions ?? [{ expression: "", meaning: "", explanation: "", example: "" }], null, 2),
    quiz: JSON.stringify(seed?.quiz ?? [{ question: "", answer: "", hint: "" }], null, 2),
    interview: JSON.stringify(seed?.interview ?? [""], null, 2),
    speakSentences: JSON.stringify(seed?.speakSentences ?? [""], null, 2),
    publishedAt: (initialData?.publishedAt as string)?.split("T")[0] || "",
    priority: String(initialData?.priority || 0),
    isActive: initialData?.isActive !== false,
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);

    let parsed: {
      paragraphs: unknown;
      sentences: unknown;
      expressions: unknown;
      quiz: unknown;
      interview: unknown;
      speakSentences: unknown;
    };
    try {
      parsed = {
        paragraphs: JSON.parse(form.paragraphs),
        sentences: JSON.parse(form.sentences),
        expressions: JSON.parse(form.expressions),
        quiz: JSON.parse(form.quiz),
        interview: JSON.parse(form.interview),
        speakSentences: JSON.parse(form.speakSentences),
      };
    } catch {
      setError("JSON 형식이 올바르지 않습니다.");
      setSaving(false);
      return;
    }

    const variants: Variant[] = (["beginner", "intermediate", "advanced"] as const).map((level) => ({
      level,
      ...parsed,
    }));

    const body = {
      genre: form.genre,
      title: form.title,
      subtitle: form.subtitle || null,
      keyPhrase: form.keyPhrase,
      keyKo: form.keyKo,
      publishedAt: form.publishedAt || null,
      priority: parseInt(form.priority),
      isActive: form.isActive,
      variants,
    };

    const url = isEdit ? `/api/admin/content/${contentId}` : "/api/admin/content";
    const method = isEdit ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "저장 실패");
      return;
    }

    router.push("/admin/content");
    router.refresh();
  }

  function updateField(key: string, value: string | boolean) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-[800px]">
      <div className="grid grid-cols-2 gap-4">
        <Input label="장르" value={form.genre} onChange={(e) => updateField("genre", e.target.value)} required />
        <Input label="제목" value={form.title} onChange={(e) => updateField("title", e.target.value)} required />
      </div>
      <Input label="부제목" value={form.subtitle} onChange={(e) => updateField("subtitle", e.target.value)} />
      <div className="grid grid-cols-2 gap-4">
        <Input label="핵심 표현 (영)" value={form.keyPhrase} onChange={(e) => updateField("keyPhrase", e.target.value)} required />
        <Input label="핵심 표현 (한)" value={form.keyKo} onChange={(e) => updateField("keyKo", e.target.value)} required />
      </div>

      <p className="text-[13px] text-muted-silver">
        ※ 현재 임시 폼: 입력 값은 3레벨 모두에 동일하게 저장됩니다. 3탭 편집 UI 는 다음 커밋에서 도입됩니다.
      </p>

      {(["paragraphs", "sentences", "expressions", "quiz", "interview", "speakSentences"] as const).map((field) => (
        <div key={field}>
          <label className="text-[13px] font-medium text-muted-silver block mb-2">{field} (JSON)</label>
          <textarea
            value={form[field]}
            onChange={(e) => updateField(field, e.target.value)}
            className="w-full bg-near-black border border-white/10 rounded-xl px-4 py-3 text-[13px] text-white font-mono leading-[1.6] placeholder:text-white/40 focus:border-framer-blue focus:outline-none min-h-[150px] resize-y"
          />
        </div>
      ))}

      <div className="grid grid-cols-3 gap-4">
        <Input label="발행일 (YYYY-MM-DD)" type="date" value={form.publishedAt} onChange={(e) => updateField("publishedAt", e.target.value)} />
        <Input label="우선순위" type="number" value={form.priority} onChange={(e) => updateField("priority", e.target.value)} />
        <div className="flex items-end pb-1">
          <label className="flex items-center gap-2 text-[14px] text-white cursor-pointer">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => updateField("isActive", e.target.checked)}
              className="w-4 h-4"
            />
            활성
          </label>
        </div>
      </div>

      {error && <p className="text-red-400 text-[13px]">{error}</p>}

      <Button type="submit" disabled={saving}>
        {saving ? "저장 중..." : isEdit ? "수정" : "생성"}
      </Button>
    </form>
  );
}

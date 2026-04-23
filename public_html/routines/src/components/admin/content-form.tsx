"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LEVELS, LEVEL_LABELS, Level } from "@/lib/level";
import { ContentTopicFields, TopicFormState } from "@/components/admin/content-topic-fields";
import {
  ContentVariantFields,
  VariantFormState,
  VARIANT_FIELD_KEYS,
} from "@/components/admin/content-variant-fields";

interface ContentFormProps {
  initialData?: Record<string, unknown>;
  contentId?: number;
}

interface VariantSeed {
  level: Level;
  paragraphs?: unknown;
  sentences?: unknown;
  expressions?: unknown;
  quiz?: unknown;
  interview?: unknown;
  speakSentences?: unknown;
}

const EMPTY_VARIANT: VariantFormState = {
  paragraphs: JSON.stringify([""], null, 2),
  sentences: JSON.stringify([""], null, 2),
  expressions: JSON.stringify(
    [{ expression: "", meaning: "", explanation: "", example: "" }],
    null,
    2
  ),
  quiz: JSON.stringify([{ question: "", answer: "", hint: "" }], null, 2),
  interview: JSON.stringify([""], null, 2),
  speakSentences: JSON.stringify([""], null, 2),
};

function seedVariantForms(
  initial: Record<string, unknown> | undefined
): Record<Level, VariantFormState> {
  const result: Record<Level, VariantFormState> = {
    beginner: { ...EMPTY_VARIANT },
    intermediate: { ...EMPTY_VARIANT },
    advanced: { ...EMPTY_VARIANT },
  };
  const vs = initial?.variants as VariantSeed[] | undefined;
  if (!Array.isArray(vs)) return result;
  for (const v of vs) {
    if (!LEVELS.includes(v.level)) continue;
    result[v.level] = {
      paragraphs: JSON.stringify(v.paragraphs ?? [""], null, 2),
      sentences: JSON.stringify(v.sentences ?? [""], null, 2),
      expressions: JSON.stringify(v.expressions ?? [], null, 2),
      quiz: JSON.stringify(v.quiz ?? [], null, 2),
      interview: JSON.stringify(v.interview ?? [""], null, 2),
      speakSentences: JSON.stringify(v.speakSentences ?? [""], null, 2),
    };
  }
  return result;
}

export function ContentForm({ initialData, contentId }: ContentFormProps) {
  const router = useRouter();
  const isEdit = !!contentId;

  const [topic, setTopic] = useState<TopicFormState>({
    genre: (initialData?.genre as string) || "",
    title: (initialData?.title as string) || "",
    subtitle: (initialData?.subtitle as string) || "",
    keyPhrase: (initialData?.keyPhrase as string) || "",
    keyKo: (initialData?.keyKo as string) || "",
    publishedAt: (initialData?.publishedAt as string)?.split("T")[0] || "",
    priority: String(initialData?.priority || 0),
    isActive: initialData?.isActive !== false,
  });

  const [variants, setVariants] = useState<Record<Level, VariantFormState>>(() =>
    seedVariantForms(initialData)
  );

  const [activeTab, setActiveTab] = useState<Level>("intermediate");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function updateTopic(key: keyof TopicFormState, value: string | boolean) {
    setTopic((t) => ({ ...t, [key]: value }));
  }

  function updateVariant(level: Level, key: keyof VariantFormState, value: string) {
    setVariants((prev) => ({
      ...prev,
      [level]: { ...prev[level], [key]: value },
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);

    const parsedVariants: {
      level: Level;
      paragraphs: unknown;
      sentences: unknown;
      expressions: unknown;
      quiz: unknown;
      interview: unknown;
      speakSentences: unknown;
    }[] = [];

    for (const level of LEVELS) {
      const v = variants[level];
      try {
        parsedVariants.push({
          level,
          paragraphs: JSON.parse(v.paragraphs),
          sentences: JSON.parse(v.sentences),
          expressions: JSON.parse(v.expressions),
          quiz: JSON.parse(v.quiz),
          interview: JSON.parse(v.interview),
          speakSentences: JSON.parse(v.speakSentences),
        });
      } catch {
        setActiveTab(level);
        setError(`${LEVEL_LABELS[level]} 탭의 JSON 형식이 올바르지 않습니다.`);
        setSaving(false);
        return;
      }
    }

    // Enforce all 6 fields present (server also validates)
    for (const pv of parsedVariants) {
      for (const field of VARIANT_FIELD_KEYS) {
        if (pv[field] === undefined) {
          setActiveTab(pv.level);
          setError(`${LEVEL_LABELS[pv.level]} 탭의 ${field} 가 비어 있습니다.`);
          setSaving(false);
          return;
        }
      }
    }

    const body = {
      genre: topic.genre,
      title: topic.title,
      subtitle: topic.subtitle || null,
      keyPhrase: topic.keyPhrase,
      keyKo: topic.keyKo,
      publishedAt: topic.publishedAt || null,
      priority: parseInt(topic.priority),
      isActive: topic.isActive,
      variants: parsedVariants,
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

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-[800px]">
      <ContentTopicFields state={topic} onChange={updateTopic} />

      <div>
        <div className="flex gap-1 border-b border-border-default mb-4">
          {LEVELS.map((lv) => (
            <button
              key={lv}
              type="button"
              onClick={() => setActiveTab(lv)}
              className={`px-4 py-2 text-body font-medium transition-colors border-b-2 -mb-px ${
                activeTab === lv
                  ? "text-text-primary border-brand-primary"
                  : "text-text-secondary border-transparent hover:text-text-primary"
              }`}
            >
              {LEVEL_LABELS[lv]}
            </button>
          ))}
        </div>

        <ContentVariantFields
          state={variants[activeTab]}
          onChange={(key, value) => updateVariant(activeTab, key, value)}
        />
      </div>

      {error && <p className="text-danger text-caption">{error}</p>}

      <Button type="submit" disabled={saving}>
        {saving ? "저장 중..." : isEdit ? "수정" : "생성"}
      </Button>
    </form>
  );
}

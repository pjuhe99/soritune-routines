"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { useLevel } from "@/contexts/level-context";

interface Content {
  id: number;
  title: string;
  subtitle: string;
  genre: string;
  keyPhrase: string;
  keyKo: string;
}

const STEPS = [
  { key: "reading", label: "읽기" },
  { key: "listening", label: "듣기" },
  { key: "expressions", label: "표현" },
  { key: "quiz", label: "퀴즈" },
  { key: "interview", label: "AI 인터뷰" },
  { key: "speaking", label: "말하기" },
];

export default function TodayPage() {
  const { level, ready } = useLevel();
  const [content, setContent] = useState<Content | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ready || !level) return;
    let cancelled = false;

    async function load() {
      try {
        const contentRes = await fetch(`/api/content/today?level=${level}`);
        if (contentRes.ok) {
          const contentData = await contentRes.json();
          if (!cancelled) {
            setContent(contentData);
            fetch("/api/events", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                type: "view",
                contentId: contentData.id,
                metadata: { level },
              }),
            }).catch(() => {});
          }
        } else if (!cancelled) {
          setContent(null);
        }
      } catch {
        if (!cancelled) setContent(null);
      }
      if (!cancelled) setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [level, ready]);

  if (!ready || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-text-secondary">로딩 중...</p>
      </div>
    );
  }

  if (!content) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-text-secondary">오늘의 콘텐츠가 아직 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="max-w-container mx-auto px-6 py-12">
      <div className="mb-10">
        <span className="text-caption font-semibold text-brand-primary tracking-[2px] uppercase">
          {content.genre}
        </span>
        <h1 className="text-display font-bold mt-2 mb-3">
          {content.title}
        </h1>
        {content.subtitle && (
          <p className="text-body text-text-secondary">
            {content.subtitle}
          </p>
        )}
        <Card variant="surface" className="mt-6 inline-block">
          <p className="text-body">
            <span className="text-brand-primary font-medium">
              {content.keyPhrase}
            </span>
            <span className="text-text-secondary ml-3">{content.keyKo}</span>
          </p>
        </Card>
      </div>

      <Link
        href={`/learn/${content.id}/reading`}
        className="block bg-brand-primary rounded-lg px-6 py-5 text-center text-text-inverse text-body font-semibold hover:bg-brand-primary-hover active:bg-brand-primary-active transition-colors"
      >
        시작하기
      </Link>

      <ol className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2 text-caption text-text-secondary">
        {STEPS.map((step, i) => (
          <li key={step.key} className="flex items-center gap-3">
            <span className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-bg-subtle text-caption text-text-tertiary">
                {i + 1}
              </span>
              <span>{step.label}</span>
            </span>
            {i < STEPS.length - 1 && (
              <span className="text-text-tertiary" aria-hidden="true">→</span>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

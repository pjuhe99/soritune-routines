"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { StepCard } from "@/components/step-card";
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
  { key: "reading", label: "읽기", description: "오늘의 콘텐츠를 읽어보세요" },
  { key: "listening", label: "듣기", description: "문장을 들어보세요" },
  { key: "expressions", label: "표현", description: "핵심 표현을 학습하세요" },
  { key: "quiz", label: "퀴즈", description: "배운 표현을 테스트하세요" },
  { key: "interview", label: "AI 인터뷰", description: "AI와 영어로 대화하세요" },
  { key: "speaking", label: "말하기", description: "직접 발음해보세요" },
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
        <p className="text-muted-silver">로딩 중...</p>
      </div>
    );
  }

  if (!content) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-silver">오늘의 콘텐츠가 아직 없습니다.</p>
      </div>
    );
  }

  function getStepStatus(index: number) {
    if (index === 0) return "active" as const;
    return "locked" as const;
  }

  return (
    <div className="max-w-container mx-auto px-6 py-12">
      <div className="mb-10">
        <span className="text-[12px] font-semibold text-framer-blue tracking-[2px] uppercase">
          {content.genre}
        </span>
        <h1 className="text-[62px] font-bold tracking-[-3.1px] leading-[1] mt-2 mb-3">
          {content.title}
        </h1>
        {content.subtitle && (
          <p className="text-[18px] text-muted-silver tracking-[-0.01px] leading-[1.6]">
            {content.subtitle}
          </p>
        )}
        <Card variant="surface" className="mt-6 inline-block">
          <p className="text-[15px]">
            <span className="text-framer-blue font-medium">
              {content.keyPhrase}
            </span>
            <span className="text-muted-silver ml-3">{content.keyKo}</span>
          </p>
        </Card>
      </div>

      <div className="grid gap-3">
        {STEPS.map((step, i) => (
          <StepCard
            key={step.key}
            label={step.label}
            description={step.description}
            status={getStepStatus(i)}
            href={i === 0 ? `/learn/${content.id}/${step.key}` : undefined}
          />
        ))}
      </div>
    </div>
  );
}

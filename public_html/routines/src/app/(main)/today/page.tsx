"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Card } from "@/components/ui/card";
import { StepCard } from "@/components/step-card";
import Link from "next/link";

interface Content {
  id: number;
  title: string;
  subtitle: string;
  genre: string;
  keyPhrase: string;
  keyKo: string;
}

interface Progress {
  step: string;
  completed: boolean;
  skipped: boolean;
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
  const { data: session } = useSession();
  const [content, setContent] = useState<Content | null>(null);
  const [progress, setProgress] = useState<Progress[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const contentRes = await fetch("/api/content/today");

        if (contentRes.ok) {
          const contentData = await contentRes.json();
          setContent(contentData);

          // Track view event
          fetch("/api/events", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: "view", contentId: contentData.id }),
          }).catch(() => {});

          // Progress API may not exist yet (Task 5) - handle gracefully
          try {
            const progressRes = await fetch("/api/progress");
            if (progressRes.ok) {
              const progressData = await progressRes.json();
              const contentProgress = progressData.filter(
                (p: Progress & { contentId: number }) =>
                  p.contentId === contentData.id
              );
              setProgress(contentProgress);
            }
          } catch {
            // Progress API not available yet - that's OK
          }
        }
      } catch {
        // Network error
      }
      setLoading(false);
    }

    if (session?.user) load();
    else setLoading(false);
  }, [session]);

  if (loading) {
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

  function getStepStatus(stepKey: string, index: number) {
    const p = progress.find((pr) => pr.step === stepKey);
    if (p?.completed) return "completed" as const;
    if (p?.skipped) return "skipped" as const;

    // First incomplete step is active
    const firstIncomplete = STEPS.findIndex((s) => {
      const sp = progress.find((pr) => pr.step === s.key);
      return !sp?.completed && !sp?.skipped;
    });

    if (index === firstIncomplete) return "active" as const;
    return "locked" as const;
  }

  const allDone = STEPS.every((s) => {
    const p = progress.find((pr) => pr.step === s.key);
    return p?.completed || p?.skipped;
  });

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
            status={allDone ? "completed" : getStepStatus(step.key, i)}
            href={
              getStepStatus(step.key, i) === "active"
                ? `/learn/${content!.id}/${step.key}`
                : undefined
            }
          />
        ))}
      </div>

      {allDone && (
        <div className="mt-8 text-center">
          <Link
            href={`/learn/${content.id}/complete`}
            className="inline-block bg-white text-black px-8 py-4 rounded-pill text-[15px] font-medium hover:opacity-90 transition-opacity"
          >
            오늘의 학습 완료!
          </Link>
        </div>
      )}
    </div>
  );
}

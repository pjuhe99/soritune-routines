"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { ContentLevel } from "@prisma/client";
import { parseLevel } from "@/lib/level";
import type { ProgressMap, LevelSummary } from "@/lib/progress";
import { LevelTabs } from "./level-tabs";
import { ProgressBar } from "./progress-bar";

interface Props {
  contentId: number;
}

interface Data {
  progress: ProgressMap;
  progressByLevel: Record<ContentLevel, LevelSummary>;
}

export function LearnTopBar({ contentId }: Props) {
  const searchParams = useSearchParams();
  const level = parseLevel(searchParams.get("level")) ?? "beginner";
  const [data, setData] = useState<Data | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [progressRes, summaryRes] = await Promise.all([
          fetch(`/api/progress/${contentId}?level=${level}`),
          fetch(`/api/progress/${contentId}/summary`),
        ]);
        if (cancelled || !progressRes.ok || !summaryRes.ok) return;
        const [progress, progressByLevel] = await Promise.all([
          progressRes.json(),
          summaryRes.json(),
        ]);
        if (cancelled) return;
        setData({ progress, progressByLevel });
      } catch {
        // Network error — leave data null (bar renders empty).
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [contentId, level]);

  return (
    <div className="sticky top-16 z-10 bg-bg-page/95 backdrop-blur-sm border-b border-border-default">
      <div className="max-w-[900px] mx-auto px-6 py-4 flex flex-col gap-4 min-h-[112px]">
        {data && (
          <>
            <LevelTabs
              contentId={contentId}
              currentLevel={level}
              progressByLevel={data.progressByLevel}
            />
            <ProgressBar
              contentId={contentId}
              level={level}
              progress={data.progress}
            />
          </>
        )}
      </div>
    </div>
  );
}

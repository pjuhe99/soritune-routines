"use client";

import { useRouter } from "next/navigation";
import type { ContentLevel } from "@prisma/client";
import { LEVELS, LEVEL_LABELS } from "@/lib/level";
import type { LevelSummary } from "@/lib/progress";

interface Props {
  contentId: number;
  currentLevel: ContentLevel;
  progressByLevel: Record<ContentLevel, LevelSummary>;
}

export function LevelTabs({ contentId, currentLevel, progressByLevel }: Props) {
  const router = useRouter();

  function jumpTo(target: ContentLevel) {
    if (target === currentLevel) return;
    const next = progressByLevel[target].nextStep;
    const segment = next === "complete" ? "complete" : next;
    router.push(`/learn/${contentId}/${segment}?level=${target}`);
  }

  return (
    <div role="tablist" aria-label="레벨 선택" className="flex gap-2">
      {LEVELS.map((lv) => {
        const active = lv === currentLevel;
        return (
          <button
            key={lv}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => jumpTo(lv)}
            className={
              "px-4 py-2 rounded-full text-[14px] font-medium transition-colors " +
              (active
                ? "bg-brand-primary text-text-inverse"
                : "bg-surface text-text-secondary border border-border-default hover:border-brand-primary")
            }
          >
            {LEVEL_LABELS[lv]}
          </button>
        );
      })}
    </div>
  );
}

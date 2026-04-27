import type { ContentLevel } from "@prisma/client";
import type { ProgressMap, LevelSummary } from "@/lib/progress";
import { LevelTabs } from "./level-tabs";
import { ProgressBar } from "./progress-bar";

interface Props {
  contentId: number;
  currentLevel: ContentLevel;
  progress: ProgressMap;
  progressByLevel: Record<ContentLevel, LevelSummary>;
}

export function LearnTopBar({
  contentId,
  currentLevel,
  progress,
  progressByLevel,
}: Props) {
  return (
    <div className="sticky top-16 z-10 bg-bg-page/95 backdrop-blur-sm border-b border-border-default">
      <div className="max-w-[900px] mx-auto px-6 py-4 flex flex-col gap-4">
        <LevelTabs
          contentId={contentId}
          currentLevel={currentLevel}
          progressByLevel={progressByLevel}
        />
        <ProgressBar
          contentId={contentId}
          level={currentLevel}
          progress={progress}
        />
      </div>
    </div>
  );
}

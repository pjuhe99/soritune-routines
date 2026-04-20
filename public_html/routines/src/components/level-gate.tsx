"use client";

import { ReactNode } from "react";
import { useLevel } from "@/contexts/level-context";
import { LEVELS, LEVEL_LABELS, LEVEL_DESCRIPTIONS } from "@/lib/level";

export function LevelGate({ children }: { children: ReactNode }) {
  const { level, setLevel, ready } = useLevel();

  if (!ready) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-silver text-[14px]">로딩 중...</p>
      </div>
    );
  }

  if (level === null) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-void-black/95 backdrop-blur-sm px-6">
        <div className="w-full max-w-[480px] bg-near-black border border-white/10 rounded-2xl p-8 shadow-ring-blue">
          <h1 className="text-[24px] font-semibold tracking-[-0.5px] text-white mb-2">
            영어 레벨을 선택해주세요
          </h1>
          <p className="text-[14px] text-muted-silver leading-[1.6] mb-6">
            선택한 레벨에 맞춰 매일의 학습 콘텐츠를 보여드립니다.
          </p>
          <div className="flex flex-col gap-3">
            {LEVELS.map((lv) => (
              <button
                key={lv}
                type="button"
                onClick={() => setLevel(lv)}
                className="flex items-center justify-between rounded-xl border border-white/10 bg-void-black/60 px-5 py-4 text-left transition-colors hover:border-framer-blue hover:bg-white/5"
              >
                <span className="text-[18px] font-medium text-white">{LEVEL_LABELS[lv]}</span>
                <span className="text-[13px] text-muted-silver">{LEVEL_DESCRIPTIONS[lv]}</span>
              </button>
            ))}
          </div>
          <p className="mt-6 text-[12px] text-muted-silver text-center">
            언제든 상단에서 변경할 수 있습니다
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

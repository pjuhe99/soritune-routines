"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LearningStep, ContentLevel } from "@prisma/client";
import { STEP_ORDER, type ProgressMap, isStepDone } from "@/lib/progress";

const STEP_LABELS: Record<LearningStep, string> = {
  reading: "읽기",
  listening: "듣기",
  expressions: "표현",
  quiz: "퀴즈",
  interview: "인터뷰",
  speaking: "말하기",
};

interface Props {
  contentId: number;
  level: ContentLevel;
  progress: ProgressMap;
}

function getCurrentStep(pathname: string): LearningStep | "complete" | null {
  // /learn/[id]/{step}
  const segments = pathname.split("/").filter(Boolean);
  const idx = segments.findIndex((s) => s === "learn");
  const step = segments[idx + 2];
  if (step === "complete") return "complete";
  return (STEP_ORDER as readonly string[]).includes(step) ? (step as LearningStep) : null;
}

export function ProgressBar({ contentId, level, progress }: Props) {
  const pathname = usePathname();
  const currentStep = getCurrentStep(pathname);

  return (
    <div aria-label="학습 진행 상태">
      <ol className="grid grid-cols-6 gap-1.5">
        {STEP_ORDER.map((step) => {
          const state = progress[step];
          const done = isStepDone(state);
          const isCurrent = currentStep === step;
          const tone =
            isCurrent
              ? "bg-brand-primary"
              : done
              ? "bg-emerald-500"
              : "bg-bg-subtle";
          const cell = (
            <span
              className={`block h-2 rounded-full transition-colors ${tone}`}
              aria-hidden="true"
            />
          );
          const labelTone =
            isCurrent
              ? "text-brand-primary font-semibold"
              : done
              ? "text-emerald-600"
              : "text-text-tertiary";
          const wrap = (
            <li className="flex flex-col gap-1.5 min-w-0">
              {cell}
              <span className={`text-[11px] text-center truncate ${labelTone}`}>
                {STEP_LABELS[step]}
              </span>
            </li>
          );
          if (done && !isCurrent) {
            return (
              <Link
                key={step}
                href={`/learn/${contentId}/${step}?level=${level}`}
                className="block"
                aria-label={`${STEP_LABELS[step]} 단계 복습`}
              >
                {wrap}
              </Link>
            );
          }
          return <div key={step}>{wrap}</div>;
        })}
      </ol>
    </div>
  );
}

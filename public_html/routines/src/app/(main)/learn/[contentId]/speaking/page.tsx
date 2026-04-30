"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { RecordingStudio } from "@/components/learning/recording-studio";
import { parseLevel } from "@/lib/level";
import { L } from "@/lib/labels";

export default function SpeakingPage() {
  const params = useParams();
  const router = useRouter();
  const contentId = params.contentId as string;
  const searchParams = useSearchParams();
  const level = parseLevel(searchParams.get("level")) ?? "beginner";

  async function handleComplete() {
    await fetch(`/api/progress/${contentId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: "speaking", level }),
    }).catch(() => undefined);
    router.push(`/learn/${contentId}/complete?level=${level}`);
  }

  async function handleSkip() {
    await fetch(`/api/progress/${contentId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: "speaking", level, skipped: true }),
    }).catch(() => undefined);
    router.push(`/learn/${contentId}/complete?level=${level}`);
  }

  return (
    <div className="max-w-[800px] mx-auto px-6 py-12">
      <span className="text-caption font-semibold text-brand-primary uppercase">
        {L.step.captionSpeaking}
      </span>
      <h2 className="text-headline font-semibold mt-2 mb-8">
        녹음하기
      </h2>

      <RecordingStudio
        contentId={contentId}
        level={level}
        onComplete={handleComplete}
        onSkip={handleSkip}
      />
    </div>
  );
}

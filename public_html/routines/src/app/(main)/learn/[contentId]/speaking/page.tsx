"use client";

import { useParams, useRouter } from "next/navigation";
import { RecordingStudio } from "@/components/learning/recording-studio";

export default function SpeakingPage() {
  const params = useParams();
  const router = useRouter();
  const contentId = params.contentId as string;

  async function handleComplete() {
    await fetch(`/api/progress/${contentId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: "speaking" }),
    }).catch(() => undefined);
    router.push(`/learn/${contentId}/complete`);
  }

  async function handleSkip() {
    await fetch(`/api/progress/${contentId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: "speaking", skipped: true }),
    }).catch(() => undefined);
    router.push(`/learn/${contentId}/complete`);
  }

  return (
    <div className="max-w-[800px] mx-auto px-6 py-12">
      <span className="text-caption font-semibold text-brand-primary uppercase">
        Step 6 · Recording
      </span>
      <h2 className="text-headline font-semibold mt-2 mb-8">
        녹음하기
      </h2>

      <RecordingStudio
        contentId={contentId}
        onComplete={handleComplete}
        onSkip={handleSkip}
      />
    </div>
  );
}

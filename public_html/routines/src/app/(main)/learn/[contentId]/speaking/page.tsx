"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { SpeakingRecorder } from "@/components/learning/speaking-recorder";
import { useLevel } from "@/contexts/level-context";

export default function SpeakingPage() {
  const params = useParams();
  const router = useRouter();
  const contentId = params.contentId as string;
  const { level, ready } = useLevel();
  const [sentences, setSentences] = useState<string[]>([]);

  useEffect(() => {
    if (!ready || !level) return;
    let cancelled = false;
    fetch(`/api/content/${contentId}?level=${level}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setSentences(data.speakSentences);
      });
    return () => {
      cancelled = true;
    };
  }, [contentId, level, ready]);

  function handleComplete() {
    router.push(`/learn/${contentId}/complete`);
  }

  function handleSkip() {
    router.push(`/learn/${contentId}/complete`);
  }

  if (!sentences.length) return <div className="p-6 text-muted-silver">Loading...</div>;

  return (
    <div className="max-w-[800px] mx-auto px-6 py-12">
      <span className="text-[12px] font-semibold text-framer-blue tracking-[2px] uppercase">
        Step 6 · Speaking
      </span>
      <h2 className="text-[32px] font-semibold tracking-[-1px] leading-[1.13] mt-2 mb-8">
        Practice pronunciation
      </h2>

      <SpeakingRecorder
        sentences={sentences}
        onComplete={handleComplete}
        onSkip={handleSkip}
      />
    </div>
  );
}

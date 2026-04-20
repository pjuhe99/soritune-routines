"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { SpeakingRecorder } from "@/components/learning/speaking-recorder";

export default function SpeakingPage() {
  const params = useParams();
  const router = useRouter();
  const contentId = params.contentId as string;
  const [sentences, setSentences] = useState<string[]>([]);

  useEffect(() => {
    fetch(`/api/content/${contentId}`)
      .then((r) => r.json())
      .then((data) => setSentences(data.speakSentences));
  }, [contentId]);

  function handleComplete(_score: number) {
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

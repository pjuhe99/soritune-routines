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

  async function handleComplete(score: number) {
    const res = await fetch(`/api/progress/${contentId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: "speaking", score }),
    });
    const data = await res.json();
    if (data.allDone) {
      router.push(`/learn/${contentId}/complete`);
    } else {
      router.push(`/today`);
    }
  }

  async function handleSkip() {
    const res = await fetch(`/api/progress/${contentId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: "speaking", skipped: true }),
    });
    const data = await res.json();
    if (data.allDone) {
      router.push(`/learn/${contentId}/complete`);
    } else {
      router.push(`/today`);
    }
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

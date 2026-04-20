"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSpeech } from "@/contexts/speech-context";
import { ListeningPlayer } from "@/components/learning/listening-player";
import { Button } from "@/components/ui/button";
import { useLevel } from "@/contexts/level-context";

export default function ListeningPage() {
  const params = useParams();
  const router = useRouter();
  const contentId = params.contentId as string;
  const { ttsAvailable } = useSpeech();
  const { level, ready } = useLevel();
  const [sentences, setSentences] = useState<string[]>([]);

  useEffect(() => {
    if (!ready || !level) return;
    let cancelled = false;
    fetch(`/api/content/${contentId}?level=${level}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setSentences(data.sentences);
      });
    return () => {
      cancelled = true;
    };
  }, [contentId, level, ready]);

  function handleComplete() {
    router.push(`/learn/${contentId}/expressions`);
  }

  if (!sentences.length) return <div className="p-6 text-muted-silver">Loading...</div>;

  return (
    <div className="max-w-[800px] mx-auto px-6 py-12">
      <span className="text-[12px] font-semibold text-framer-blue tracking-[2px] uppercase">
        Step 2 · Listening
      </span>
      <h2 className="text-[32px] font-semibold tracking-[-1px] leading-[1.13] mt-2 mb-8">
        Listen to the sentences
      </h2>

      <ListeningPlayer sentences={sentences} />

      <div className="mt-10 flex justify-end gap-3">
        {!ttsAvailable && (
          <Button variant="ghost" onClick={handleComplete}>
            Skip
          </Button>
        )}
        <Button onClick={handleComplete}>Next: Expressions</Button>
      </div>
    </div>
  );
}

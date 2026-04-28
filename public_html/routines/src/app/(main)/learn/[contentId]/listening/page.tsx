"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useSpeech } from "@/contexts/speech-context";
import { ListeningPlayer } from "@/components/learning/listening-player";
import { Button } from "@/components/ui/button";
import { parseLevel } from "@/lib/level";

export default function ListeningPage() {
  const params = useParams();
  const router = useRouter();
  const contentId = params.contentId as string;
  const { ttsAvailable } = useSpeech();
  const searchParams = useSearchParams();
  const level = parseLevel(searchParams.get("level")) ?? "beginner";
  const [sentences, setSentences] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/content/${contentId}?level=${level}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setSentences(data.sentences);
      });
    return () => {
      cancelled = true;
    };
  }, [contentId, level]);

  async function handleComplete() {
    await fetch(`/api/progress/${contentId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: "listening", level }),
    }).catch(() => {});
    router.push(`/learn/${contentId}/expressions?level=${level}`);
  }

  if (!sentences.length) return <div className="p-6 text-text-secondary">Loading...</div>;

  return (
    <div className="max-w-[800px] mx-auto px-6 py-12">
      <span className="text-caption font-semibold text-brand-primary uppercase">
        Step 2 · Listening
      </span>
      <h2 className="text-headline font-semibold mt-2 mb-8">
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

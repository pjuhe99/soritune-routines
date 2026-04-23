"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ReadingView } from "@/components/learning/reading-view";
import { Button } from "@/components/ui/button";
import { useLevel } from "@/contexts/level-context";

interface Content {
  id: number;
  title: string;
  paragraphs: string[];
  keyPhrase: string;
  keyKo: string;
}

export default function ReadingPage() {
  const params = useParams();
  const router = useRouter();
  const contentId = params.contentId as string;
  const { level, ready } = useLevel();
  const [content, setContent] = useState<Content | null>(null);

  useEffect(() => {
    if (!ready || !level) return;
    let cancelled = false;
    fetch(`/api/content/${contentId}?level=${level}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setContent(d);
      });
    return () => {
      cancelled = true;
    };
  }, [contentId, level, ready]);

  function handleComplete() {
    router.push(`/learn/${contentId}/listening`);
  }

  if (!content) return <div className="p-6 text-text-secondary">Loading...</div>;

  return (
    <div className="max-w-[800px] mx-auto px-6 py-12">
      <span className="text-caption font-semibold text-brand-primary uppercase">
        Step 1 · Reading
      </span>
      <h1 className="text-headline font-semibold mt-2 mb-8">
        {content.title}
      </h1>

      <ReadingView paragraphs={content.paragraphs} keyPhrase={content.keyPhrase} />

      <div className="mt-6 bg-surface border border-border-default rounded-lg p-4">
        <p className="text-body">
          <span className="text-text-brand-brown font-semibold">{content.keyPhrase}</span>
          <span className="text-text-secondary ml-3">{content.keyKo}</span>
        </p>
      </div>

      <div className="mt-10 flex justify-end">
        <Button onClick={handleComplete}>Next: Listening</Button>
      </div>
    </div>
  );
}

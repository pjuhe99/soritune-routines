"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ReadingView } from "@/components/learning/reading-view";
import { Button } from "@/components/ui/button";
import { parseLevel } from "@/lib/level";
import type { Expression } from "@/lib/expression-matching";

interface Content {
  id: number;
  title: string;
  paragraphs: string[];
  expressions: Expression[];
}

export default function ReadingPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const contentId = params.contentId as string;
  const level = parseLevel(searchParams.get("level")) ?? "beginner";
  const [content, setContent] = useState<Content | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/content/${contentId}?level=${level}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setContent(d);
      });
    return () => {
      cancelled = true;
    };
  }, [contentId, level]);

  async function handleComplete() {
    await fetch(`/api/progress/${contentId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: "reading", level }),
    }).catch(() => {});
    router.push(`/learn/${contentId}/listening?level=${level}`);
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

      <ReadingView paragraphs={content.paragraphs} expressions={content.expressions ?? []} />

      <div className="mt-10 flex justify-end">
        <Button onClick={handleComplete}>Next: Listening</Button>
      </div>
    </div>
  );
}

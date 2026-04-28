"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { InterviewChat } from "@/components/learning/interview-chat";
import { parseLevel } from "@/lib/level";

export default function InterviewPage() {
  const params = useParams();
  const router = useRouter();
  const contentId = params.contentId as string;
  const searchParams = useSearchParams();
  const level = parseLevel(searchParams.get("level")) ?? "beginner";
  const [questions, setQuestions] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/content/${contentId}?level=${level}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setQuestions(data.interview);
      });
    return () => {
      cancelled = true;
    };
  }, [contentId, level]);

  async function handleComplete() {
    await fetch(`/api/progress/${contentId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: "interview", level }),
    }).catch(() => {});
    router.push(`/learn/${contentId}/speaking?level=${level}`);
  }

  if (!questions.length) return <div className="p-6 text-text-secondary">Loading...</div>;

  return (
    <div className="max-w-[800px] mx-auto px-6 py-12">
      <span className="text-caption font-semibold text-brand-primary uppercase">
        Step 5 · AI Interview
      </span>
      <h2 className="text-headline font-semibold mt-2 mb-8">
        Practice with AI
      </h2>

      <InterviewChat
        questions={questions}
        contentId={contentId}
        level={level}
        onComplete={handleComplete}
      />
    </div>
  );
}

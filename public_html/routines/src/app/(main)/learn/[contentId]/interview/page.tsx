"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { InterviewChat } from "@/components/learning/interview-chat";
import { useLevel } from "@/contexts/level-context";

export default function InterviewPage() {
  const params = useParams();
  const router = useRouter();
  const contentId = params.contentId as string;
  const { level, ready } = useLevel();
  const [questions, setQuestions] = useState<string[]>([]);

  useEffect(() => {
    if (!ready || !level) return;
    let cancelled = false;
    fetch(`/api/content/${contentId}?level=${level}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setQuestions(data.interview);
      });
    return () => {
      cancelled = true;
    };
  }, [contentId, level, ready]);

  function handleComplete() {
    router.push(`/learn/${contentId}/speaking`);
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
        onComplete={handleComplete}
      />
    </div>
  );
}

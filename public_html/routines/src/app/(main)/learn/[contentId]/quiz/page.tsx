"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { QuizForm } from "@/components/learning/quiz-form";
import { useLevel } from "@/contexts/level-context";

interface QuizItem {
  question: string;
  answer: string;
  options: string[];
  hint: string;
}

export default function QuizPage() {
  const params = useParams();
  const router = useRouter();
  const contentId = params.contentId as string;
  const { level, ready } = useLevel();
  const [quiz, setQuiz] = useState<QuizItem[]>([]);

  useEffect(() => {
    if (!ready || !level) return;
    let cancelled = false;
    fetch(`/api/content/${contentId}?level=${level}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setQuiz(data.quiz);
      });
    return () => {
      cancelled = true;
    };
  }, [contentId, level, ready]);

  function handleComplete() {
    router.push(`/learn/${contentId}/interview`);
  }

  if (!quiz.length) return <div className="p-6 text-text-secondary">Loading...</div>;

  return (
    <div className="max-w-[800px] mx-auto px-6 py-12">
      <span className="text-caption font-semibold text-brand-primary uppercase">
        Step 4 · Quiz
      </span>
      <h2 className="text-headline font-semibold mt-2 mb-8">
        Test what you learned
      </h2>

      <QuizForm items={quiz} onComplete={handleComplete} />
    </div>
  );
}

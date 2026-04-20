"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { QuizForm } from "@/components/learning/quiz-form";

interface QuizItem {
  question: string;
  answer: string;
  hint: string;
}

export default function QuizPage() {
  const params = useParams();
  const router = useRouter();
  const contentId = params.contentId as string;
  const [quiz, setQuiz] = useState<QuizItem[]>([]);

  useEffect(() => {
    fetch(`/api/content/${contentId}?level=intermediate`)
      .then((r) => r.json())
      .then((data) => setQuiz(data.quiz));
  }, [contentId]);

  function handleComplete() {
    router.push(`/learn/${contentId}/interview`);
  }

  if (!quiz.length) return <div className="p-6 text-muted-silver">Loading...</div>;

  return (
    <div className="max-w-[800px] mx-auto px-6 py-12">
      <span className="text-[12px] font-semibold text-framer-blue tracking-[2px] uppercase">
        Step 4 · Quiz
      </span>
      <h2 className="text-[32px] font-semibold tracking-[-1px] leading-[1.13] mt-2 mb-8">
        Test what you learned
      </h2>

      <QuizForm items={quiz} onComplete={handleComplete} />
    </div>
  );
}

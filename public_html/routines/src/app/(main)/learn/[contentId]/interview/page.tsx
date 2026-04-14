"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { InterviewChat } from "@/components/learning/interview-chat";

export default function InterviewPage() {
  const params = useParams();
  const router = useRouter();
  const contentId = params.contentId as string;
  const [questions, setQuestions] = useState<string[]>([]);

  useEffect(() => {
    fetch(`/api/content/${contentId}`)
      .then((r) => r.json())
      .then((data) => setQuestions(data.interview));
  }, [contentId]);

  async function handleComplete() {
    await fetch(`/api/progress/${contentId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: "interview" }),
    });
    router.push(`/learn/${contentId}/speaking`);
  }

  if (!questions.length) return <div className="p-6 text-muted-silver">Loading...</div>;

  return (
    <div className="max-w-[800px] mx-auto px-6 py-12">
      <span className="text-[12px] font-semibold text-framer-blue tracking-[2px] uppercase">
        Step 5 · AI Interview
      </span>
      <h2 className="text-[32px] font-semibold tracking-[-1px] leading-[1.13] mt-2 mb-8">
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

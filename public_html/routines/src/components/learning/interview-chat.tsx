"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface InterviewChatProps {
  questions: string[];
  contentId: string;
  onComplete: () => void;
}

interface Feedback {
  relevance: string;
  grammar: string;
  nativeExpression: string;
  encouragement: string;
}

export function InterviewChat({ questions, contentId, onComplete }: InterviewChatProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [loading, setLoading] = useState(false);

  const isLast = currentIndex === questions.length - 1;

  async function handleSubmit() {
    setLoading(true);
    setFeedback(null);

    try {
      const res = await fetch("/api/ai/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentId: parseInt(contentId),
          question: questions[currentIndex],
          answer,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setFeedback(data.feedback);
      } else {
        setFeedback({
          relevance: "Feedback is currently unavailable.",
          grammar: "",
          nativeExpression: "",
          encouragement: "Please move on to the next question.",
        });
      }
    } catch {
      setFeedback({
        relevance: "Feedback is currently unavailable.",
        grammar: "",
        nativeExpression: "",
        encouragement: "Please move on to the next question.",
      });
    }

    setLoading(false);
  }

  function handleNext() {
    if (isLast) {
      onComplete();
      return;
    }
    setCurrentIndex((i) => i + 1);
    setAnswer("");
    setFeedback(null);
  }

  return (
    <div>
      <div className="mb-2 text-[13px] text-muted-silver">
        {currentIndex + 1} / {questions.length}
      </div>

      <div className="bg-near-black shadow-ring-blue rounded-xl p-6 mb-6">
        <p className="text-[18px] text-white leading-[1.6]">{questions[currentIndex]}</p>
      </div>

      {!feedback ? (
        <div className="space-y-4">
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Write your answer in English..."
            className="w-full bg-near-black border border-white/10 rounded-xl px-4 py-3 text-[15px] text-white leading-[1.6] placeholder:text-white/40 focus:border-framer-blue focus:outline-none min-h-[120px] resize-none"
          />
          <Button onClick={handleSubmit} disabled={!answer.trim() || loading}>
            {loading ? "Analyzing..." : "Submit"}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {feedback.relevance && (
            <div className="bg-near-black rounded-xl p-4">
              <p className="text-[13px] text-framer-blue font-medium mb-1">Relevance</p>
              <p className="text-[14px] text-white/80 leading-[1.6]">{feedback.relevance}</p>
            </div>
          )}
          {feedback.grammar && (
            <div className="bg-near-black rounded-xl p-4">
              <p className="text-[13px] text-framer-blue font-medium mb-1">Grammar</p>
              <p className="text-[14px] text-white/80 leading-[1.6]">{feedback.grammar}</p>
            </div>
          )}
          {feedback.nativeExpression && (
            <div className="bg-near-black rounded-xl p-4">
              <p className="text-[13px] text-framer-blue font-medium mb-1">Native Expression</p>
              <p className="text-[14px] text-white/80 leading-[1.6]">{feedback.nativeExpression}</p>
            </div>
          )}
          {feedback.encouragement && (
            <div className="bg-green-500/5 border border-green-500/10 rounded-xl p-4">
              <p className="text-[14px] text-green-300 leading-[1.6]">{feedback.encouragement}</p>
            </div>
          )}
          <Button onClick={handleNext}>
            {isLast ? "Done" : "Next Question"}
          </Button>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useLevel } from "@/contexts/level-context";

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

interface AIResponse {
  feedback: Feedback;
  recommendedSentence: string;
}

const FALLBACK: AIResponse = {
  feedback: {
    relevance: "지금은 피드백을 가져올 수 없어요.",
    grammar: "",
    nativeExpression: "",
    encouragement: "괜찮아요. 다음 질문으로 넘어가세요.",
  },
  recommendedSentence: "",
};

export function InterviewChat({ questions, contentId, onComplete }: InterviewChatProps) {
  const { level } = useLevel();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [response, setResponse] = useState<AIResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const isLast = currentIndex === questions.length - 1;

  async function handleSubmit() {
    if (!level) return;
    setLoading(true);
    setResponse(null);

    try {
      const res = await fetch("/api/ai/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentId: parseInt(contentId),
          questionIndex: currentIndex,
          level,
          question: questions[currentIndex],
          answer,
        }),
      });

      if (res.ok) {
        setResponse(await res.json() as AIResponse);
      } else {
        setResponse(FALLBACK);
      }
    } catch {
      setResponse(FALLBACK);
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
    setResponse(null);
  }

  function handleSkip() {
    if (isLast) {
      onComplete();
      return;
    }
    setCurrentIndex((i) => i + 1);
    setAnswer("");
    setResponse(null);
  }

  return (
    <div>
      <div className="mb-2 text-[13px] text-muted-silver">
        {currentIndex + 1} / {questions.length}
      </div>

      <div className="bg-near-black shadow-ring-blue rounded-xl p-6 mb-6">
        <p className="text-[18px] text-white leading-[1.6]">{questions[currentIndex]}</p>
      </div>

      {!response ? (
        <div className="space-y-4">
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="영어로 답변을 작성해주세요..."
            className="w-full bg-near-black border border-white/10 rounded-xl px-4 py-3 text-[15px] text-white leading-[1.6] placeholder:text-white/40 focus:border-framer-blue focus:outline-none min-h-[120px] resize-none"
          />
          <div className="flex gap-3">
            <Button onClick={handleSubmit} disabled={!answer.trim() || loading || !level}>
              {loading ? "분석 중..." : "제출"}
            </Button>
            <Button variant="ghost" onClick={handleSkip} disabled={loading}>
              이 질문 건너뛰기
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {response.feedback.relevance && (
            <div className="bg-near-black rounded-xl p-4">
              <p className="text-[13px] text-framer-blue font-medium mb-1">연관성</p>
              <p className="text-[14px] text-white/80 leading-[1.6]">{response.feedback.relevance}</p>
            </div>
          )}
          {response.feedback.grammar && (
            <div className="bg-near-black rounded-xl p-4">
              <p className="text-[13px] text-framer-blue font-medium mb-1">문법</p>
              <p className="text-[14px] text-white/80 leading-[1.6]">{response.feedback.grammar}</p>
            </div>
          )}
          {response.feedback.nativeExpression && (
            <div className="bg-near-black rounded-xl p-4">
              <p className="text-[13px] text-framer-blue font-medium mb-1">자연스러운 표현</p>
              <p className="text-[14px] text-white/80 leading-[1.6]">{response.feedback.nativeExpression}</p>
            </div>
          )}
          {response.feedback.encouragement && (
            <div className="bg-green-500/5 border border-green-500/10 rounded-xl p-4">
              <p className="text-[14px] text-green-300 leading-[1.6]">{response.feedback.encouragement}</p>
            </div>
          )}
          {response.recommendedSentence && (
            <div className="bg-framer-blue/10 border border-framer-blue/30 rounded-xl p-4">
              <p className="text-[13px] text-framer-blue font-medium mb-2">🎤 녹음할 추천 문장</p>
              <p className="text-[15px] text-white leading-[1.6]">{response.recommendedSentence}</p>
            </div>
          )}
          <Button onClick={handleNext}>
            {isLast ? "녹음하러 가기" : "다음 질문"}
          </Button>
        </div>
      )}
    </div>
  );
}

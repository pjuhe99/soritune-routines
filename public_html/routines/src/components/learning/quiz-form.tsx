"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";

interface QuizItem {
  question: string;
  answer: string;
  hint: string;
}

interface QuizFormProps {
  items: QuizItem[];
  onComplete: (score: number) => void;
}

export function QuizForm({ items, onComplete }: QuizFormProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState("");
  const [showResult, setShowResult] = useState(false);
  const [correct, setCorrect] = useState(0);
  const [isCorrect, setIsCorrect] = useState(false);

  const current = items[currentIndex];
  const isLast = currentIndex === items.length - 1;

  function handleCheck() {
    const match =
      userAnswer.trim().toLowerCase() === current.answer.toLowerCase();
    setIsCorrect(match);
    if (match) setCorrect((c) => c + 1);
    setShowResult(true);
  }

  function handleNext() {
    if (isLast) {
      const finalCorrect = correct;
      const score = Math.round((finalCorrect / items.length) * 100);
      onComplete(score);
      return;
    }
    setCurrentIndex((i) => i + 1);
    setUserAnswer("");
    setShowResult(false);
    setIsCorrect(false);
  }

  // Render question with blank
  const parts = current.question.split("_____");

  return (
    <div>
      <div className="mb-2 text-[13px] text-muted-silver">
        {currentIndex + 1} / {items.length}
      </div>

      <div className="bg-near-black shadow-ring-blue rounded-xl p-6 mb-6">
        <p className="text-[18px] text-white leading-[1.6]">
          {parts[0]}
          <span className="text-framer-blue border-b-2 border-framer-blue px-1">
            {showResult ? current.answer : "______"}
          </span>
          {parts[1]}
        </p>
        {!showResult && (
          <p className="text-[13px] text-muted-silver mt-3">Hint: {current.hint}</p>
        )}
      </div>

      {!showResult ? (
        <div className="flex gap-3">
          <Input
            value={userAnswer}
            onChange={(e) => setUserAnswer(e.target.value)}
            placeholder="Type your answer"
            onKeyDown={(e) => e.key === "Enter" && userAnswer.trim() && handleCheck()}
            className="flex-1"
          />
          <button
            onClick={handleCheck}
            disabled={!userAnswer.trim()}
            className="bg-white text-black px-6 py-3 rounded-pill text-[15px] font-medium disabled:opacity-50 transition-opacity"
          >
            Check
          </button>
        </div>
      ) : (
        <div>
          <div
            className={`rounded-xl p-4 mb-4 ${
              isCorrect
                ? "bg-green-500/10 border border-green-500/20"
                : "bg-red-500/10 border border-red-500/20"
            }`}
          >
            <p className={`text-[15px] font-medium ${isCorrect ? "text-green-400" : "text-red-400"}`}>
              {isCorrect ? "Correct!" : `Wrong — Answer: ${current.answer}`}
            </p>
          </div>
          <button
            onClick={handleNext}
            className="bg-white text-black px-6 py-3 rounded-pill text-[15px] font-medium hover:opacity-90 transition-opacity"
          >
            {isLast ? "Done" : "Next"}
          </button>
        </div>
      )}
    </div>
  );
}

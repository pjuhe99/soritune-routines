"use client";

import { useState } from "react";

interface QuizItem {
  question: string;
  answer: string;
  options: string[];
  hint: string;
}

interface QuizFormProps {
  items: QuizItem[];
  onComplete: (score: number) => void;
}

export function QuizForm({ items, onComplete }: QuizFormProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [correct, setCorrect] = useState(0);

  const current = items[currentIndex];
  const isLast = currentIndex === items.length - 1;
  const isCorrect = selectedOption !== null && selectedOption === current.answer;

  function handleSelect(option: string) {
    if (showResult) return;
    setSelectedOption(option);
    setShowResult(true);
    if (option === current.answer) setCorrect((c) => c + 1);
  }

  function handleNext() {
    if (isLast) {
      onComplete(Math.round((correct / items.length) * 100));
      return;
    }
    setCurrentIndex((i) => i + 1);
    setSelectedOption(null);
    setShowHint(false);
    setShowResult(false);
  }

  // Split question on "______" (6 underscores). Legacy data may use more/fewer — fall back gracefully.
  const blank = current.question.includes("______") ? "______" : "_____";
  const parts = current.question.split(blank);
  const blankDisplay = showResult ? current.answer : "______";

  return (
    <div>
      <div className="mb-2 text-caption text-text-secondary">
        {currentIndex + 1} / {items.length}
      </div>

      <div className="bg-surface border border-border-default rounded-lg p-6 mb-6">
        <p className="text-[18px] text-text-primary leading-[1.6]">
          {parts[0]}
          <span className="text-brand-primary border-b-2 border-brand-primary px-1">
            {blankDisplay}
          </span>
          {parts.slice(1).join(blank)}
        </p>

        {!showResult && current.hint && (
          <div className="mt-4">
            {showHint ? (
              <p className="text-caption text-brand-primary leading-[1.6]">
                💡 {current.hint}
              </p>
            ) : (
              <button
                onClick={() => setShowHint(true)}
                className="text-caption text-text-secondary hover:text-text-primary underline underline-offset-2"
              >
                힌트 보기
              </button>
            )}
          </div>
        )}
      </div>

      <div className="grid gap-2 mb-6">
        {current.options.map((option) => {
          const isSelected = selectedOption === option;
          const isAnswer = option === current.answer;
          const showCorrect = showResult && isAnswer;
          const showWrong = showResult && isSelected && !isAnswer;
          const base =
            "text-left w-full rounded-xl px-5 py-4 text-[15px] transition-colors border";
          const state = showCorrect
            ? "bg-bg-subtle border-success text-success"
            : showWrong
              ? "bg-bg-subtle border-danger text-danger"
              : showResult
                ? "bg-surface border-border-default text-text-tertiary"
                : "bg-surface border-border-default text-text-primary hover:border-brand-primary";
          return (
            <button
              key={option}
              onClick={() => handleSelect(option)}
              disabled={showResult}
              className={`${base} ${state}`}
            >
              {option}
              {showCorrect && <span className="ml-2">✓</span>}
              {showWrong && <span className="ml-2">✗</span>}
            </button>
          );
        })}
      </div>

      {showResult && (
        <div>
          <div
            className={`rounded-lg p-4 mb-4 border ${
              isCorrect
                ? "bg-bg-subtle border-success"
                : "bg-bg-subtle border-danger"
            }`}
          >
            <p
              className={`text-body font-medium ${
                isCorrect ? "text-success" : "text-danger"
              }`}
            >
              {isCorrect ? "정답입니다!" : `오답 — 정답: ${current.answer}`}
            </p>
          </div>
          <button
            onClick={handleNext}
            className="bg-brand-primary text-text-inverse px-6 py-3 rounded-md text-body font-medium hover:opacity-90 transition-opacity"
          >
            {isLast ? "완료" : "다음"}
          </button>
        </div>
      )}
    </div>
  );
}

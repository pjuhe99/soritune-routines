"use client";

import { useSpeech } from "@/contexts/speech-context";

interface Expression {
  expression: string;
  meaning: string;
  explanation: string;
  example: string;
}

interface ExpressionListProps {
  expressions: Expression[];
}

export function ExpressionList({ expressions }: ExpressionListProps) {
  const { ttsAvailable } = useSpeech();

  function speak(text: string) {
    if (!ttsAvailable) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    u.rate = 0.9;
    window.speechSynthesis.speak(u);
  }

  return (
    <div className="space-y-4">
      {expressions.map((exp, i) => (
        <div key={i} className="bg-near-black shadow-ring-blue rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[20px] font-semibold text-framer-blue tracking-[-0.8px]">
              {exp.expression}
            </h3>
            {ttsAvailable && (
              <button
                onClick={() => speak(exp.expression)}
                className="text-white/40 hover:text-white text-[18px] transition-colors"
                title="Listen"
              >
                🔊
              </button>
            )}
          </div>
          <p className="text-[15px] text-white leading-[1.6] mb-1">{exp.meaning}</p>
          <p className="text-[14px] text-muted-silver leading-[1.7] mb-3">{exp.explanation}</p>
          <div className="bg-void-black rounded-lg p-3">
            <p className="text-[14px] text-white/80 leading-[1.6] italic">&quot;{exp.example}&quot;</p>
          </div>
        </div>
      ))}
    </div>
  );
}

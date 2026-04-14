"use client";

import { useState } from "react";
import { useSpeech } from "@/contexts/speech-context";
import { Button } from "@/components/ui/button";

interface ListeningPlayerProps {
  sentences: string[];
}

export function ListeningPlayer({ sentences }: ListeningPlayerProps) {
  const { ttsAvailable } = useSpeech();
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);

  function speak(text: string, index: number) {
    if (!ttsAvailable) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 0.9;
    utterance.onstart = () => setPlayingIndex(index);
    utterance.onend = () => setPlayingIndex(null);
    window.speechSynthesis.speak(utterance);
  }

  function playAll() {
    if (!ttsAvailable) return;
    window.speechSynthesis.cancel();
    sentences.forEach((s, i) => {
      const utterance = new SpeechSynthesisUtterance(s);
      utterance.lang = "en-US";
      utterance.rate = 0.9;
      utterance.onstart = () => setPlayingIndex(i);
      if (i === sentences.length - 1) {
        utterance.onend = () => setPlayingIndex(null);
      }
      window.speechSynthesis.speak(utterance);
    });
  }

  if (!ttsAvailable) {
    return (
      <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 text-[14px] text-yellow-300 leading-[1.6]">
        This browser does not support text-to-speech. Please read the sentences below aloud.
      </div>
    );
  }

  return (
    <div>
      <Button variant="frosted" onClick={playAll} className="mb-6 text-[13px]">
        Play All
      </Button>
      <div className="space-y-3">
        {sentences.map((s, i) => (
          <button
            key={i}
            onClick={() => speak(s, i)}
            className={`w-full text-left p-4 rounded-xl transition-all text-[15px] leading-[1.6] ${
              playingIndex === i
                ? "bg-framer-blue/10 shadow-ring-blue text-white"
                : "bg-near-black hover:bg-white/5 text-white/80"
            }`}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

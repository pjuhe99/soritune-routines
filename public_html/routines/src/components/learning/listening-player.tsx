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
      <div className="bg-warning/10 border border-warning/20 rounded-lg p-4 text-body text-warning leading-[1.6]">
        This browser does not support text-to-speech. Please read the sentences below aloud.
      </div>
    );
  }

  return (
    <div>
      <Button variant="secondary" onClick={playAll} className="mb-6 text-caption">
        Play All
      </Button>
      <div className="space-y-3">
        {sentences.map((s, i) => (
          <button
            key={i}
            onClick={() => speak(s, i)}
            className={`w-full text-left p-4 rounded-lg transition-all text-body leading-[1.6] border ${
              playingIndex === i
                ? "bg-brand-primary-light border-brand-primary text-text-primary"
                : "bg-surface border-border-default hover:bg-bg-subtle text-text-secondary"
            }`}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

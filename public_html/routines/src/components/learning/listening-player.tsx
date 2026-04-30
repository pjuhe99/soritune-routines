"use client";

import { useState } from "react";
import { useSpeech } from "@/contexts/speech-context";
import { Button } from "@/components/ui/button";
import { VoiceToggle } from "./voice-toggle";
import type { VoiceGender } from "@/lib/voice-picker";
import { L } from "@/lib/labels";

interface ListeningPlayerProps {
  sentences: string[];
}

export function ListeningPlayer({ sentences }: ListeningPlayerProps) {
  const { ttsAvailable, voicePick } = useSpeech();
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const [gender, setGender] = useState<VoiceGender>("female");

  // Auto-correct: derive effective gender at render time without an effect.
  const effectiveGender: VoiceGender =
    gender === "female" && !voicePick.female && voicePick.male
      ? "male"
      : gender === "male" && !voicePick.male && voicePick.female
        ? "female"
        : gender;

  const selectedVoice =
    voicePick[effectiveGender] ?? voicePick.female ?? voicePick.male ?? null;

  function speak(text: string, index: number) {
    if (!ttsAvailable) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 0.9;
    if (selectedVoice) utterance.voice = selectedVoice;
    utterance.onstart = () => setPlayingIndex(index);
    utterance.onend = () => setPlayingIndex(null);
    utterance.onerror = () => setPlayingIndex(null);
    window.speechSynthesis.speak(utterance);
  }

  function playAll() {
    if (!ttsAvailable) return;
    window.speechSynthesis.cancel();
    sentences.forEach((s, i) => {
      const utterance = new SpeechSynthesisUtterance(s);
      utterance.lang = "en-US";
      utterance.rate = 0.9;
      if (selectedVoice) utterance.voice = selectedVoice;
      utterance.onstart = () => setPlayingIndex(i);
      utterance.onerror = () => setPlayingIndex(null);
      if (i === sentences.length - 1) {
        utterance.onend = () => setPlayingIndex(null);
      }
      window.speechSynthesis.speak(utterance);
    });
  }

  function handleGenderChange(next: VoiceGender) {
    window.speechSynthesis.cancel();
    setPlayingIndex(null);
    setGender(next);
  }

  if (!ttsAvailable) {
    return (
      <div className="bg-warning/10 border border-warning/20 rounded-lg p-4 text-body text-warning leading-[1.6]">
        {L.player.ttsUnsupported}
      </div>
    );
  }

  const showToggle = voicePick.female !== null || voicePick.male !== null;

  return (
    <div>
      <div className={`mb-6 flex flex-wrap items-center gap-3 ${showToggle ? "justify-between" : "justify-end"}`}>
        {showToggle && (
          <VoiceToggle value={effectiveGender} onChange={handleGenderChange} pick={voicePick} />
        )}
        <Button variant="secondary" onClick={playAll} className="text-caption">
          {L.player.playAll}
        </Button>
      </div>
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

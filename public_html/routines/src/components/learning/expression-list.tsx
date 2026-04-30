"use client";

import { useState } from "react";
import type { KeyboardEvent, MouseEvent } from "react";
import { useSpeech } from "@/contexts/speech-context";
import { VoiceToggle } from "./voice-toggle";
import type { VoiceGender } from "@/lib/voice-picker";
import { L } from "@/lib/labels";

interface Expression {
  expression: string;
  phonetic: string;
  meaning: string;
  explanation: string;
  example: string;
}

interface ExpressionListProps {
  expressions: Expression[];
}

export function ExpressionList({ expressions }: ExpressionListProps) {
  const { ttsAvailable, voicePick } = useSpeech();
  const [gender, setGender] = useState<VoiceGender>("female");

  // Same auto-correct pattern as listening-player: derive at render time so
  // the user's original choice is preserved across voice availability changes.
  const effectiveGender: VoiceGender =
    gender === "female" && !voicePick.female && voicePick.male
      ? "male"
      : gender === "male" && !voicePick.male && voicePick.female
        ? "female"
        : gender;

  const selectedVoice =
    voicePick[effectiveGender] ?? voicePick.female ?? voicePick.male ?? null;

  function speak(text: string) {
    if (!ttsAvailable) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    u.rate = 0.9;
    if (selectedVoice) u.voice = selectedVoice;
    window.speechSynthesis.speak(u);
  }

  function handleGenderChange(next: VoiceGender) {
    window.speechSynthesis.cancel();
    setGender(next);
  }

  const showToggle =
    ttsAvailable && (voicePick.female !== null || voicePick.male !== null);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-caption text-text-tertiary">
          💡 카드를 눌러 자세한 설명을 볼 수 있어요
        </p>
        {showToggle ? (
          <VoiceToggle value={effectiveGender} onChange={handleGenderChange} pick={voicePick} />
        ) : null}
      </div>
      <div className="space-y-4">
        {expressions.map((exp, i) => (
          <ExpressionCard
            key={i}
            expression={exp}
            ttsAvailable={ttsAvailable}
            onSpeak={() => speak(exp.expression)}
          />
        ))}
      </div>
    </div>
  );
}

interface ExpressionCardProps {
  expression: Expression;
  ttsAvailable: boolean;
  onSpeak: () => void;
}

function ExpressionCard({ expression: exp, ttsAvailable, onSpeak }: ExpressionCardProps) {
  const [expanded, setExpanded] = useState(false);

  function toggle() {
    setExpanded((v) => !v);
  }

  function onClickCard(e: MouseEvent<HTMLDivElement>) {
    // Don't toggle when the user clicks an inner button (e.g., the speaker).
    const target = e.target as HTMLElement;
    if (target.closest("button")) return;
    toggle();
  }

  function onKeyDownCard(e: KeyboardEvent<HTMLDivElement>) {
    // Only react when the outer card itself is focused, not a child button.
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggle();
    }
  }

  function onSpeakClick(e: MouseEvent) {
    e.stopPropagation();
    onSpeak();
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-expanded={expanded}
      onClick={onClickCard}
      onKeyDown={onKeyDownCard}
      className="bg-surface border border-border-default rounded-lg p-5 cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-primary"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-title font-semibold text-brand-primary">{exp.expression}</h3>
        <div className="flex items-center gap-2">
          {ttsAvailable && (
            <button
              type="button"
              onClick={onSpeakClick}
              className="text-text-tertiary hover:text-text-primary text-[18px] transition-colors"
              title={L.player.listenTooltip}
            >
              🔊
            </button>
          )}
          <span
            aria-hidden
            className={`text-text-tertiary transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
          >
            ▾
          </span>
        </div>
      </div>
      {exp.phonetic ? (
        <p className="text-body text-text-secondary leading-[1.6] mt-1">{exp.phonetic}</p>
      ) : null}
      {expanded ? (
        <div className="mt-3 pt-3 border-t border-border-default">
          <p className="text-body text-text-primary leading-[1.6] mb-1">{exp.meaning}</p>
          <p className="text-body text-text-secondary leading-[1.7] mb-3">{exp.explanation}</p>
          <div className="bg-bg-page rounded-md p-3">
            <p className="text-body text-text-secondary leading-[1.6] italic">
              &quot;{exp.example}&quot;
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

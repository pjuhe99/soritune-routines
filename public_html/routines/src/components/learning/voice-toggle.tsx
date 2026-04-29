"use client";

import type { VoiceGender, VoicePick } from "@/lib/voice-picker";

interface VoiceToggleProps {
  value: VoiceGender;
  onChange: (next: VoiceGender) => void;
  pick: VoicePick;
}

export function VoiceToggle({ value, onChange, pick }: VoiceToggleProps) {
  const femaleAvailable = pick.female !== null;
  const maleAvailable = pick.male !== null;

  return (
    <div className="inline-flex rounded-lg border border-border-default overflow-hidden">
      <button
        type="button"
        disabled={!femaleAvailable}
        onClick={() => onChange("female")}
        title={
          !femaleAvailable
            ? "이 브라우저에서 여자 음성을 사용할 수 없습니다"
            : undefined
        }
        className={`px-3 py-1.5 text-caption transition-colors ${
          value === "female"
            ? "bg-brand-primary-light text-brand-primary font-medium"
            : "bg-surface text-text-secondary hover:bg-bg-subtle"
        } disabled:opacity-40 disabled:cursor-not-allowed`}
      >
        👩 여자
      </button>
      <button
        type="button"
        disabled={!maleAvailable}
        onClick={() => onChange("male")}
        title={
          !maleAvailable
            ? "이 브라우저에서 남자 음성을 사용할 수 없습니다"
            : undefined
        }
        className={`px-3 py-1.5 text-caption transition-colors border-l border-border-default ${
          value === "male"
            ? "bg-brand-primary-light text-brand-primary font-medium"
            : "bg-surface text-text-secondary hover:bg-bg-subtle"
        } disabled:opacity-40 disabled:cursor-not-allowed`}
      >
        👨 남자
      </button>
    </div>
  );
}

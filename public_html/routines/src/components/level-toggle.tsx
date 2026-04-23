"use client";

import { useState } from "react";
import { useLevel } from "@/contexts/level-context";
import { LEVELS, LEVEL_LABELS, Level } from "@/lib/level";

export function LevelToggle() {
  const { level, setLevel } = useLevel();
  const [open, setOpen] = useState(false);

  if (level === null) return null;

  function choose(next: Level) {
    setLevel(next);
    setOpen(false);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-[15px] font-medium text-text-secondary hover:text-text-primary tracking-[-0.01em] transition-colors flex items-center gap-1"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>{LEVEL_LABELS[level]}</span>
        <span className="text-[10px]">▾</span>
      </button>
      {open && (
        <div
          className="absolute right-0 mt-2 min-w-[120px] rounded-xl border border-border-default bg-surface py-1 shadow-lg"
          role="listbox"
        >
          {LEVELS.map((lv) => (
            <button
              key={lv}
              type="button"
              onClick={() => choose(lv)}
              className={`w-full px-4 py-2 text-left text-[14px] transition-colors ${
                lv === level ? "text-brand-primary" : "text-text-secondary hover:text-text-primary hover:bg-bg-subtle"
              }`}
              role="option"
              aria-selected={lv === level}
            >
              {LEVEL_LABELS[lv]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";

export function StreakDisplay() {
  const [streak, setStreak] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/streak")
      .then((r) => r.json())
      .then((data) => setStreak(data.currentStreak))
      .catch(() => {});
  }, []);

  if (streak === null) return null;

  return (
    <div className="flex items-center gap-1.5 text-[13px] font-medium">
      <span className="text-orange-400">🔥</span>
      <span className="text-white">{streak}</span>
    </div>
  );
}

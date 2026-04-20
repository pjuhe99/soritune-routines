"use client";

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { Level, LEVEL_STORAGE_KEY, isLevel } from "@/lib/level";

interface LevelContextValue {
  level: Level | null;
  setLevel: (level: Level) => void;
  ready: boolean;
}

const LevelContext = createContext<LevelContextValue | undefined>(undefined);

export function LevelProvider({ children }: { children: ReactNode }) {
  const [level, setLevelState] = useState<Level | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(LEVEL_STORAGE_KEY) : null;
    if (isLevel(stored)) {
      setLevelState(stored);
    }
    setReady(true);
  }, []);

  const setLevel = useCallback((next: Level) => {
    setLevelState(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LEVEL_STORAGE_KEY, next);
    }
  }, []);

  return (
    <LevelContext.Provider value={{ level, setLevel, ready }}>
      {children}
    </LevelContext.Provider>
  );
}

export function useLevel() {
  const ctx = useContext(LevelContext);
  if (!ctx) {
    throw new Error("useLevel must be used within <LevelProvider>");
  }
  return ctx;
}

"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

interface SpeechCapabilities {
  ttsAvailable: boolean;
}

const SpeechContext = createContext<SpeechCapabilities>({
  ttsAvailable: false,
});

export function SpeechProvider({ children }: { children: ReactNode }) {
  const [caps, setCaps] = useState<SpeechCapabilities>({
    ttsAvailable: false,
  });

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot browser capability detection on mount
    setCaps({
      ttsAvailable: typeof window !== "undefined" && "speechSynthesis" in window,
    });
  }, []);

  return (
    <SpeechContext.Provider value={caps}>{children}</SpeechContext.Provider>
  );
}

export function useSpeech() {
  return useContext(SpeechContext);
}

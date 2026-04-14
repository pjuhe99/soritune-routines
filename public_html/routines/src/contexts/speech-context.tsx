"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

interface SpeechCapabilities {
  ttsAvailable: boolean;
  sttAvailable: boolean;
}

const SpeechContext = createContext<SpeechCapabilities>({
  ttsAvailable: false,
  sttAvailable: false,
});

export function SpeechProvider({ children }: { children: ReactNode }) {
  const [caps, setCaps] = useState<SpeechCapabilities>({
    ttsAvailable: false,
    sttAvailable: false,
  });

  useEffect(() => {
    setCaps({
      ttsAvailable: typeof window !== "undefined" && "speechSynthesis" in window,
      sttAvailable:
        typeof window !== "undefined" &&
        ("SpeechRecognition" in window || "webkitSpeechRecognition" in window),
    });
  }, []);

  return (
    <SpeechContext.Provider value={caps}>{children}</SpeechContext.Provider>
  );
}

export function useSpeech() {
  return useContext(SpeechContext);
}

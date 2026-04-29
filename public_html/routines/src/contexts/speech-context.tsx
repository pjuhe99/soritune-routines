"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { pickEnglishVoices, type VoicePick } from "@/lib/voice-picker";

interface SpeechCapabilities {
  ttsAvailable: boolean;
  voicePick: VoicePick;
}

const EMPTY_PICK: VoicePick = { female: null, male: null };

const SpeechContext = createContext<SpeechCapabilities>({
  ttsAvailable: false,
  voicePick: EMPTY_PICK,
});

export function SpeechProvider({ children }: { children: ReactNode }) {
  const [caps, setCaps] = useState<SpeechCapabilities>({
    ttsAvailable: false,
    voicePick: EMPTY_PICK,
  });

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }

    function refresh() {
      const voices = window.speechSynthesis.getVoices();
      setCaps({
        ttsAvailable: true,
        voicePick: pickEnglishVoices(voices),
      });
    }

    // Initial read (some browsers populate sync, some async)
    refresh();

    // Chrome populates voices asynchronously and fires voiceschanged
    function onVoicesChanged() {
      refresh();
    }
    window.speechSynthesis.addEventListener("voiceschanged", onVoicesChanged);

    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", onVoicesChanged);
    };
  }, []);

  return <SpeechContext.Provider value={caps}>{children}</SpeechContext.Provider>;
}

export function useSpeech() {
  return useContext(SpeechContext);
}

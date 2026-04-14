"use client";

import { useState, useRef } from "react";
import { useSpeech } from "@/contexts/speech-context";
import { similarityPercent } from "@/lib/string-similarity";
import { Button } from "@/components/ui/button";

interface SpeakingRecorderProps {
  sentences: string[];
  onComplete: (avgScore: number) => void;
  onSkip: () => void;
}

export function SpeakingRecorder({ sentences, onComplete, onSkip }: SpeakingRecorderProps) {
  const { sttAvailable } = useSpeech();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [score, setScore] = useState<number | null>(null);
  const [scores, setScores] = useState<number[]>([]);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const current = sentences[currentIndex];
  const isLast = currentIndex === sentences.length - 1;

  function startRecording() {
    const SpeechRecognitionCtor =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) return;

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const result = event.results[0][0].transcript;
      setTranscript(result);
      const s = similarityPercent(current, result);
      setScore(s);
      setScores((prev) => [...prev, s]);
    };

    recognition.onerror = () => {
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
    setTranscript("");
    setScore(null);
  }

  function stopRecording() {
    recognitionRef.current?.stop();
    setIsRecording(false);
  }

  function handleNext() {
    if (isLast) {
      const avg =
        scores.length > 0
          ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
          : 0;
      onComplete(avg);
      return;
    }
    setCurrentIndex((i) => i + 1);
    setTranscript("");
    setScore(null);
  }

  if (!sttAvailable) {
    return (
      <div>
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 text-[14px] text-yellow-300 leading-[1.6] mb-6">
          Speech recognition is not available. You can skip this step.
        </div>
        <Button variant="frosted" onClick={onSkip}>
          Skip
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-2 text-[13px] text-muted-silver">
        {currentIndex + 1} / {sentences.length}
      </div>

      <div className="bg-near-black shadow-ring-blue rounded-xl p-6 mb-6">
        <p className="text-[18px] text-white leading-[1.6]">{current}</p>
      </div>

      {score === null ? (
        <div className="flex gap-3">
          <Button
            variant={isRecording ? "frosted" : "solid"}
            onClick={isRecording ? stopRecording : startRecording}
          >
            {isRecording ? "Stop" : "Start Recording"}
          </Button>
          {transcript && (
            <p className="text-[14px] text-muted-silver self-center">{transcript}</p>
          )}
        </div>
      ) : (
        <div>
          <div className="bg-near-black rounded-xl p-5 mb-4">
            <p className="text-[13px] text-muted-silver mb-2">Your pronunciation</p>
            <p className="text-[15px] text-white leading-[1.6] mb-3">{transcript}</p>
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-void-black rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-framer-blue rounded-full transition-all"
                  style={{ width: `${score}%` }}
                />
              </div>
              <span
                className={`text-[20px] font-semibold ${
                  score >= 80 ? "text-green-400" : score >= 50 ? "text-yellow-400" : "text-red-400"
                }`}
              >
                {score}%
              </span>
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="frosted" onClick={startRecording}>
              Try Again
            </Button>
            <Button onClick={handleNext}>{isLast ? "Done" : "Next Sentence"}</Button>
          </div>
        </div>
      )}
    </div>
  );
}

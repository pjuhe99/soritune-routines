"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type RecorderStatus = "idle" | "requesting" | "recording" | "stopped" | "error";

interface UseMediaRecorderResult {
  status: RecorderStatus;
  start: () => Promise<void>;
  stop: () => Promise<Blob | null>;
  reset: () => void;
  durationMs: number;
  blob: Blob | null;
  mimeType: string | null;
  error: Error | null;
  isSupported: boolean;
}

function pickMimeType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg",
  ];
  for (const t of candidates) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return null;
}

export function useMediaRecorder(): UseMediaRecorderResult {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [durationMs, setDurationMs] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [mimeType, setMimeType] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startedAtRef = useRef<number>(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopResolverRef = useRef<((b: Blob | null) => void) | null>(null);
  const isMountedRef = useRef(true);

  const isSupported =
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices &&
    typeof MediaRecorder !== "undefined" &&
    pickMimeType() !== null;

  const stopTick = () => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  };

  const cleanupStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      stopTick();
      cleanupStream();
    };
  }, []);

  const start = useCallback(async () => {
    if (status === "requesting" || status === "recording") return;
    setError(null);
    setBlob(null);
    setDurationMs(0);
    chunksRef.current = [];

    if (!isSupported) {
      const err = new Error("MediaRecorder not supported on this device");
      setError(err);
      setStatus("error");
      throw err;
    }

    setStatus("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mt = pickMimeType()!;
      setMimeType(mt);
      const rec = new MediaRecorder(stream, { mimeType: mt });
      recorderRef.current = rec;

      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        if (!isMountedRef.current) return;
        const finalBlob = new Blob(chunksRef.current, { type: mt });
        setBlob(finalBlob);
        setStatus("stopped");
        cleanupStream();
        stopTick();
        stopResolverRef.current?.(finalBlob);
        stopResolverRef.current = null;
      };
      rec.onerror = (ev) => {
        if (!isMountedRef.current) return;
        const err = new Error("MediaRecorder error");
        console.error("MediaRecorder error:", ev);
        setError(err);
        setStatus("error");
        cleanupStream();
        stopTick();
        stopResolverRef.current?.(null);
        stopResolverRef.current = null;
      };

      startedAtRef.current = Date.now();
      tickRef.current = setInterval(() => {
        setDurationMs(Date.now() - startedAtRef.current);
      }, 100);

      rec.start();
      setStatus("recording");
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      setStatus("error");
      cleanupStream();
      throw err;
    }
  }, [isSupported, status]);

  const stop = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const rec = recorderRef.current;
      if (!rec || rec.state === "inactive") {
        resolve(blob);
        return;
      }
      stopResolverRef.current = resolve;
      rec.stop();
    });
  }, [blob]);

  const reset = useCallback(() => {
    stopTick();
    cleanupStream();
    recorderRef.current = null;
    chunksRef.current = [];
    setBlob(null);
    setDurationMs(0);
    setMimeType(null);
    setError(null);
    setStatus("idle");
  }, []);

  return { status, start, stop, reset, durationMs, blob, mimeType, error, isSupported };
}

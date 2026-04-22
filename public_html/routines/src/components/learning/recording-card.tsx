"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useMediaRecorder } from "@/hooks/use-media-recorder";
import { getCafeUrl } from "@/lib/cafe-link";
import { mimeToExt } from "@/lib/audio-mime";

export interface RecordingSummary {
  id: number;
  targetSentence: string;
  createdAt: string;
  expiresAt: string;
  durationMs: number | null;
}

interface RecordingCardProps {
  interviewAnswerId: number;
  questionIndex: number;
  question: string;
  recommendedSentence: string;
  initialRecording: RecordingSummary | null;
}

function formatDuration(ms: number): string {
  const total = Math.floor(ms / 1000);
  const mm = Math.floor(total / 60).toString().padStart(2, "0");
  const ss = (total % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

function formatExpiry(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

export function RecordingCard({
  interviewAnswerId,
  questionIndex,
  question,
  recommendedSentence,
  initialRecording,
}: RecordingCardProps) {
  const { status, start, stop, reset, durationMs, blob, mimeType, error, isSupported } = useMediaRecorder();
  const [recording, setRecording] = useState<RecordingSummary | null>(initialRecording);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showShareHint, setShowShareHint] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
    };
  }, []);

  async function handleStart() {
    setUploadError(null);
    try {
      await start();
    } catch {
      // error is surfaced via hook
    }
  }

  async function handleStop() {
    const finalBlob = await stop();
    if (!finalBlob) return;
    await uploadBlob(finalBlob);
  }

  async function uploadBlob(b: Blob) {
    setUploading(true);
    setUploadError(null);
    try {
      const mt = mimeType ?? b.type ?? "audio/webm";
      let ext: string;
      try {
        ext = mimeToExt(mt);
      } catch {
        ext = "webm";
      }
      const form = new FormData();
      form.append("interviewAnswerId", String(interviewAnswerId));
      form.append("durationMs", String(durationMs));
      form.append("audio", new File([b], `recording.${ext}`, { type: mt }));

      const res = await fetch("/api/recording/upload", { method: "POST", body: form });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Upload failed (${res.status})`);
      }
      const data = await res.json() as RecordingSummary;
      setRecording(data);
      reset();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "업로드에 실패했어요.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete() {
    if (!recording) return;
    const confirmed = window.confirm("이 녹음을 삭제할까요?");
    if (!confirmed) return;
    const res = await fetch(`/api/recording/${recording.id}`, { method: "DELETE" });
    if (res.ok) {
      setRecording(null);
    }
  }

  function handleDownload() {
    if (!recording) return;
    window.location.href = `/api/recording/${recording.id}/file?download=1`;
  }

  function handleOpenCafe() {
    window.open(getCafeUrl(), "_blank", "noopener,noreferrer");
    setShowShareHint(true);
    if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
    hintTimerRef.current = setTimeout(() => setShowShareHint(false), 6000);
  }

  const isRecording = status === "recording";
  const isRequesting = status === "requesting";
  const mismatchWarning =
    recording && recording.targetSentence.trim() !== recommendedSentence.trim()
      ? recording.targetSentence
      : null;

  return (
    <div className="bg-near-black rounded-xl p-5 space-y-4">
      <div>
        <p className="text-[13px] text-muted-silver mb-1">Q{questionIndex + 1}. {question}</p>
      </div>

      <div className="bg-framer-blue/10 border border-framer-blue/30 rounded-lg p-4">
        <p className="text-[13px] text-framer-blue font-medium mb-1">녹음할 문장</p>
        <p className="text-[15px] text-white leading-[1.6]">{recommendedSentence}</p>
      </div>

      {!isSupported && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 text-[13px] text-yellow-300">
          이 브라우저에서는 녹음이 지원되지 않아요.
        </div>
      )}

      {isSupported && !recording && (
        <div>
          {!isRecording ? (
            <div className="flex gap-3 items-center">
              <Button onClick={handleStart} disabled={isRequesting || uploading}>
                {isRequesting ? "준비 중..." : uploading ? "업로드 중..." : "🔴 녹음 시작"}
              </Button>
              {error && <p className="text-[13px] text-red-400">{error.message}</p>}
            </div>
          ) : (
            <div className="flex gap-3 items-center">
              <Button variant="frosted" onClick={handleStop}>
                ⏹ 중지 ({formatDuration(durationMs)})
              </Button>
              <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            </div>
          )}
          {uploadError && <p className="text-[13px] text-red-400 mt-2">{uploadError}</p>}
        </div>
      )}

      {recording && (
        <div className="space-y-3">
          <audio
            ref={audioRef}
            controls
            src={`/api/recording/${recording.id}/file`}
            className="w-full"
          />
          {mismatchWarning && (
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 text-[12px] text-yellow-200 leading-[1.5]">
              이 녹음은 이전 추천 문장 (&quot;{mismatchWarning}&quot;) 으로 제작되었어요. 현재 추천 문장과 달라서 다시 녹음을 권장해요.
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button variant="frosted" onClick={handleStart} disabled={uploading}>
              다시 녹음
            </Button>
            <Button variant="ghost" onClick={handleDelete}>
              삭제
            </Button>
            <Button variant="frosted" onClick={handleDownload}>
              ⬇ 다운로드
            </Button>
            <Button onClick={handleOpenCafe}>
              📮 카페에 올리기
            </Button>
          </div>
          {showShareHint && (
            <p className="text-[12px] text-framer-blue leading-[1.5]">
              다운받은 녹음 파일을 카페 게시글에 첨부해주세요!
            </p>
          )}
          <p className="text-[12px] text-muted-silver">
            {formatExpiry(recording.expiresAt)} 에 자동 삭제됩니다.
          </p>
        </div>
      )}
    </div>
  );
}

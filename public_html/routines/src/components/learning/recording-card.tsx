"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ShareSheet } from "@/components/share/share-sheet";
import { useMediaRecorder } from "@/hooks/use-media-recorder";
import { getCafeUrl } from "@/lib/cafe-link";
import { L } from "@/lib/labels";
import { mimeToExt } from "@/lib/audio-mime";

export interface RecordingSummary {
  id: number;
  targetSentence: string;
  createdAt: string;
  expiresAt: string;
  durationMs: number | null;
}

interface RecordingCardProps {
  contentId: string;
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
  contentId,
  interviewAnswerId,
  questionIndex,
  question,
  recommendedSentence,
  initialRecording,
}: RecordingCardProps) {
  const { status, start, stop, reset, durationMs, mimeType, error, isSupported } = useMediaRecorder();
  const [shareOpen, setShareOpen] = useState(false);
  const numericContentId = Number(contentId);
  const canRecommend = Number.isFinite(numericContentId);
  const [recording, setRecording] = useState<RecordingSummary | null>(initialRecording);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showShareHint, setShowShareHint] = useState(false);
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
      setUploadError(err instanceof Error ? err.message : L.recording.uploadFailedDefault);
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete() {
    if (!recording) return;
    if (!window.confirm(L.recording.deleteConfirm)) return;
    try {
      const res = await fetch(`/api/recording/${recording.id}`, { method: "DELETE" });
      if (res.ok) {
        setRecording(null);
      } else {
        setUploadError(L.recording.deleteFailed);
      }
    } catch {
      setUploadError(L.recording.deleteError);
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

  function handleOpenShare() {
    setShowShareHint(false);
    if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
    setShareOpen(true);
  }

  const isRecording = status === "recording";
  const isRequesting = status === "requesting";
  const mismatchWarning =
    recording && recording.targetSentence.trim() !== recommendedSentence.trim()
      ? recording.targetSentence
      : null;

  return (
    <div className="bg-surface border border-border-default rounded-lg p-5 space-y-4">
      <div>
        <p className="text-caption text-text-secondary mb-1">Q{questionIndex + 1}. {question}</p>
      </div>

      <div className="bg-brand-primary-light border border-brand-primary/30 rounded-lg p-4">
        <p className="text-caption text-brand-primary font-medium mb-1">녹음할 문장</p>
        <p className="text-body text-text-primary leading-[1.6]">{recommendedSentence}</p>
      </div>

      {!isSupported && (
        <div className="bg-warning/10 border border-warning/20 rounded-lg p-3 text-caption text-warning">
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
              {error && <p className="text-caption text-danger">{error.message}</p>}
            </div>
          ) : (
            <div className="flex gap-3 items-center">
              <Button variant="secondary" onClick={handleStop}>
                ⏹ 중지 ({formatDuration(durationMs)})
              </Button>
              <span className="inline-block w-2 h-2 rounded-full bg-danger animate-pulse" />
            </div>
          )}
          {uploadError && <p className="text-caption text-danger mt-2">{uploadError}</p>}
        </div>
      )}

      {recording && (
        <div className="space-y-3">
          <audio
            controls
            src={`/api/recording/${recording.id}/file`}
            className="w-full"
          />
          {mismatchWarning && (
            <div className="bg-warning/10 border border-warning/20 rounded-lg p-3 text-caption text-warning leading-[1.5]">
              이 녹음은 이전 추천 문장(&quot;{mismatchWarning}&quot;)으로 제작되었어요. 현재 추천 문장과 달라서 다시 녹음을 권장해요.
            </div>
          )}
          <div className="flex flex-wrap gap-2 items-center">
            {isRecording && (
              <span className="inline-block w-2 h-2 rounded-full bg-danger animate-pulse" aria-hidden="true" />
            )}
            {isRecording ? (
              <Button variant="secondary" onClick={handleStop}>
                ⏹ 중지 ({formatDuration(durationMs)})
              </Button>
            ) : (
              <Button variant="secondary" onClick={handleStart} disabled={isRequesting || uploading}>
                {isRequesting ? "준비 중..." : "다시 녹음"}
              </Button>
            )}
            <Button variant="ghost" onClick={handleDelete}>
              삭제
            </Button>
            <Button variant="secondary" onClick={handleDownload} disabled={isRecording || uploading}>
              ⬇ 다운로드
            </Button>
            <Button onClick={handleOpenCafe}>
              📮 {L.recording.postToCafe}
            </Button>
            {canRecommend && (
              <Button variant="secondary" onClick={handleOpenShare}>
                💬 {L.recording.recommendToFriend}
              </Button>
            )}
          </div>
          {uploadError && <p className="text-caption text-danger mt-2">{uploadError}</p>}
          {showShareHint && (
            <p className="text-caption text-brand-primary leading-[1.5]">
              {L.recording.cafeHint}
            </p>
          )}
          <p className="text-caption text-text-secondary">
            {formatExpiry(recording.expiresAt)}에 자동 삭제됩니다.
          </p>
        </div>
      )}
      {canRecommend && (
        <ShareSheet
          open={shareOpen}
          onOpenChange={setShareOpen}
          contentId={numericContentId}
          context="recording"
        />
      )}
    </div>
  );
}

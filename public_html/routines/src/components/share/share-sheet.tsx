"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { L } from "@/lib/labels";
import { getCafeUrl } from "@/lib/cafe-link";
import { loadKakao, sendKakaoShare } from "@/lib/kakao";
import type { ShareChannel } from "@/lib/share-channels";
import {
  buildOgImageUrl,
  buildSharePostBody,
  buildShareUrl,
  shouldShowCafeOption,
  shouldShowWebShareOption,
  type ShareContext,
} from "./share-helpers";

interface ShareSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contentId: number;
  context: ShareContext;
  level?: string;
}

type Notice =
  | { kind: "success"; text: string }
  | { kind: "error"; text: string }
  | null;

export function ShareSheet({ open, onOpenChange, contentId, context, level }: ShareSheetProps) {
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const sheetTitleId = "share-sheet-title";

  const shareUrl = buildShareUrl(contentId);
  const ogImageUrl = buildOgImageUrl(contentId);
  const showCafe = shouldShowCafeOption(context);
  const showWebShare =
    typeof navigator !== "undefined" && shouldShowWebShareOption(navigator);

  function flashNotice(next: Notice, autoDismissMs = 3000) {
    setNotice(next);
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    if (next) {
      noticeTimerRef.current = setTimeout(() => setNotice(null), autoDismissMs);
    }
  }

  // Preload Kakao SDK on first open so the kakao button has zero delay later.
  useEffect(() => {
    if (!open) return;
    loadKakao().catch(() => {
      // Surface only when the user actually clicks the kakao button.
    });
  }, [open]);

  // Body scroll lock + ESC + initial focus.
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeBtnRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onOpenChange(false);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onOpenChange]);

  // Clean up notice timer on unmount.
  useEffect(() => {
    return () => {
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    };
  }, []);

  async function recordShare(channel: ShareChannel): Promise<void> {
    try {
      await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          buildSharePostBody({ contentId, channel, context, level })
        ),
      });
    } catch {
      // Tracking is best-effort.
    }
  }

  async function handleKakao() {
    setBusy("kakao");
    try {
      await sendKakaoShare({
        title: L.share.pitchTitle,
        description: L.share.pitchDescription,
        imageUrl: ogImageUrl,
        linkUrl: shareUrl,
        buttonTitle: L.share.pitchButton,
      });
      void recordShare("kakao");
    } catch {
      flashNotice({ kind: "error", text: L.share.kakaoLoadFailed });
    } finally {
      setBusy(null);
    }
  }

  async function handleImageDownload() {
    setBusy("image");
    try {
      const res = await fetch(ogImageUrl);
      if (!res.ok) throw new Error(`og-image ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `routines-${contentId}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      void recordShare("image_download");
    } catch {
      flashNotice({ kind: "error", text: L.share.imageDownloadFailed });
    } finally {
      setBusy(null);
    }
  }

  async function handleCopyLink() {
    setBusy("copy");
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const ta = document.createElement("textarea");
        ta.value = shareUrl;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand("copy");
        ta.remove();
        if (!ok) throw new Error("execCommand copy failed");
      }
      flashNotice({ kind: "success", text: L.share.copyDone });
      void recordShare("copy");
    } catch {
      flashNotice({ kind: "error", text: L.share.linkCopyFailed });
    } finally {
      setBusy(null);
    }
  }

  function handleCafe() {
    window.open(getCafeUrl(), "_blank", "noopener,noreferrer");
    flashNotice({ kind: "success", text: L.share.cafeHint }, 6000);
    void recordShare("cafe");
  }

  async function handleWebShare() {
    setBusy("web");
    try {
      await navigator.share({
        title: L.share.pitchTitle,
        text: L.share.pitchDescription,
        url: shareUrl,
      });
      void recordShare("web_share");
    } catch {
      // User cancellation throws on most browsers — silently ignore.
    } finally {
      setBusy(null);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onOpenChange(false);
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={sheetTitleId}
        className="bg-surface text-text-primary w-full max-w-md rounded-t-2xl sm:rounded-2xl p-5 shadow-xl"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 id={sheetTitleId} className="text-headline font-semibold">
            {L.share.sheetTitle}
          </h2>
          <button
            ref={closeBtnRef}
            type="button"
            aria-label={L.share.close}
            className="text-text-secondary text-lg px-2"
            onClick={() => onOpenChange(false)}
          >
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            disabled={busy !== null}
            onClick={handleKakao}
            className="w-full rounded-lg py-3 text-base font-semibold disabled:opacity-50"
            style={{ backgroundColor: "#FEE500", color: "#000" }}
          >
            💬 {L.share.kakao}
          </button>

          <Button variant="secondary" disabled={busy !== null} onClick={handleImageDownload}>
            🖼 {L.share.imageDownload}
          </Button>

          <Button variant="secondary" disabled={busy !== null} onClick={handleCopyLink}>
            🔗 {L.share.copyLink}
          </Button>

          {showCafe && (
            <Button variant="secondary" disabled={busy !== null} onClick={handleCafe}>
              📮 {L.share.cafe}
            </Button>
          )}

          {showWebShare && (
            <Button variant="ghost" disabled={busy !== null} onClick={handleWebShare}>
              {L.share.webShare}
            </Button>
          )}
        </div>

        <div
          aria-live="polite"
          className="min-h-[1.5rem] mt-4 text-caption"
          style={{
            color:
              notice?.kind === "error"
                ? "var(--color-danger)"
                : "var(--color-brand-primary)",
          }}
        >
          {notice?.text ?? ""}
        </div>
      </div>
    </div>
  );
}

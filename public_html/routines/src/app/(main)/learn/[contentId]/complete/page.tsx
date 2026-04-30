"use client";

import { useEffect, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { parseLevel } from "@/lib/level";
import { L } from "@/lib/labels";

export default function CompletePage() {
  const params = useParams();
  const contentId = Number(params.contentId);
  const searchParams = useSearchParams();
  const level = parseLevel(searchParams.get("level")) ?? "beginner";
  const emittedRef = useRef(false);

  // Emit one 'complete' analytics event per mount so the admin dashboard can
  // compute completion rate. Strict-mode double-invoke guard via ref.
  useEffect(() => {
    if (emittedRef.current) return;
    if (!Number.isFinite(contentId)) return;
    emittedRef.current = true;
    fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "complete",
        contentId,
        metadata: { level },
      }),
    }).catch(() => undefined);
  }, [contentId, level]);

  async function handleShare() {
    const text = L.complete.shareText;
    navigator.clipboard.writeText(text);

    try {
      await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentId,
          channel: "copy",
          metadata: { level },
        }),
      });
    } catch {
      // Share tracking failed silently - clipboard copy still works
    }

    alert(L.complete.copied);
  }

  return (
    <div className="max-w-[600px] mx-auto px-6 py-20 text-center">
      <div className="text-[80px] mb-6">&#127881;</div>
      <h1 className="text-display font-bold mb-4">
        {L.complete.title}
      </h1>
      <p className="text-body text-text-secondary mb-8">
        {L.complete.subtitle}
      </p>

      <div className="flex flex-col items-center gap-3">
        <Button variant="secondary" onClick={handleShare}>
          {L.complete.shareButton}
        </Button>
        <Link href="/today">
          <Button variant="ghost">{L.complete.backToToday}</Button>
        </Link>
      </div>
    </div>
  );
}

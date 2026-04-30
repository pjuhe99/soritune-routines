"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ShareSheet } from "@/components/share/share-sheet";
import { parseLevel } from "@/lib/level";
import { L } from "@/lib/labels";

export default function CompletePage() {
  const params = useParams();
  const contentId = Number(params.contentId);
  const searchParams = useSearchParams();
  const level = parseLevel(searchParams.get("level")) ?? "beginner";
  const emittedRef = useRef(false);
  const [shareOpen, setShareOpen] = useState(false);

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

  return (
    <div className="max-w-[600px] mx-auto px-6 py-20 text-center">
      <div className="text-[80px] mb-6">&#127881;</div>
      <h1 className="text-display font-bold mb-4">{L.complete.title}</h1>
      <p className="text-body text-text-secondary mb-4">{L.complete.subtitle}</p>
      <p className="text-body text-text-secondary mb-8">{L.complete.shareHint}</p>

      <div className="flex flex-col items-center gap-3">
        <Button onClick={() => setShareOpen(true)}>{L.complete.shareButton}</Button>
        <Link href="/today">
          <Button variant="ghost">{L.complete.backToToday}</Button>
        </Link>
      </div>

      {Number.isFinite(contentId) && (
        <ShareSheet
          open={shareOpen}
          onOpenChange={setShareOpen}
          contentId={contentId}
          context="complete"
          level={level}
        />
      )}
    </div>
  );
}

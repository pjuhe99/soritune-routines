"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function CompletePage() {
  const params = useParams();
  const contentId = Number(params.contentId);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    fetch("/api/streak")
      .then((r) => r.json())
      .then((data) => setStreak(data.currentStreak))
      .catch(() => {});
  }, []);

  async function handleShare() {
    const text = `Completed today's English learning on Routines! ${streak} day streak! https://routines.soritune.com`;
    navigator.clipboard.writeText(text);

    try {
      await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentId, channel: "copy" }),
      });
    } catch {
      // Share tracking failed silently - clipboard copy still works
    }

    alert("Copied to clipboard!");
  }

  return (
    <div className="max-w-[600px] mx-auto px-6 py-20 text-center">
      <div className="text-[80px] mb-6">&#127881;</div>
      <h1 className="text-[62px] font-bold tracking-[-3.1px] leading-[1] mb-4">
        Complete!
      </h1>
      <p className="text-[18px] text-muted-silver leading-[1.6] mb-8">
        You finished today&apos;s learning routine
      </p>

      <div className="bg-near-black shadow-ring-blue rounded-xl p-8 mb-8 inline-block">
        <p className="text-[13px] text-muted-silver mb-2">Streak</p>
        <p className="text-[62px] font-bold text-framer-blue tracking-[-3.1px] leading-[1]">
          {streak} days
        </p>
      </div>

      <div className="flex flex-col items-center gap-3">
        <Button variant="frosted" onClick={handleShare}>
          Share Result
        </Button>
        <Link href="/today">
          <Button variant="ghost">Back to Today</Button>
        </Link>
      </div>
    </div>
  );
}

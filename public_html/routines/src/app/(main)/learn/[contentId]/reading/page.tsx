"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ReadingView } from "@/components/learning/reading-view";
import { Button } from "@/components/ui/button";

interface Content {
  id: number;
  title: string;
  paragraphs: string[];
  keyPhrase: string;
  keyKo: string;
}

export default function ReadingPage() {
  const params = useParams();
  const router = useRouter();
  const contentId = params.contentId as string;
  const [content, setContent] = useState<Content | null>(null);

  useEffect(() => {
    fetch(`/api/content/${contentId}?level=intermediate`)
      .then((r) => r.json())
      .then(setContent);
  }, [contentId]);

  function handleComplete() {
    router.push(`/learn/${contentId}/listening`);
  }

  if (!content) return <div className="p-6 text-muted-silver">Loading...</div>;

  return (
    <div className="max-w-[800px] mx-auto px-6 py-12">
      <span className="text-[12px] font-semibold text-framer-blue tracking-[2px] uppercase">
        Step 1 · Reading
      </span>
      <h1 className="text-[32px] font-semibold tracking-[-1px] leading-[1.13] mt-2 mb-8">
        {content.title}
      </h1>

      <ReadingView paragraphs={content.paragraphs} keyPhrase={content.keyPhrase} />

      <div className="mt-6 bg-near-black shadow-ring-blue rounded-xl p-4">
        <p className="text-[15px]">
          <span className="text-framer-blue font-medium">{content.keyPhrase}</span>
          <span className="text-muted-silver ml-3">{content.keyKo}</span>
        </p>
      </div>

      <div className="mt-10 flex justify-end">
        <Button onClick={handleComplete}>Next: Listening</Button>
      </div>
    </div>
  );
}

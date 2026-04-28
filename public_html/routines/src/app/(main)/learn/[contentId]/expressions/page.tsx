"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ExpressionList } from "@/components/learning/expression-list";
import { Button } from "@/components/ui/button";
import { parseLevel } from "@/lib/level";

interface Expression {
  expression: string;
  meaning: string;
  explanation: string;
  example: string;
}

export default function ExpressionsPage() {
  const params = useParams();
  const router = useRouter();
  const contentId = params.contentId as string;
  const searchParams = useSearchParams();
  const level = parseLevel(searchParams.get("level")) ?? "beginner";
  const [expressions, setExpressions] = useState<Expression[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/content/${contentId}?level=${level}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setExpressions(data.expressions);
      });
    return () => {
      cancelled = true;
    };
  }, [contentId, level]);

  async function handleComplete() {
    await fetch(`/api/progress/${contentId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: "expressions", level }),
    }).catch(() => {});
    router.push(`/learn/${contentId}/quiz?level=${level}`);
  }

  if (!expressions.length) return <div className="p-6 text-text-secondary">Loading...</div>;

  return (
    <div className="max-w-[800px] mx-auto px-6 py-12">
      <span className="text-caption font-semibold text-brand-primary uppercase">
        Step 3 · Expressions
      </span>
      <h2 className="text-headline font-semibold mt-2 mb-8">
        Learn key expressions
      </h2>

      <ExpressionList expressions={expressions} />

      <div className="mt-10 flex justify-end">
        <Button onClick={handleComplete}>Next: Quiz</Button>
      </div>
    </div>
  );
}

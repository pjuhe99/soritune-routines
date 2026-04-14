"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ExpressionList } from "@/components/learning/expression-list";
import { Button } from "@/components/ui/button";

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
  const [expressions, setExpressions] = useState<Expression[]>([]);

  useEffect(() => {
    fetch(`/api/content/${contentId}`)
      .then((r) => r.json())
      .then((data) => setExpressions(data.expressions));
  }, [contentId]);

  async function handleComplete() {
    await fetch(`/api/progress/${contentId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: "expressions" }),
    });
    router.push(`/learn/${contentId}/quiz`);
  }

  if (!expressions.length) return <div className="p-6 text-muted-silver">Loading...</div>;

  return (
    <div className="max-w-[800px] mx-auto px-6 py-12">
      <span className="text-[12px] font-semibold text-framer-blue tracking-[2px] uppercase">
        Step 3 · Expressions
      </span>
      <h2 className="text-[32px] font-semibold tracking-[-1px] leading-[1.13] mt-2 mb-8">
        Learn key expressions
      </h2>

      <ExpressionList expressions={expressions} />

      <div className="mt-10 flex justify-end">
        <Button onClick={handleComplete}>Next: Quiz</Button>
      </div>
    </div>
  );
}

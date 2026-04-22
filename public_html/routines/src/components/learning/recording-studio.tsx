"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLevel } from "@/contexts/level-context";
import { Button } from "@/components/ui/button";
import { RecordingCard, RecordingSummary } from "./recording-card";

interface RecordingStudioProps {
  contentId: string;
  onComplete: () => void;
  onSkip: () => void;
}

interface AnswerItem {
  id: number;
  questionIndex: number;
  question: string;
  recommendedSentence: string;
  latestRecording: RecordingSummary | null;
}

export function RecordingStudio({ contentId, onComplete, onSkip }: RecordingStudioProps) {
  const { level, ready } = useLevel();
  const router = useRouter();
  const [answers, setAnswers] = useState<AnswerItem[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadAnswers = useCallback(async () => {
    if (!ready || !level) return;
    try {
      const r = await fetch(`/api/interview-answer?contentId=${contentId}&level=${level}`);
      if (!r.ok) throw new Error(`Failed (${r.status})`);
      const data = (await r.json()) as { answers: AnswerItem[] };
      setAnswers(data.answers);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "불러오기 실패");
    }
  }, [contentId, level, ready]);

  useEffect(() => {
    loadAnswers();
  }, [loadAnswers]);

  if (!ready || answers === null) {
    return (
      <div className="text-muted-silver">
        {loadError ? `오류: ${loadError}` : "불러오는 중..."}
      </div>
    );
  }

  if (answers.length === 0) {
    return (
      <div className="space-y-4">
        <div className="bg-near-black rounded-xl p-5 text-[14px] text-white/80 leading-[1.6]">
          아직 답변한 질문이 없어요. 인터뷰로 돌아가서 답변하면 여기서 녹음할 수 있어요.
        </div>
        <div className="flex gap-3">
          <Button variant="frosted" onClick={() => router.push(`/learn/${contentId}/interview`)}>
            인터뷰로 돌아가기
          </Button>
          <Button variant="ghost" onClick={onSkip}>
            이 스텝 건너뛰기
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        {answers.map((a) => (
          <RecordingCard
            key={a.id}
            interviewAnswerId={a.id}
            questionIndex={a.questionIndex}
            question={a.question}
            recommendedSentence={a.recommendedSentence}
            initialRecording={a.latestRecording}
          />
        ))}
      </div>

      <div className="flex gap-3">
        <Button onClick={onComplete}>스텝 완료</Button>
        <Button variant="ghost" onClick={onSkip}>이 스텝 건너뛰기</Button>
      </div>
    </div>
  );
}

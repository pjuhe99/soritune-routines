"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Card } from "@/components/ui/card";

interface StreakInfo {
  currentStreak: number;
  longestStreak: number;
  lastCompleted: string | null;
}

interface ProgressItem {
  contentId: number;
  step: string;
  completed: boolean;
  skipped: boolean;
  score: number | null;
  completedAt: string;
}

export default function ProfilePage() {
  const { data: session } = useSession();
  const [streak, setStreak] = useState<StreakInfo | null>(null);
  const [progress, setProgress] = useState<ProgressItem[]>([]);

  useEffect(() => {
    Promise.all([
      fetch("/api/streak").then((r) => r.json()),
      fetch("/api/progress").then((r) => r.json()),
    ]).then(([s, p]) => {
      setStreak(s);
      setProgress(p);
    });
  }, []);

  // Count unique completed contents
  const completedContents = new Set(
    progress
      .filter((p) => p.completed || p.skipped)
      .map((p) => p.contentId)
  );

  return (
    <div className="max-w-container mx-auto px-6 py-12">
      <h1 className="text-[32px] font-semibold tracking-[-1px] leading-[1.13] mb-8">
        프로필
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
        <Card variant="surface">
          <p className="text-[13px] text-muted-silver mb-2">현재 스트릭</p>
          <p className="text-[32px] font-bold text-framer-blue tracking-[-1px]">
            {streak?.currentStreak ?? 0}일
          </p>
        </Card>
        <Card variant="surface">
          <p className="text-[13px] text-muted-silver mb-2">최장 스트릭</p>
          <p className="text-[32px] font-bold text-white tracking-[-1px]">
            {streak?.longestStreak ?? 0}일
          </p>
        </Card>
        <Card variant="surface">
          <p className="text-[13px] text-muted-silver mb-2">학습한 콘텐츠</p>
          <p className="text-[32px] font-bold text-white tracking-[-1px]">
            {completedContents.size}개
          </p>
        </Card>
      </div>

      <h2 className="text-[20px] font-semibold tracking-[-0.8px] mb-4">계정 정보</h2>
      <Card variant="surface">
        <div className="space-y-3 text-[15px]">
          <div className="flex justify-between">
            <span className="text-muted-silver">이메일</span>
            <span>{session?.user?.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-silver">이름</span>
            <span>{session?.user?.name || "-"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-silver">구독</span>
            <span className={session?.user?.subscriptionStatus === "active" ? "text-green-400" : "text-muted-silver"}>
              {session?.user?.subscriptionStatus === "active" ? "구독 중" : "무료"}
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
}

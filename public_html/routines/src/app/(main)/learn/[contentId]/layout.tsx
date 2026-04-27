import { SpeechProvider } from "@/contexts/speech-context";
import { requireUser } from "@/lib/auth-helpers";
import { parseLevel } from "@/lib/level";
import {
  progressMapForLevel,
  progressSummaryByLevel,
} from "@/lib/progress";
import { LearnTopBar } from "@/components/learn/learn-top-bar";

export default async function LearnLayout({
  children,
  params,
  searchParams,
}: {
  children: React.ReactNode;
  params: Promise<{ contentId: string }>;
  searchParams?: Promise<{ level?: string }>;
}) {
  const { contentId } = await params;
  const sp = searchParams ? await searchParams : {};
  const level = parseLevel(sp.level) ?? "beginner";
  const cId = parseInt(contentId, 10);

  const { userId } = await requireUser();
  const [progress, progressByLevel] = await Promise.all([
    progressMapForLevel(userId, cId, level),
    progressSummaryByLevel(userId, cId),
  ]);

  return (
    <SpeechProvider>
      <LearnTopBar
        contentId={cId}
        currentLevel={level}
        progress={progress}
        progressByLevel={progressByLevel}
      />
      <div className="max-w-[900px] mx-auto">{children}</div>
    </SpeechProvider>
  );
}

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { todayKST } from "@/lib/date";

const STEPS = [
  { key: "reading", label: "읽기" },
  { key: "listening", label: "듣기" },
  { key: "expressions", label: "표현" },
  { key: "quiz", label: "퀴즈" },
  { key: "interview", label: "AI 인터뷰" },
  { key: "speaking", label: "말하기" },
] as const;

export default async function Home() {
  const today = todayKST();
  const content = await prisma.content.findFirst({
    where: { publishedAt: today, isActive: true },
    orderBy: { priority: "desc" },
    select: {
      id: true,
      title: true,
      subtitle: true,
      genre: true,
      keyPhrase: true,
      keyKo: true,
    },
  });

  if (!content) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] px-6">
        <h1 className="text-hero text-text-primary text-center">Routines</h1>
        <p className="mt-6 text-body text-text-secondary text-center max-w-[600px]">
          오늘의 콘텐츠가 아직 없습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-[900px] mx-auto px-6 py-12">
      <h1 className="text-hero text-text-primary text-center">Routines</h1>
      <p className="mt-4 text-body text-text-secondary text-center">
        매일 하나의 영어 콘텐츠로 학습 루틴을 만드세요
      </p>

      <div className="mt-12 bg-surface border border-border-default rounded-lg p-8">
        <span className="text-caption font-semibold text-brand-primary tracking-[2px] uppercase">
          {content.genre}
        </span>
        <h2 className="text-display font-bold mt-2 mb-3">{content.title}</h2>
        {content.subtitle && (
          <p className="text-body text-text-secondary">{content.subtitle}</p>
        )}
        <p className="mt-4 text-body">
          <span className="text-brand-primary font-medium">{content.keyPhrase}</span>
          <span className="text-text-secondary ml-2">{content.keyKo}</span>
        </p>
      </div>

      <Link
        href={`/learn/${content.id}/reading`}
        className="mt-6 block bg-brand-primary rounded-lg px-6 py-5 text-center text-text-inverse text-body font-semibold hover:bg-brand-primary-hover active:bg-brand-primary-active transition-colors"
      >
        시작하기
      </Link>

      <ol className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2 text-caption text-text-secondary justify-center">
        {STEPS.map((step, i) => (
          <li key={step.key} className="flex items-center gap-3">
            <span className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-bg-subtle text-caption text-text-tertiary">
                {i + 1}
              </span>
              <span>{step.label}</span>
            </span>
            {i < STEPS.length - 1 && (
              <span className="text-text-tertiary" aria-hidden="true">→</span>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { todayKST } from "@/lib/date";
import { Button } from "@/components/ui/button";

export default async function Home() {
  const today = todayKST();
  const content = await prisma.content.findFirst({
    where: { publishedAt: today, isActive: true },
    orderBy: { priority: "desc" },
    select: {
      title: true,
      subtitle: true,
      genre: true,
      keyPhrase: true,
      keyKo: true,
    },
  });

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] px-6">
      <h1 className="text-hero text-text-primary text-center">
        Routines
      </h1>
      <p className="mt-6 text-body text-text-secondary text-center max-w-[600px]">
        매일 하나의 영어 콘텐츠로 학습 루틴을 만드세요
      </p>

      {content && (
        <div className="mt-12 bg-surface border border-border-default rounded-lg p-8 max-w-[600px] w-full text-center">
          <span className="text-caption font-semibold text-brand-primary tracking-[2px] uppercase">
            오늘의 콘텐츠
          </span>
          <h2 className="text-title text-text-primary mt-3">
            {content.title}
          </h2>
          {content.subtitle && (
            <p className="text-body text-text-secondary mt-2">
              {content.subtitle}
            </p>
          )}
          <p className="mt-4 text-body">
            <span className="text-brand-primary font-medium">{content.keyPhrase}</span>
            <span className="text-text-secondary ml-2">{content.keyKo}</span>
          </p>
        </div>
      )}

      <Link href="/today" className="mt-10">
        <Button>오늘 학습 시작하기</Button>
      </Link>
    </div>
  );
}

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
      <h1 className="text-[110px] font-bold leading-[0.85] tracking-[-5.5px] text-white text-center max-md:text-[62px] max-md:tracking-[-3.1px]">
        Routines
      </h1>
      <p className="mt-6 text-[18px] text-muted-silver tracking-[-0.01px] leading-[1.6] text-center">
        매일 하나의 영어 콘텐츠로 학습 루틴을 만드세요
      </p>

      {content && (
        <div className="mt-12 bg-near-black shadow-ring-blue rounded-xl p-8 max-w-[600px] w-full text-center">
          <span className="text-[12px] font-semibold text-framer-blue tracking-[2px] uppercase">
            오늘의 콘텐츠
          </span>
          <h2 className="text-[24px] font-semibold tracking-[-0.01px] leading-[1.3] mt-3">
            {content.title}
          </h2>
          {content.subtitle && (
            <p className="text-[15px] text-muted-silver mt-2 leading-[1.6]">
              {content.subtitle}
            </p>
          )}
          <p className="mt-4 text-[15px]">
            <span className="text-framer-blue">{content.keyPhrase}</span>
            <span className="text-muted-silver ml-2">{content.keyKo}</span>
          </p>
        </div>
      )}

      <Link href="/today" className="mt-10">
        <Button>오늘 학습 시작하기</Button>
      </Link>
    </div>
  );
}

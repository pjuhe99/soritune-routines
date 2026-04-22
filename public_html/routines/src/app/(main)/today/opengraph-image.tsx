import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";
import { todayKSTDate } from "@/lib/date";
import { OgCard } from "@/lib/og-card";
import { getPretendardFonts } from "@/lib/og-fonts";

export const alt = "오늘의 영어 콘텐츠 — Routines";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
// DB-backed image; cache 10 minutes rather than forever so new content picks up.
export const revalidate = 600;
export const dynamic = "force-dynamic";

export default async function Image() {
  const { bold, regular } = await getPretendardFonts();
  const today = todayKSTDate();
  const c = await prisma.content.findFirst({
    where: { publishedAt: today, isActive: true },
    orderBy: { priority: "desc" },
    select: { title: true, subtitle: true, genre: true, keyPhrase: true, keyKo: true },
  });

  const node = c ? (
    <OgCard
      genre={c.genre}
      title={c.title}
      subtitle={c.subtitle}
      keyPhrase={c.keyPhrase}
      keyKo={c.keyKo}
      stepLabel="오늘의 콘텐츠"
    />
  ) : (
    <OgCard
      title="오늘의 콘텐츠 준비 중"
      subtitle="매일 영어 루틴을 이어가는 소리튠의 데일리 콘텐츠"
      keyPhrase="Routines"
      keyKo="소리튠"
    />
  );

  return new ImageResponse(node, {
    ...size,
    fonts: [
      { name: "Pretendard", data: bold, weight: 700, style: "normal" },
      { name: "Pretendard", data: regular, weight: 400, style: "normal" },
    ],
  });
}

import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";
import { OgCard } from "@/lib/og-card";
import { getPretendardFonts } from "@/lib/og-fonts";

export const alt = "소리튠 루틴 학습 콘텐츠";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 3600;

export default async function Image({
  params,
}: {
  params: Promise<{ contentId: string }>;
}) {
  const { bold, regular } = await getPretendardFonts();
  const { contentId } = await params;
  const id = parseInt(contentId, 10);

  const c = Number.isFinite(id)
    ? await prisma.content.findFirst({
        where: { id, isActive: true },
        select: { title: true, subtitle: true, genre: true, keyPhrase: true, keyKo: true },
      })
    : null;

  const node = c ? (
    <OgCard
      genre={c.genre}
      title={c.title}
      subtitle={c.subtitle}
      keyPhrase={c.keyPhrase}
      keyKo={c.keyKo}
    />
  ) : (
    <OgCard
      title="소리튠 루틴 콘텐츠"
      subtitle="매일 영어 학습 루틴을 이어가세요"
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

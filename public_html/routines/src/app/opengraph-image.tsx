import { ImageResponse } from "next/og";
import { OgCard } from "@/lib/og-card";
import { getPretendardFonts } from "@/lib/og-fonts";

export const alt = "SoriTune Routines — Daily English Routine";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const { bold, regular } = await getPretendardFonts();
  return new ImageResponse(
    (
      <OgCard
        title="매일 한 편의 영어 콘텐츠로 루틴을 만들다"
        subtitle="읽기 · 듣기 · 표현 · 퀴즈 · AI 인터뷰 · 말하기 6단계"
        keyPhrase="Routines"
        keyKo="소리튠과 함께"
      />
    ),
    {
      ...size,
      fonts: [
        { name: "Pretendard", data: bold, weight: 700, style: "normal" },
        { name: "Pretendard", data: regular, weight: 400, style: "normal" },
      ],
    }
  );
}

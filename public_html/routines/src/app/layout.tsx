import type { Metadata } from "next";
import { SessionProvider } from "@/components/session-provider";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://routines.soritune.com"),
  title: "Routines — Daily English Routine",
  description: "매일 하나의 영어 콘텐츠로 학습 루틴을 만드세요",
  openGraph: {
    title: "Routines — Daily English Routine",
    description: "매일 하나의 영어 콘텐츠로 6단계 학습 루틴을 만드세요. 듣기, 읽기, 쓰기, 말하기까지.",
    url: "https://routines.soritune.com",
    siteName: "Routines by SoriTune",
    type: "website",
    locale: "ko_KR",
  },
  twitter: {
    card: "summary_large_image",
    title: "Routines — Daily English Routine",
    description: "매일 하나의 영어 콘텐츠로 6단계 학습 루틴을 만드세요.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css"
        />
      </head>
      <body className="font-pretendard bg-bg-page text-text-primary min-h-screen">
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}

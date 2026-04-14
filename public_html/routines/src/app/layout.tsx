import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Routines — Daily English Routine",
  description: "매일 하나의 영어 콘텐츠로 학습 루틴을 만드세요",
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
      <body className="font-pretendard bg-void-black text-white min-h-screen">
        {children}
      </body>
    </html>
  );
}

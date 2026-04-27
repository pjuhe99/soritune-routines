import { Suspense } from "react";
import { SpeechProvider } from "@/contexts/speech-context";
import { LearnTopBar } from "@/components/learn/learn-top-bar";

export default async function LearnLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ contentId: string }>;
}) {
  const { contentId } = await params;
  const cId = parseInt(contentId, 10);
  return (
    <SpeechProvider>
      <Suspense
        fallback={
          <div className="sticky top-16 z-10 min-h-[112px] border-b border-border-default" />
        }
      >
        <LearnTopBar contentId={cId} />
      </Suspense>
      <div className="max-w-[900px] mx-auto">{children}</div>
    </SpeechProvider>
  );
}

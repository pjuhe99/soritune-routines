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
      <LearnTopBar contentId={cId} />
      <div className="max-w-[900px] mx-auto">{children}</div>
    </SpeechProvider>
  );
}

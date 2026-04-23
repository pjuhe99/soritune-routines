import { SpeechProvider } from "@/contexts/speech-context";

export default function LearnLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SpeechProvider>
      <div className="max-w-[900px] mx-auto">{children}</div>
    </SpeechProvider>
  );
}

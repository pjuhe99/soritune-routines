import { SpeechProvider } from "@/contexts/speech-context";

export default function LearnLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SpeechProvider>{children}</SpeechProvider>;
}

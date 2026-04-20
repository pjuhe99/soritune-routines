import { Nav } from "@/components/nav";
import { LevelProvider } from "@/contexts/level-context";
import { LevelGate } from "@/components/level-gate";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <LevelProvider>
      <LevelGate>
        <Nav />
        <main className="pt-16 min-h-screen">{children}</main>
      </LevelGate>
    </LevelProvider>
  );
}

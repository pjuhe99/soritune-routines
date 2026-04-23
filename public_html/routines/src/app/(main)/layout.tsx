import { Nav } from "@/components/nav";
import { LevelProvider } from "@/contexts/level-context";
import { LevelGate } from "@/components/level-gate";
import { SplashIntro } from "@/components/splash-intro";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <SplashIntro />
      <LevelProvider>
        <LevelGate>
          <Nav />
          <main className="pt-16 min-h-screen">
            <div className="max-w-[1200px] mx-auto">{children}</div>
          </main>
        </LevelGate>
      </LevelProvider>
    </>
  );
}

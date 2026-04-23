"use client";

import { useEffect, useState, type CSSProperties } from "react";

const SRC = ["S", "o", "r", "i", "T", "u", "n", "e"];
const TGT = ["R", "o", "u", "t", "i", "n", "e", "s"];
const TX: [number, number][] = [
  [-70, -55],
  [-35, 65],
  [28, -75],
  [85, -28],
  [-55, 48],
  [48, 75],
  [-85, 18],
  [65, -55],
];
const ROT = [-28, 22, -18, 38, 24, -32, 16, -22];

type Phase = "init" | "scatter" | "assemble" | "fadingOut" | "gone";

export function SplashIntro() {
  const [phase, setPhase] = useState<Phase>("init");

  useEffect(() => {
    if (sessionStorage.getItem("splash_shown")) {
      setPhase("gone");
      return;
    }
    sessionStorage.setItem("splash_shown", "1");
    setPhase("scatter");

    const t1 = setTimeout(() => setPhase("assemble"), 1100);
    const t2 = setTimeout(() => setPhase("fadingOut"), 3000);
    const t3 = setTimeout(() => setPhase("gone"), 3500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  if (phase === "init" || phase === "gone") return null;

  const handleSkip = () => {
    setPhase("fadingOut");
    setTimeout(() => setPhase("gone"), 300);
  };

  const chars = phase === "scatter" ? SRC : TGT;
  const showSubtitle = phase === "assemble" || phase === "fadingOut";

  return (
    <div
      onClick={handleSkip}
      role="presentation"
      className={`fixed inset-0 z-[9999] bg-bg-page flex flex-col items-center justify-center cursor-pointer transition-opacity duration-500 ${
        phase === "fadingOut" ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      <div
        className="flex items-baseline mb-8"
        aria-label={phase === "scatter" ? "Soritune" : "Routines"}
      >
        {chars.map((ch, i) => (
          <span
            key={`${phase}-${i}`}
            className="text-[56px] md:text-[80px] font-bold text-text-primary leading-none"
            style={
              {
                letterSpacing: "-0.05em",
                animation:
                  phase === "scatter"
                    ? `splash-scatter 0.9s cubic-bezier(.22,1,.36,1) ${i * 0.07}s both`
                    : `splash-assemble 0.75s cubic-bezier(.22,1,.36,1) ${i * 0.05}s both`,
                "--tx": `translate(${TX[i][0]}px,${TX[i][1]}px)`,
                "--rot": `${ROT[i]}deg`,
              } as CSSProperties
            }
          >
            {ch}
          </span>
        ))}
      </div>
      <div
        className={`text-caption text-brand-primary uppercase transition-opacity duration-500 ${
          showSubtitle ? "opacity-100" : "opacity-0"
        }`}
        style={{
          letterSpacing: "0.2em",
          transitionDelay: showSubtitle ? "300ms" : "0ms",
        }}
      >
        Daily English Routines
      </div>
      <div
        className={`absolute bottom-14 w-9 h-[1.5px] bg-brand-primary transition-opacity duration-500 ${
          showSubtitle ? "opacity-100" : "opacity-0"
        }`}
        style={{
          transitionDelay: showSubtitle ? "700ms" : "0ms",
        }}
      />
    </div>
  );
}

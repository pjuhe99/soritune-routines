"use client";

import { useEffect, useState, type CSSProperties } from "react";

// SORITUNE → ROUTINES: 실제 애너그램 (같은 8글자, 순서만 다름)
// S(0)→7, O(1)→1, R(2)→0, I(3)→4, T(4)→3, U(5)→2, N(6)→5, E(7)→6
const LETTERS = ["S", "O", "R", "I", "T", "U", "N", "E"];
const DELTAS = [7, 0, -2, 1, -1, -3, -1, -1];
const SLOT = 0.68; // em, 각 글자 슬롯 폭 (글자 + 약간의 여백)

type Phase = "init" | "loaded" | "rearranged" | "fadingOut" | "gone";

export function SplashIntro() {
  const [phase, setPhase] = useState<Phase>("init");

  useEffect(() => {
    if (sessionStorage.getItem("splash_shown")) {
      setPhase("gone");
      return;
    }
    sessionStorage.setItem("splash_shown", "1");
    setPhase("loaded");

    const timers = [
      setTimeout(() => setPhase("rearranged"), 900),
      setTimeout(() => setPhase("fadingOut"), 3200),
      setTimeout(() => setPhase("gone"), 3700),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  if (phase === "init" || phase === "gone") return null;

  const handleSkip = () => {
    setPhase("fadingOut");
    setTimeout(() => setPhase("gone"), 300);
  };

  const rearranged = phase === "rearranged" || phase === "fadingOut";

  return (
    <div
      onClick={handleSkip}
      role="presentation"
      className={`fixed inset-0 z-[9999] bg-bg-page flex flex-col items-center justify-center cursor-pointer transition-opacity duration-500 ${
        phase === "fadingOut" ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      <div className="flex mb-8 text-text-primary font-bold" style={{ lineHeight: 1 }}>
        {LETTERS.map((ch, i) => (
          <span
            key={i}
            style={
              {
                display: "inline-block",
                width: `${SLOT}em`,
                textAlign: "center",
                fontSize: "clamp(44px, 9vw, 80px)",
                transform: rearranged
                  ? `translateX(${DELTAS[i] * SLOT}em)`
                  : "translateX(0)",
                transition: "transform 1s cubic-bezier(.65,0,.35,1)",
                transitionDelay: rearranged ? `${i * 0.04}s` : "0s",
              } as CSSProperties
            }
          >
            {ch}
          </span>
        ))}
      </div>
      <div
        className="text-caption text-brand-primary uppercase"
        style={{
          letterSpacing: "0.2em",
          opacity: rearranged ? 1 : 0,
          transition: "opacity 0.5s ease",
          transitionDelay: rearranged ? "1.3s" : "0s",
        }}
      >
        Daily English Routines
      </div>
      <div
        className="absolute bottom-14 w-9 h-[1.5px] bg-brand-primary"
        style={{
          opacity: rearranged ? 1 : 0,
          transition: "opacity 0.5s ease",
          transitionDelay: rearranged ? "1.6s" : "0s",
        }}
      />
    </div>
  );
}

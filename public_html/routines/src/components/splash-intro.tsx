"use client";

import { useEffect, useState, type CSSProperties } from "react";

// SORITUNE → ROUTINES: 실제 애너그램 (같은 8글자, 순서만 다름)
const LETTERS = ["S", "O", "R", "I", "T", "U", "N", "E"];
const ROUTINES = ["R", "O", "U", "T", "I", "N", "E", "S"];

// 각 글자의 슬롯 폭 (em). I는 좁고 나머지는 동일 (Pretendard Bold 기준 근사).
const WIDTHS: Record<string, number> = {
  S: 0.64,
  O: 0.64,
  R: 0.64,
  I: 0.38,
  T: 0.64,
  U: 0.64,
  N: 0.64,
  E: 0.64,
};

// SORITUNE 배치 상 각 글자의 시작 x 누적
const FROM_X = LETTERS.reduce<number[]>((arr, _, i) => {
  arr.push(i === 0 ? 0 : arr[i - 1] + WIDTHS[LETTERS[i - 1]]);
  return arr;
}, []);

// ROUTINES 배치 상 각 글자의 target x
const TARGET_X: Record<string, number> = (() => {
  const map: Record<string, number> = {};
  let cum = 0;
  for (const ch of ROUTINES) {
    map[ch] = cum;
    cum += WIDTHS[ch];
  }
  return map;
})();

// 각 SORITUNE 글자가 이동해야 할 delta (em)
const DELTAS = LETTERS.map((ch, i) => TARGET_X[ch] - FROM_X[i]);

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
                width: `${WIDTHS[ch]}em`,
                textAlign: "center",
                fontSize: "clamp(44px, 9vw, 80px)",
                transform: rearranged
                  ? `translateX(${DELTAS[i]}em)`
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

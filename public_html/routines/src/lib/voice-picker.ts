export type VoiceGender = "female" | "male";

export interface VoicePick {
  female: SpeechSynthesisVoice | null;
  male: SpeechSynthesisVoice | null;
}

const FEMALE_NAMES = [
  "Samantha",
  "Karen",
  "Moira",
  "Tessa",
  "Veena",
  "Allison",
  "Ava",
  "Susan",
  "Victoria",
  "Zira",
  "Google US English Female",
  "Microsoft Aria",
  "Microsoft Jenny",
];

const MALE_NAMES = [
  "Daniel",
  "Alex",
  "Aaron",
  "Fred",
  "Tom",
  "Oliver",
  "Rishi",
  "Google UK English Male",
  "Microsoft Guy",
  "Microsoft David",
];

function isEnglish(v: SpeechSynthesisVoice): boolean {
  return v.lang.toLowerCase().startsWith("en");
}

function langPriority(v: SpeechSynthesisVoice): number {
  const l = v.lang.toLowerCase();
  if (l.startsWith("en-us")) return 0;
  if (l.startsWith("en-gb")) return 1;
  return 2;
}

export function pickEnglishVoices(
  voices: SpeechSynthesisVoice[]
): VoicePick {
  const eng = voices
    .filter(isEnglish)
    .slice()
    .sort((a, b) => langPriority(a) - langPriority(b));

  let female: SpeechSynthesisVoice | null = null;
  let male: SpeechSynthesisVoice | null = null;

  // 1. Whitelist by name
  for (const v of eng) {
    if (!female && FEMALE_NAMES.some((n) => v.name.includes(n))) female = v;
    if (!male && MALE_NAMES.some((n) => v.name.includes(n))) male = v;
    if (female && male) break;
  }

  // 2. Keyword in name
  if (!female || !male) {
    for (const v of eng) {
      const n = v.name.toLowerCase();
      if (!female && n.includes("female")) {
        female = v;
        continue;
      }
      if (!male && n.includes("male") && !n.includes("female")) {
        male = v;
      }
      if (female && male) break;
    }
  }

  // 3. Fallback: only when neither slot was identified at all. Do NOT use `||` —
  // if female was named (e.g. Samantha) and only Karen remains, Karen should NOT
  // become male. Spec: "한쪽이 끝까지 비면 null" — leave the empty side null
  // rather than reusing a named voice as the opposite gender.
  if (!female && !male) {
    for (const v of eng) {
      if (!female) female = v;
      else if (!male) male = v;
      if (female && male) break;
    }
  }

  return { female, male };
}

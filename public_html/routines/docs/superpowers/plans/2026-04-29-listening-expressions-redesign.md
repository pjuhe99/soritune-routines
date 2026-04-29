# 듣기·표현 파트 재설계 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** routines 프로젝트의 듣기/표현 두 페이지에 남·여 음성 토글, 표현 발음기호(IPA), 접힘/펼침 카드 UI를 추가한다.

**Architecture:** Web Speech API 기반 voice 매핑 모듈을 분리(`voice-picker.ts`)하고 SpeechContext가 voice 목록을 노출. 듣기/표현 컴포넌트가 자체 voice 상태를 갖고 토글을 내장. Expression JSON에 `phonetic` 필드 추가(DB 마이그레이션 불필요), AI 프롬프트에 IPA 출력 규칙 추가, 기존 콘텐츠는 일회성 백필 스크립트로 채움. 표현 카드는 카드별 자체 펼침 상태를 가진 컴포넌트로 분리.

**Tech Stack:** Next.js (App Router) 16, React 19, TypeScript, Web Speech API, Vitest, Prisma, OpenAI SDK.

**Spec:** `docs/superpowers/specs/2026-04-29-listening-expressions-redesign-design.md`

---

## File Structure

| Path | Action | Responsibility |
|---|---|---|
| `src/lib/voice-picker.ts` | Create | 영어 voice 목록에서 남·여 voice를 골라내는 순수 함수 |
| `src/lib/voice-picker.test.ts` | Create | voice-picker 단위 테스트 |
| `src/contexts/speech-context.tsx` | Modify | `voicePick` 노출, `voiceschanged` 이벤트 청취 |
| `src/components/learning/voice-toggle.tsx` | Create | 남·여 세그먼트 토글 UI |
| `src/lib/expression-matching.ts` | Modify | `Expression` 인터페이스에 `phonetic?` 추가 |
| `src/lib/content-generation.ts` | Modify | `Expression` 타입 + validator에 `phonetic` 추가 |
| `src/lib/generation-prompts.ts` | Modify | AI 프롬프트에 IPA 출력 규칙 + 예시 JSON 갱신 |
| `src/app/(main)/learn/[contentId]/expressions/page.tsx` | Modify | 페이지 내 Expression 타입에 `phonetic` 추가 |
| `src/components/learning/listening-player.tsx` | Modify | VoiceToggle 흡수, selectedVoice 적용, 자동 보정, cancel/onerror |
| `src/components/learning/expression-list.tsx` | Modify | ExpressionCard 분리, voice 토글, 안내 문구, IPA, 접힘/펼침 |
| `src/components/learning/expression-popup.tsx` | Modify | reading 팝업에 IPA 한 줄 추가 |
| `scripts/backfill-expression-phonetics.ts` | Create | 기존 글의 phonetic 비어있는 expressions 백필 |

---

## Task 1: voice-picker.ts (TDD)

**Files:**
- Create: `src/lib/voice-picker.ts`
- Create: `src/lib/voice-picker.test.ts`

`voice-picker`는 순수 함수라 TDD로 진행. SpeechSynthesisVoice는 브라우저 타입이지만 lib.dom.d.ts에 있어 Node 환경에서도 import 가능하다 (Vitest는 typescript 컴파일만 함).

테스트에서는 `{ name, lang } as SpeechSynthesisVoice`로 최소 객체를 만든다.

- [ ] **Step 1: 테스트 파일 작성 (실패 상태)**

`src/lib/voice-picker.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { pickEnglishVoices } from "./voice-picker";

function v(name: string, lang: string): SpeechSynthesisVoice {
  return { name, lang, default: false, localService: true, voiceURI: name } as SpeechSynthesisVoice;
}

describe("pickEnglishVoices", () => {
  it("picks Samantha as female and Daniel as male via whitelist", () => {
    const result = pickEnglishVoices([
      v("Samantha", "en-US"),
      v("Daniel", "en-GB"),
    ]);
    expect(result.female?.name).toBe("Samantha");
    expect(result.male?.name).toBe("Daniel");
  });

  it("matches voices with 'female'/'male' keyword in the name", () => {
    const result = pickEnglishVoices([
      v("Google US English Female", "en-US"),
      v("Google UK English Male", "en-GB"),
    ]);
    expect(result.female?.name).toBe("Google US English Female");
    expect(result.male?.name).toBe("Google UK English Male");
  });

  it("prefers en-US over en-GB in fallback when names are unknown", () => {
    const result = pickEnglishVoices([
      v("Unknown UK 1", "en-GB"),
      v("Unknown US 1", "en-US"),
      v("Unknown US 2", "en-US"),
    ]);
    expect(result.female?.lang).toBe("en-US");
    expect(result.male?.lang).toBe("en-US");
  });

  it("returns null for missing male when only female voices available", () => {
    const result = pickEnglishVoices([
      v("Samantha", "en-US"),
      v("Karen", "en-US"),
    ]);
    expect(result.female?.name).toBe("Samantha");
    expect(result.male).toBeNull();
  });

  it("returns null for missing female when only male voices available", () => {
    const result = pickEnglishVoices([
      v("Daniel", "en-GB"),
      v("Alex", "en-US"),
    ]);
    expect(result.male).not.toBeNull();
    expect(result.female).toBeNull();
  });

  it("returns both null when no English voices in non-empty array", () => {
    const result = pickEnglishVoices([
      v("Yuna", "ko-KR"),
      v("Kyoko", "ja-JP"),
    ]);
    expect(result.female).toBeNull();
    expect(result.male).toBeNull();
  });

  it("returns both null for empty input", () => {
    const result = pickEnglishVoices([]);
    expect(result.female).toBeNull();
    expect(result.male).toBeNull();
  });

  it("falls back to filling slots when only unknown English voices exist", () => {
    const result = pickEnglishVoices([
      v("Unknown One", "en-US"),
      v("Unknown Two", "en-US"),
    ]);
    expect(result.female?.name).toBe("Unknown One");
    expect(result.male?.name).toBe("Unknown Two");
  });
});
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

Run: `cd /var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines && pnpm test src/lib/voice-picker.test.ts`

Expected: FAIL (`Cannot find module './voice-picker'` 또는 비슷한 메시지).

- [ ] **Step 3: voice-picker.ts 구현**

`src/lib/voice-picker.ts`:

```ts
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

  // 3. Fallback: fill remaining slots from English voices in priority order
  if (!female || !male) {
    for (const v of eng) {
      if (v === female || v === male) continue;
      if (!female) female = v;
      else if (!male) male = v;
      if (female && male) break;
    }
  }

  return { female, male };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd /var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines && pnpm test src/lib/voice-picker.test.ts`

Expected: PASS — 8 tests passed.

- [ ] **Step 5: Commit**

```bash
cd /var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines
git add src/lib/voice-picker.ts src/lib/voice-picker.test.ts
git commit -m "feat(voice-picker): add English voice male/female picker"
```

---

## Task 2: SpeechContext 확장 — voicePick 노출

**Files:**
- Modify: `src/contexts/speech-context.tsx` (전체 재작성)

브라우저 의존이라 단위 테스트 어려움. 빌드와 수동 검증으로 갈음.

- [ ] **Step 1: speech-context.tsx 재작성**

`src/contexts/speech-context.tsx`:

```tsx
"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { pickEnglishVoices, type VoicePick } from "@/lib/voice-picker";

interface SpeechCapabilities {
  ttsAvailable: boolean;
  voicePick: VoicePick;
}

const EMPTY_PICK: VoicePick = { female: null, male: null };

const SpeechContext = createContext<SpeechCapabilities>({
  ttsAvailable: false,
  voicePick: EMPTY_PICK,
});

export function SpeechProvider({ children }: { children: ReactNode }) {
  const [caps, setCaps] = useState<SpeechCapabilities>({
    ttsAvailable: false,
    voicePick: EMPTY_PICK,
  });

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }

    function refresh() {
      const voices = window.speechSynthesis.getVoices();
      setCaps({
        ttsAvailable: true,
        voicePick: pickEnglishVoices(voices),
      });
    }

    // Initial read (some browsers populate sync, some async)
    refresh();

    // Chrome populates voices asynchronously and fires voiceschanged
    function onVoicesChanged() {
      refresh();
    }
    window.speechSynthesis.addEventListener("voiceschanged", onVoicesChanged);

    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", onVoicesChanged);
    };
  }, []);

  return <SpeechContext.Provider value={caps}>{children}</SpeechContext.Provider>;
}

export function useSpeech() {
  return useContext(SpeechContext);
}
```

- [ ] **Step 2: 빌드 확인 (lint + typecheck)**

Run: `cd /var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines && pnpm lint`

Expected: 통과(또는 기존 경고만, 새 에러 없음).

Run: `cd /var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines && pnpm test src/lib/voice-picker.test.ts`

Expected: PASS (회귀 없음 확인).

- [ ] **Step 3: Commit**

```bash
cd /var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines
git add src/contexts/speech-context.tsx
git commit -m "feat(speech-context): expose voicePick from English voice list"
```

---

## Task 3: VoiceToggle 컴포넌트

**Files:**
- Create: `src/components/learning/voice-toggle.tsx`

세그먼트 2버튼 토글. voice가 null인 쪽은 disabled.

- [ ] **Step 1: voice-toggle.tsx 작성**

`src/components/learning/voice-toggle.tsx`:

```tsx
"use client";

import type { VoiceGender, VoicePick } from "@/lib/voice-picker";

interface VoiceToggleProps {
  value: VoiceGender;
  onChange: (next: VoiceGender) => void;
  pick: VoicePick;
}

export function VoiceToggle({ value, onChange, pick }: VoiceToggleProps) {
  const femaleAvailable = pick.female !== null;
  const maleAvailable = pick.male !== null;

  return (
    <div className="inline-flex rounded-lg border border-border-default overflow-hidden">
      <button
        type="button"
        disabled={!femaleAvailable}
        onClick={() => onChange("female")}
        title={
          !femaleAvailable
            ? "이 브라우저에서 여자 음성을 사용할 수 없습니다"
            : undefined
        }
        className={`px-3 py-1.5 text-caption transition-colors ${
          value === "female"
            ? "bg-brand-primary-light text-brand-primary font-medium"
            : "bg-surface text-text-secondary hover:bg-bg-subtle"
        } disabled:opacity-40 disabled:cursor-not-allowed`}
      >
        👩 여자
      </button>
      <button
        type="button"
        disabled={!maleAvailable}
        onClick={() => onChange("male")}
        title={
          !maleAvailable
            ? "이 브라우저에서 남자 음성을 사용할 수 없습니다"
            : undefined
        }
        className={`px-3 py-1.5 text-caption transition-colors border-l border-border-default ${
          value === "male"
            ? "bg-brand-primary-light text-brand-primary font-medium"
            : "bg-surface text-text-secondary hover:bg-bg-subtle"
        } disabled:opacity-40 disabled:cursor-not-allowed`}
      >
        👨 남자
      </button>
    </div>
  );
}
```

- [ ] **Step 2: 빌드 확인**

Run: `cd /var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines && pnpm lint`

Expected: 통과.

- [ ] **Step 3: Commit**

```bash
cd /var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines
git add src/components/learning/voice-toggle.tsx
git commit -m "feat(voice-toggle): add female/male segmented toggle component"
```

---

## Task 4: Expression 타입에 phonetic 추가 (matching + page)

**Files:**
- Modify: `src/lib/expression-matching.ts:1-10`
- Modify: `src/app/(main)/learn/[contentId]/expressions/page.tsx:9-14`

UI는 다음 task에서. 여기서는 타입만 동기화해 후속 task에서 컴파일 에러가 안 나게 한다.

- [ ] **Step 1: expression-matching.ts 타입 변경**

기존 `src/lib/expression-matching.ts:2`의 인터페이스에 `phonetic?: string`을 추가한다. 매칭 로직은 변경하지 않는다.

```ts
// 기존 (L1-7 부근)
export interface Expression {
  expression: string;
  meaning: string;
  explanation: string;
  example: string;
}

// 변경 후
export interface Expression {
  expression: string;
  phonetic?: string;
  meaning: string;
  explanation: string;
  example: string;
}
```

(나머지 파일 내용은 그대로.)

- [ ] **Step 2: expressions/page.tsx 타입 변경**

`src/app/(main)/learn/[contentId]/expressions/page.tsx`의 L9-14 Expression interface:

```ts
// 기존
interface Expression {
  expression: string;
  meaning: string;
  explanation: string;
  example: string;
}

// 변경 후
interface Expression {
  expression: string;
  phonetic: string;
  meaning: string;
  explanation: string;
  example: string;
}
```

(여기서는 옵셔널이 아닌 필수로 둔다 — API 응답에 항상 포함되도록 다음 task에서 보장. 빈 문자열은 허용.)

- [ ] **Step 3: 빌드 확인**

Run: `cd /var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines && pnpm lint`

Expected: 통과 (소비처가 phonetic을 아직 안 써서 새 에러 없음).

- [ ] **Step 4: Commit**

```bash
cd /var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines
git add src/lib/expression-matching.ts "src/app/(main)/learn/[contentId]/expressions/page.tsx"
git commit -m "feat(expressions): add phonetic field to Expression types"
```

---

## Task 5: content-generation.ts validator + 타입 변경

**Files:**
- Modify: `src/lib/content-generation.ts:43`
- Modify: `src/lib/content-generation.ts:189-203`

phonetic은 빈 문자열 허용. validator는 누락(undefined/null)도 빈 문자열로 정규화.

- [ ] **Step 1: 타입 변경 (L43)**

`src/lib/content-generation.ts`의 L43 expressions 타입:

```ts
// 기존
expressions: { expression: string; meaning: string; explanation: string; example: string }[];

// 변경 후
expressions: { expression: string; phonetic: string; meaning: string; explanation: string; example: string }[];
```

- [ ] **Step 2: validator 변경 (L189-203)**

`src/lib/content-generation.ts`의 L189-203 expressions.map 블록을 다음으로 교체:

```ts
  const expressions = o.expressions.map((e, i) => {
    if (typeof e !== "object" || e === null) throw new Error(`expressions[${i}]: not an object`);
    const x = e as Record<string, unknown>;
    for (const k of ["expression", "meaning", "explanation", "example"] as const) {
      if (typeof x[k] !== "string" || (x[k] as string).trim() === "") {
        throw new Error(`expressions[${i}].${k}: not a non-empty string`);
      }
    }
    // phonetic: optional. AI may omit, model may return non-string. Normalize to "".
    // Empty phonetic does NOT fail content generation — IPA is a nice-to-have, not blocking.
    const phonetic = typeof x.phonetic === "string" ? x.phonetic.trim() : "";
    return {
      expression: (x.expression as string).trim(),
      phonetic,
      meaning: (x.meaning as string).trim(),
      explanation: (x.explanation as string).trim(),
      example: (x.example as string).trim(),
    };
  });
```

- [ ] **Step 3: 빌드 + 기존 테스트 회귀 확인**

Run: `cd /var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines && pnpm test`

Expected: 모든 기존 테스트 통과 (validator 호환 확인).

Run: `cd /var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines && pnpm lint`

Expected: 통과.

- [ ] **Step 4: Commit**

```bash
cd /var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines
git add src/lib/content-generation.ts
git commit -m "feat(content-generation): accept phonetic field in Expression validator"
```

---

## Task 6: generation-prompts.ts에 IPA 출력 규칙 추가

**Files:**
- Modify: `src/lib/generation-prompts.ts:155-184`

프롬프트는 phonetic을 non-empty로 요구(품질 유도), validator는 빈 문자열 허용(안전망). 의도된 비대칭.

- [ ] **Step 1: expressions 스키마 설명 갱신 (L155-159)**

`src/lib/generation-prompts.ts`의 L155-159 expressions 항목 부분을 다음으로 교체:

```text
- expressions: 3 to 6 objects with { "expression": "...", "phonetic": "...", "meaning": "...", "explanation": "...", "example": "..." }.
  - "expression" (ENGLISH): the English expression itself — the learning target. MUST appear verbatim (case-insensitive) somewhere in the "paragraphs" text. If the phrase wouldn't fit naturally into a paragraph, do not include it as an expression.
  - "phonetic" (IPA): American English pronunciation in IPA, wrapped in slash notation. Example: /meɪk ə ɡʊd ɪmˈprɛʃən/. Must include the leading and trailing "/".
  - "meaning" (한국어): ${spec.expressionMeaning}
  - "explanation" (한국어): ${spec.expressionExplanation}
  - "example" (ENGLISH): ONE natural English example sentence using the expression.
```

- [ ] **Step 2: 예시 JSON 갱신 (L168-182)**

같은 파일 L168-182의 example shape 블록을 다음으로 교체:

```text
Example shape for ONE expression item (mimic the language pattern exactly):
{
  "expression": "make a good impression",
  "phonetic": "/meɪk ə ɡʊd ɪmˈprɛʃən/",
  "meaning": "${level === "beginner"
    ? "좋은 느낌을 주다."
    : level === "intermediate"
      ? "상대에게 긍정적인 첫인상을 남기다."
      : "상대의 호감과 신뢰를 이끌어내는 긍정적 인상을 형성하다."}",
  "explanation": "${level === "beginner"
    ? "새 사람을 처음 만나거나 새로운 곳에서 시작할 때 써요. '좋게 보이다'와 비슷한 뜻이에요. 웃으면서 인사하면 좋은 인상을 줄 수 있어요."
    : level === "intermediate"
      ? "면접, 첫 출근, 소개 자리 같은 격식 있는 상황에서 자주 쓰인다. 단순히 '좋아 보이다(look good)'와 달리 상대의 평가가 개입된다는 뉘앙스를 담는다. 비슷한 표현 'come across well'과 서로 바꿔 쓸 수 있다."
      : "면접·첫 미팅·사회적 첫 대면 등에서 '타인의 평가'라는 암묵적 긴장을 내포한다. 자주 쓰이는 연어는 'make a good impression on', 'make a lasting impression', 'struggle to make a good impression'이다. 자기 비하적 톤으로 쓰면 가벼운 아이러니를 드러낼 수 있다."}",
  "example": "I want to make a good impression on my new team."
}
```

- [ ] **Step 3: 빌드 + lint**

Run: `cd /var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines && pnpm lint`

Expected: 통과.

Run: `cd /var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines && pnpm build`

Expected: 빌드 성공.

- [ ] **Step 4: Commit**

```bash
cd /var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines
git add src/lib/generation-prompts.ts
git commit -m "feat(generation): add phonetic IPA field to expressions prompt"
```

---

## Task 7: listening-player.tsx에 VoiceToggle 통합

**Files:**
- Modify: `src/components/learning/listening-player.tsx` (전체 재작성)

selectedVoice 규칙, 자동 보정 effect, voice 변경 시 cancel + setPlayingIndex(null), onerror 핸들러 추가.

- [ ] **Step 1: listening-player.tsx 재작성**

`src/components/learning/listening-player.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useSpeech } from "@/contexts/speech-context";
import { Button } from "@/components/ui/button";
import { VoiceToggle } from "./voice-toggle";
import type { VoiceGender } from "@/lib/voice-picker";

interface ListeningPlayerProps {
  sentences: string[];
}

export function ListeningPlayer({ sentences }: ListeningPlayerProps) {
  const { ttsAvailable, voicePick } = useSpeech();
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const [gender, setGender] = useState<VoiceGender>("female");

  // Auto-correct when the chosen gender is unavailable but the other is available.
  useEffect(() => {
    if (gender === "female" && !voicePick.female && voicePick.male) {
      setGender("male");
    } else if (gender === "male" && !voicePick.male && voicePick.female) {
      setGender("female");
    }
  }, [voicePick.female, voicePick.male, gender]);

  const selectedVoice =
    voicePick[gender] ?? voicePick.female ?? voicePick.male ?? null;

  function speak(text: string, index: number) {
    if (!ttsAvailable) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 0.9;
    if (selectedVoice) utterance.voice = selectedVoice;
    utterance.onstart = () => setPlayingIndex(index);
    utterance.onend = () => setPlayingIndex(null);
    utterance.onerror = () => setPlayingIndex(null);
    window.speechSynthesis.speak(utterance);
  }

  function playAll() {
    if (!ttsAvailable) return;
    window.speechSynthesis.cancel();
    sentences.forEach((s, i) => {
      const utterance = new SpeechSynthesisUtterance(s);
      utterance.lang = "en-US";
      utterance.rate = 0.9;
      if (selectedVoice) utterance.voice = selectedVoice;
      utterance.onstart = () => setPlayingIndex(i);
      utterance.onerror = () => setPlayingIndex(null);
      if (i === sentences.length - 1) {
        utterance.onend = () => setPlayingIndex(null);
      }
      window.speechSynthesis.speak(utterance);
    });
  }

  function handleGenderChange(next: VoiceGender) {
    window.speechSynthesis.cancel();
    setPlayingIndex(null);
    setGender(next);
  }

  if (!ttsAvailable) {
    return (
      <div className="bg-warning/10 border border-warning/20 rounded-lg p-4 text-body text-warning leading-[1.6]">
        This browser does not support text-to-speech. Please read the sentences below aloud.
      </div>
    );
  }

  const showToggle = voicePick.female !== null || voicePick.male !== null;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        {showToggle ? (
          <VoiceToggle value={gender} onChange={handleGenderChange} pick={voicePick} />
        ) : (
          <span />
        )}
        <Button variant="secondary" onClick={playAll} className="text-caption">
          Play All
        </Button>
      </div>
      <div className="space-y-3">
        {sentences.map((s, i) => (
          <button
            key={i}
            onClick={() => speak(s, i)}
            className={`w-full text-left p-4 rounded-lg transition-all text-body leading-[1.6] border ${
              playingIndex === i
                ? "bg-brand-primary-light border-brand-primary text-text-primary"
                : "bg-surface border-border-default hover:bg-bg-subtle text-text-secondary"
            }`}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 빌드 + lint**

Run: `cd /var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines && pnpm lint`

Expected: 통과.

Run: `cd /var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines && pnpm build`

Expected: 빌드 성공.

- [ ] **Step 3: Commit**

```bash
cd /var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines
git add src/components/learning/listening-player.tsx
git commit -m "feat(listening): add voice toggle with selectedVoice fallback and error recovery"
```

---

## Task 8: ExpressionList + ExpressionCard 재작성

**Files:**
- Modify: `src/components/learning/expression-list.tsx` (전체 재작성)

접힘/펼침 상태는 카드별. ExpressionList는 voice 토글 + 안내 + 카드 리스트. 키보드/클릭 가드 적용.

- [ ] **Step 1: expression-list.tsx 재작성**

`src/components/learning/expression-list.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import type { KeyboardEvent, MouseEvent } from "react";
import { useSpeech } from "@/contexts/speech-context";
import { VoiceToggle } from "./voice-toggle";
import type { VoiceGender } from "@/lib/voice-picker";

interface Expression {
  expression: string;
  phonetic: string;
  meaning: string;
  explanation: string;
  example: string;
}

interface ExpressionListProps {
  expressions: Expression[];
}

export function ExpressionList({ expressions }: ExpressionListProps) {
  const { ttsAvailable, voicePick } = useSpeech();
  const [gender, setGender] = useState<VoiceGender>("female");

  useEffect(() => {
    if (gender === "female" && !voicePick.female && voicePick.male) {
      setGender("male");
    } else if (gender === "male" && !voicePick.male && voicePick.female) {
      setGender("female");
    }
  }, [voicePick.female, voicePick.male, gender]);

  const selectedVoice =
    voicePick[gender] ?? voicePick.female ?? voicePick.male ?? null;

  function speak(text: string) {
    if (!ttsAvailable) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    u.rate = 0.9;
    if (selectedVoice) u.voice = selectedVoice;
    window.speechSynthesis.speak(u);
  }

  function handleGenderChange(next: VoiceGender) {
    window.speechSynthesis.cancel();
    setGender(next);
  }

  const showToggle =
    ttsAvailable && (voicePick.female !== null || voicePick.male !== null);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-caption text-text-tertiary">
          💡 카드를 눌러 자세한 설명을 볼 수 있어요
        </p>
        {showToggle ? (
          <VoiceToggle value={gender} onChange={handleGenderChange} pick={voicePick} />
        ) : null}
      </div>
      <div className="space-y-4">
        {expressions.map((exp, i) => (
          <ExpressionCard
            key={i}
            expression={exp}
            ttsAvailable={ttsAvailable}
            onSpeak={() => speak(exp.expression)}
          />
        ))}
      </div>
    </div>
  );
}

interface ExpressionCardProps {
  expression: Expression;
  ttsAvailable: boolean;
  onSpeak: () => void;
}

function ExpressionCard({ expression: exp, ttsAvailable, onSpeak }: ExpressionCardProps) {
  const [expanded, setExpanded] = useState(false);

  function toggle() {
    setExpanded((v) => !v);
  }

  function onClickCard(e: MouseEvent<HTMLDivElement>) {
    // Don't toggle when the user clicks an inner button (e.g., the speaker).
    const target = e.target as HTMLElement;
    if (target.closest("button")) return;
    toggle();
  }

  function onKeyDownCard(e: KeyboardEvent<HTMLDivElement>) {
    // Only react when the outer card itself is focused, not a child button.
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggle();
    }
  }

  function onSpeakClick(e: MouseEvent) {
    e.stopPropagation();
    onSpeak();
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-expanded={expanded}
      onClick={onClickCard}
      onKeyDown={onKeyDownCard}
      className="bg-surface border border-border-default rounded-lg p-5 cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-primary"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-title font-semibold text-brand-primary">{exp.expression}</h3>
        <div className="flex items-center gap-2">
          {ttsAvailable && (
            <button
              type="button"
              onClick={onSpeakClick}
              className="text-text-tertiary hover:text-text-primary text-[18px] transition-colors"
              title="Listen"
            >
              🔊
            </button>
          )}
          <span
            aria-hidden
            className={`text-text-tertiary transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
          >
            ▾
          </span>
        </div>
      </div>
      {exp.phonetic ? (
        <p className="text-body text-text-secondary leading-[1.6] mt-1">{exp.phonetic}</p>
      ) : null}
      {expanded ? (
        <div className="mt-3 pt-3 border-t border-border-default">
          <p className="text-body text-text-primary leading-[1.6] mb-1">{exp.meaning}</p>
          <p className="text-body text-text-secondary leading-[1.7] mb-3">{exp.explanation}</p>
          <div className="bg-bg-page rounded-md p-3">
            <p className="text-body text-text-secondary leading-[1.6] italic">
              &quot;{exp.example}&quot;
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: 빌드 + lint**

Run: `cd /var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines && pnpm lint`

Expected: 통과.

Run: `cd /var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines && pnpm build`

Expected: 빌드 성공.

- [ ] **Step 3: Commit**

```bash
cd /var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines
git add src/components/learning/expression-list.tsx
git commit -m "feat(expressions): collapsible cards with IPA, voice toggle, hint"
```

---

## Task 9: ExpressionPopup에 IPA 한 줄 추가

**Files:**
- Modify: `src/components/learning/expression-popup.tsx:78`

reading 페이지 형광펜 클릭 팝업. expression 줄 아래에 IPA 추가.

- [ ] **Step 1: 팝업 본문에 IPA 줄 추가**

`src/components/learning/expression-popup.tsx`의 L77-80 본문 영역을 다음으로 교체:

```tsx
      <p className="text-body font-semibold text-brand-primary mb-1">{expression.expression}</p>
      {expression.phonetic ? (
        <p className="text-body text-text-secondary mb-2">{expression.phonetic}</p>
      ) : null}
      <p className="text-body text-text-primary mb-2">{expression.meaning}</p>
      <p className="text-body text-text-secondary leading-[1.7]">{expression.explanation}</p>
```

(L77 직전까지의 `<div ... >`와 ref/style 등은 그대로.)

- [ ] **Step 2: 빌드 + lint**

Run: `cd /var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines && pnpm lint`

Expected: 통과.

Run: `cd /var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines && pnpm build`

Expected: 빌드 성공.

- [ ] **Step 3: Commit**

```bash
cd /var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines
git add src/components/learning/expression-popup.tsx
git commit -m "feat(reading-popup): show IPA below expression in highlighter popup"
```

---

## Task 10: 백필 스크립트 — 기존 글의 phonetic 채우기

**Files:**
- Create: `scripts/backfill-expression-phonetics.ts`

OpenAI를 직접 호출(content-generation.ts와 동일 패턴). admin AI settings에서 active provider를 가져오는 대신 단순화를 위해 환경변수 `OPENAI_API_KEY`를 직접 사용. (이미 .env에 있음 — admin AI settings는 DB encrypted, 백필 스크립트는 일회성이라 별도 키 사용이 부담 없음.)

확인할 것: 기존 scripts/migrate-existing-articles.ts와 같이 `dotenv/config` import + `prisma` import 패턴을 따른다.

- [ ] **Step 1: 백필 스크립트 작성**

`scripts/backfill-expression-phonetics.ts`:

```ts
import "dotenv/config";
import OpenAI from "openai";
import type { Prisma } from "@prisma/client";
import { prisma } from "../src/lib/prisma";

const DRY_RUN = process.argv.includes("--dry");

interface ExpressionShape {
  expression: string;
  phonetic?: string;
  meaning: string;
  explanation: string;
  example: string;
}

const SYSTEM_PROMPT =
  "You produce American English IPA pronunciation for English words and phrases. " +
  'Always wrap each pronunciation in slash notation (e.g., "/meɪk ə ɡʊd ɪmˈprɛʃən/"). ' +
  "Return strict JSON only.";

function buildUserPrompt(expressions: string[]): string {
  return [
    "For each expression below, return the American English IPA pronunciation in slash notation.",
    "Output strict JSON: { \"phonetics\": [\"/.../\", \"/.../\", ...] } with the same length and order as the input.",
    "Do NOT include any other keys, comments, or markdown.",
    "",
    "Expressions:",
    ...expressions.map((e, i) => `${i + 1}. ${e}`),
  ].join("\n");
}

async function generatePhonetics(
  client: OpenAI,
  expressions: string[]
): Promise<string[] | null> {
  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserPrompt(expressions) },
    ],
    response_format: { type: "json_object" },
    temperature: 0,
  });
  const text = completion.choices[0]?.message?.content;
  if (!text) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const arr = (parsed as { phonetics?: unknown }).phonetics;
  if (!Array.isArray(arr)) return null;
  if (arr.length !== expressions.length) return null;
  return arr.map((v) => {
    if (typeof v !== "string") return "";
    const trimmed = v.trim();
    if (!trimmed) return "";
    // Slash-wrap if missing
    const wrapped =
      trimmed.startsWith("/") && trimmed.endsWith("/")
        ? trimmed
        : `/${trimmed.replace(/^\/+|\/+$/g, "")}/`;
    return wrapped;
  });
}

async function main() {
  console.log(`=== Backfill expression phonetics${DRY_RUN ? " (DRY)" : ""} ===`);

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey && !DRY_RUN) {
    console.error("OPENAI_API_KEY missing. Set it before running (without --dry).");
    process.exit(1);
  }
  const client = !DRY_RUN ? new OpenAI({ apiKey }) : null;

  const contents = await prisma.content.findMany({
    select: { id: true, title: true, expressions: true },
  });
  console.log(`Loaded ${contents.length} contents.`);

  let totalScanned = 0;
  let totalEmpty = 0;
  let totalFilled = 0;
  let batchesSucceeded = 0;
  let batchesFailed = 0;

  for (const content of contents) {
    const expressionsByLevel = content.expressions as
      | Record<string, ExpressionShape[]>
      | null;
    if (!expressionsByLevel || typeof expressionsByLevel !== "object") {
      console.log(`  skip id=${content.id}: expressions is not an object`);
      continue;
    }

    const updated: Record<string, ExpressionShape[]> = {};
    let mutated = false;

    for (const level of Object.keys(expressionsByLevel)) {
      const list = expressionsByLevel[level];
      if (!Array.isArray(list)) {
        updated[level] = list;
        continue;
      }

      totalScanned += list.length;
      const emptyIndexes: number[] = [];
      list.forEach((e, i) => {
        if (!e.phonetic || !e.phonetic.trim()) emptyIndexes.push(i);
      });
      totalEmpty += emptyIndexes.length;

      if (emptyIndexes.length === 0) {
        updated[level] = list;
        continue;
      }

      const newList: ExpressionShape[] = list.map((e) => ({ ...e }));

      if (DRY_RUN) {
        console.log(
          `  id=${content.id} level=${level}: ${emptyIndexes.length} empty (DRY)`
        );
        emptyIndexes.forEach((idx) => {
          console.log(`    [${idx}] ${list[idx].expression}`);
        });
        updated[level] = newList;
        continue;
      }

      const targets = emptyIndexes.map((idx) => list[idx].expression);
      let phonetics = await generatePhonetics(client!, targets);
      if (!phonetics) {
        // Retry once
        console.log(
          `  id=${content.id} level=${level}: batch failed, retrying once`
        );
        phonetics = await generatePhonetics(client!, targets);
      }

      if (!phonetics) {
        console.log(
          `  id=${content.id} level=${level}: batch failed twice, skipping`
        );
        batchesFailed += 1;
        updated[level] = newList;
        continue;
      }

      batchesSucceeded += 1;
      emptyIndexes.forEach((idx, j) => {
        const ipa = phonetics![j];
        if (ipa) {
          newList[idx].phonetic = ipa;
          totalFilled += 1;
          mutated = true;
        }
      });
      console.log(
        `  id=${content.id} level=${level}: filled ${
          emptyIndexes.filter((_, j) => phonetics![j]).length
        }/${emptyIndexes.length}`
      );
      updated[level] = newList;
    }

    if (mutated && !DRY_RUN) {
      await prisma.content.update({
        where: { id: content.id },
        data: { expressions: updated as unknown as Prisma.InputJsonValue },
      });
    }
  }

  console.log("=== Summary ===");
  console.log(`scanned expressions:      ${totalScanned}`);
  console.log(`empty before run:         ${totalEmpty}`);
  console.log(`filled this run:          ${totalFilled}`);
  console.log(`batches succeeded/failed: ${batchesSucceeded} / ${batchesFailed}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 2: dry-run으로 대상 확인**

Run: `cd /var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines && pnpm tsx scripts/backfill-expression-phonetics.ts --dry`

Expected: 콘솔에 글마다 비어있는 expression 인덱스/문자열이 찍힘. DB 변동 없음. Summary에 `filled this run: 0`.

- [ ] **Step 3: 본실행으로 IPA 채우기**

Run: `cd /var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines && pnpm tsx scripts/backfill-expression-phonetics.ts`

Expected: 각 글마다 "filled X/X" 로그. Summary에서 `empty before run` 만큼 `filled this run`.

검증 — 재실행 시 멱등성 확인:

Run: `cd /var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines && pnpm tsx scripts/backfill-expression-phonetics.ts --dry`

Expected: Summary에서 `empty before run: 0` (이미 모두 채워짐).

- [ ] **Step 4: Commit**

```bash
cd /var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines
git add scripts/backfill-expression-phonetics.ts
git commit -m "chore(scripts): add one-shot backfill for expression phonetics"
```

---

## Task 11: 빌드 검증 + PM2 restart + 수동 검증

**Files:**
- (구동 검증 only)

- [ ] **Step 1: 전체 빌드 + 테스트**

Run: `cd /var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines && pnpm test`

Expected: 모든 테스트 통과 (voice-picker 포함).

Run: `cd /var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines && pnpm build`

Expected: 빌드 성공.

Run: `cd /var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines && pnpm lint`

Expected: 통과.

- [ ] **Step 2: PM2 restart**

Run: `pm2 restart routines`

Expected: PM2 status에 `online` 상태로 재시작됨.

확인: `pm2 list | grep routines`

- [ ] **Step 3: 수동 검증 시나리오 수행**

브라우저에서 https://routines.soritune.com 진입 후 다음을 실행:

1. /today 또는 /archive에서 글 한 개 선택 → /learn/[id]/listening 진입.
2. Listening 페이지: 음성 토글이 보이는지(데스크탑/모바일). "여자"가 디폴트로 활성. 문장 클릭 → 재생. 토글 "남자"로 바꾸고 다른 문장 클릭 → 남자 voice로 재생.
3. 재생 중 토글 누르면 즉시 끊기는지. 카드 강조(playingIndex)가 즉시 사라지는지.
4. Play All 클릭 → 전체 재생. 도중 토글 → 끊김.
5. /learn/[id]/expressions 진입.
6. 카드들이 모두 접혀 있고 expression + IPA만 보이는지(IPA 백필 후).
7. "💡 카드를 눌러 자세한 설명을 볼 수 있어요" 안내가 좌측 상단, voice 토글이 우측 상단.
8. 카드 클릭 → 펼쳐짐. 다른 카드 클릭 → 둘 다 펼쳐짐(독립 펼침 확인).
9. 🔊 클릭 → 카드는 펼쳐지지 않고 음성만 재생.
10. Tab으로 카드 포커스 → Enter/Space → 펼침. 🔊에 포커스 가서 Enter 눌렀을 때 카드는 펼쳐지지 않는지.
11. Reading 페이지(/learn/[id]/reading)에서 형광펜 클릭 → 팝업에 IPA 한 줄 표시.
12. (가능하면) Windows Chrome 또는 영어 voice 1개만 깔린 환경에서 한쪽 토글 버튼이 disabled 되는지 확인.

- [ ] **Step 4: 검증 통과 후 push**

```bash
cd /var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines
git push origin main
```

검증 시 이슈가 발견되면 해당 task로 돌아가 수정 후 다시 PM2 restart.

---

## 자체 점검

- [x] **Spec 커버리지**:
  - 음성 소스 Web Speech API → Task 1, 2, 3, 7, 8.
  - 페이지별 디폴트 (지속 안 함) → Task 7, 8 useState.
  - 세그먼트 토글 + 디폴트 여자 → Task 3, 7, 8.
  - selectedVoice 결정 규칙 + 자동 보정 → Task 7, 8.
  - 둘 다 null일 때 토글 숨기고 기본 voice → Task 7, 8 `showToggle`.
  - voice 변경 시 cancel + setPlayingIndex(null) + onerror → Task 7.
  - Expression `phonetic` 필드 추가 → Task 4, 5.
  - 프롬프트 IPA 출력 + 비대칭 정책 → Task 6 + Task 5 validator.
  - IPA 표시 범위(expression만) → Task 8 카드, Task 9 팝업.
  - 백필 일회성 스크립트 + dry-run + 검증/안전장치 → Task 10.
  - 카드 독립 펼침, 디폴트 모두 접힘 → Task 8 카드 자체 useState.
  - 카드 전체 클릭 + 🔊 stopPropagation + 키보드 가드 → Task 8.
  - 안내 문구 → Task 8.
  - ExpressionPopup IPA → Task 9.
  - voice-picker 단위 테스트 시나리오 → Task 1.

- [x] **Placeholder 스캔**: TODO/TBD/"적절히" 없음. 모든 step에 실제 코드/명령.

- [x] **타입 일관성**: `VoiceGender`, `VoicePick`, `pickEnglishVoices`, `Expression`(phonetic 추가), `selectedVoice` 모두 일관됨. `ttsAvailable`, `voicePick` 두 필드만 SpeechCapabilities에서 노출.

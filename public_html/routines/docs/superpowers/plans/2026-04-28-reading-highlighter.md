# Reading Page Highlighter & Click-to-Reveal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Step 1 Reading 페이지에서 `keyPhrase` 1개만 brown 텍스트로 보이던 걸, `ContentVariant.expressions` 배열 전체를 노란 형광펜으로 칠하고 클릭 시 의미+설명 popup을 띄우는 구조로 전환한다.

**Architecture:** 매칭 로직은 `src/lib/expression-matching.ts`의 순수 함수(`tokenizeParagraph`)로 분리해 vitest로 단위 테스트하고, ReadingView가 토큰을 소비해 형광펜 span을 렌더한다. 클릭 시 신규 `ExpressionPopup` 컴포넌트가 anchor span 기준으로 위/아래 자동 배치되어 의미·설명을 노출한다. 신규 글의 expressions가 본문에 verbatim 등장하도록 `generation-prompts.ts`에 한 줄 보완.

**Tech Stack:** Next.js 16, React 19, Tailwind 4, Vitest 4 (node 환경), pnpm.

**Spec:** `docs/superpowers/specs/2026-04-28-reading-highlighter-design.md`

**Project root for all paths below:** `/var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines/`

---

## Context the engineer needs

- **vitest 셋업**: `vitest.config.ts`가 `environment: "node"` + `include: ["src/**/*.test.ts"]`. **`.test.tsx` 안 됨, jsdom 안 씀.** 모든 자동 테스트는 `src/lib/*.test.ts` 순수 함수 단위.
- **API는 이미 expressions 반환**: `src/app/api/content/[id]/route.ts:55`에서 `expressions: variant.expressions` 이미 응답에 포함. API/스키마 변경 없음.
- **`ContentVariant.expressions`는 `Json` 컬럼**: TypeScript 타입은 `unknown`. 페이지에서 받을 때 narrow한 타입으로 cast.
- **레벨별 데이터**: expressions는 `(contentId, level)` 조합당 한 세트. 현재 reading/page.tsx가 `level` query param 처리 잘 하고 있으니 그대로 둠.
- **`keyPhrase`는 다른 곳에서 계속 쓰임**: 글 목록·share preview·upcoming 등. 스키마/API/타 페이지 건드리지 말 것. **reading/page.tsx의 `Content` interface에서만** 제거.
- **Tailwind 4 임의 값 문법**: `bg-[var(--color-highlight)]`, `bg-[#FFE873]` 형태 사용 가능 (이 프로젝트 다른 곳에서도 사용 중, 예: `bg-bg-page`).
- **글로벌 토큰 정의 위치**: `src/app/globals.css`의 `@theme { ... }` 블록 (line 3~). `--color-...` prefix 패턴.
- **익명 사용자 지원**: reading 페이지는 로그인 없이도 동작. progress POST는 기존 로직 그대로 유지.
- **모든 commit 메시지 형식**: 기존 컨벤션 따라 `feat:`/`fix:`/`refactor:`/`chore:`/`docs:` prefix + 한 줄 요약. Co-Authored-By trailer 포함.
- **DB 마이그레이션 없음**: 데이터 모델 변경 없음.

---

## File Structure

### 신규 파일
| 경로 | 책임 |
|------|------|
| `src/lib/expression-matching.ts` | 순수 함수. paragraph + expressions[] 받아 토큰 배열 반환. 길이 ≤2 제외, longer-first greedy, case-insensitive, word boundary. |
| `src/lib/expression-matching.test.ts` | vitest 단위 테스트. 매칭 0/1/N건, overlap, case, 빈 배열, 짧은 표현, 구두점 인접. |
| `src/components/learning/expression-popup.tsx` | client component. anchor element + Expression 객체 받아 위/아래 자동 배치 popup 렌더. 외부 클릭/ESC로 닫힘. |

### 수정 파일
| 경로 | 변경 |
|------|------|
| `src/app/globals.css` | `@theme` 블록에 `--color-highlight: #FFF3A8`, `--color-highlight-hover: #FFE873` 추가. |
| `src/components/learning/reading-view.tsx` | props 교체 (`keyPhrase` → `expressions`), `tokenizeParagraph` 호출, 매치 토큰을 `<HighlightedSpan>` 클릭 핸들러 + 형광펜 스타일로 렌더. popup 상태 관리. |
| `src/app/(main)/learn/[contentId]/reading/page.tsx` | `Content` interface에 `expressions` 추가, `keyPhrase`/`keyKo` 제거. `<ReadingView>`에 `expressions` 전달. 하단 keyPhrase 카드 제거. |
| `src/lib/generation-prompts.ts` | line 155~159 expressions 항목에 verbatim 등장 규칙 한 줄 추가. |

---

## Tasks

### Task 1: globals.css에 highlight 색 토큰 추가

**Files:**
- Modify: `src/app/globals.css` (line 22 부근, `--color-text-brand-brown` 다음)

- [ ] **Step 1: 토큰 추가**

`src/app/globals.css`의 `--color-text-brand-brown: #7C4126;` 다음 줄에 highlight 섹션을 추가.

```css
  --color-text-brand-brown: #7C4126;

  /* ============ Highlight (Reading 형광펜) ============ */
  --color-highlight: #FFF3A8;
  --color-highlight-hover: #FFE873;

  /* ============ System messages (deep tones) ============ */
```

(기존 `/* ============ System messages ... */` 블록 바로 위에 끼워넣음)

- [ ] **Step 2: dev 서버 띄워서 컴파일 확인**

```bash
cd /var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines
pnpm dev
```

브라우저 접속 안 해도 됨. terminal에 컴파일 에러 없으면 Ctrl+C로 종료.

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "$(cat <<'EOF'
feat(theme): add highlight color tokens for reading page

reading 단계 형광펜용 노란색 토큰 추가.
- --color-highlight: #FFF3A8 (기본)
- --color-highlight-hover: #FFE873 (호버)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: expression-matching 순수 함수 — 실패하는 테스트 먼저

**Files:**
- Create: `src/lib/expression-matching.test.ts`

- [ ] **Step 1: 테스트 파일 작성**

`src/lib/expression-matching.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { tokenizeParagraph, type Expression } from "./expression-matching";

const exp = (expression: string, meaning = "의미", explanation = "설명", example = "ex"): Expression => ({
  expression,
  meaning,
  explanation,
  example,
});

describe("tokenizeParagraph", () => {
  it("매칭 대상 없으면 토큰 1개 (paragraph 전체)", () => {
    const result = tokenizeParagraph("This is a plain sentence.", []);
    expect(result).toEqual([{ text: "This is a plain sentence." }]);
  });

  it("expression 1개가 본문에 1번 등장", () => {
    const result = tokenizeParagraph(
      "I plan ahead every morning.",
      [exp("plan ahead")]
    );
    expect(result).toEqual([
      { text: "I " },
      { text: "plan ahead", expressionKey: "plan ahead" },
      { text: " every morning." },
    ]);
  });

  it("같은 expression이 본문에 2번 등장하면 둘 다 매칭, 같은 expressionKey", () => {
    const result = tokenizeParagraph(
      "plan ahead and plan ahead again.",
      [exp("plan ahead")]
    );
    const matches = result.filter((t) => t.expressionKey);
    expect(matches.length).toBe(2);
    expect(matches[0].expressionKey).toBe("plan ahead");
    expect(matches[1].expressionKey).toBe("plan ahead");
  });

  it("overlap 시 longer-first 우선 (긴 expression이 짧은 걸 잡아먹음)", () => {
    const result = tokenizeParagraph(
      "make a good impression on them",
      [exp("good impression"), exp("make a good impression")]
    );
    const matches = result.filter((t) => t.expressionKey);
    expect(matches.length).toBe(1);
    expect(matches[0].expressionKey).toBe("make a good impression");
    expect(matches[0].text).toBe("make a good impression");
  });

  it("case-insensitive 매칭, 원본 대소문자는 보존", () => {
    const result = tokenizeParagraph(
      "Plan Ahead is important.",
      [exp("plan ahead")]
    );
    const match = result.find((t) => t.expressionKey);
    expect(match).toBeDefined();
    expect(match!.text).toBe("Plan Ahead");
    expect(match!.expressionKey).toBe("plan ahead");
  });

  it("길이 ≤ 2 expression은 매칭 안 됨", () => {
    const result = tokenizeParagraph(
      "I go to the store.",
      [exp("go")]
    );
    expect(result).toEqual([{ text: "I go to the store." }]);
  });

  it("빈 expressions 배열 → 토큰 1개", () => {
    const result = tokenizeParagraph("Anything.", []);
    expect(result).toEqual([{ text: "Anything." }]);
  });

  it("구두점 인접 (plan ahead.) 정상 매칭", () => {
    const result = tokenizeParagraph(
      "Always plan ahead.",
      [exp("plan ahead")]
    );
    const match = result.find((t) => t.expressionKey);
    expect(match).toBeDefined();
    expect(match!.text).toBe("plan ahead");
  });

  it("부분 단어는 매칭 안 됨 (plan은 planet에 매칭되지 않음)", () => {
    const result = tokenizeParagraph(
      "I love planets.",
      [exp("plan")]
    );
    expect(result).toEqual([{ text: "I love planets." }]);
  });

  it("정규식 메타문자 escape (괄호/플러스)", () => {
    const result = tokenizeParagraph(
      "He used C++ today.",
      [exp("C++")]
    );
    const match = result.find((t) => t.expressionKey);
    expect(match).toBeDefined();
    expect(match!.text).toBe("C++");
  });
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

```bash
cd /var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines
pnpm test src/lib/expression-matching.test.ts
```

Expected: 컴파일 에러 — `Cannot find module './expression-matching'` 또는 비슷한 메시지.

---

### Task 3: expression-matching 구현

**Files:**
- Create: `src/lib/expression-matching.ts`

- [ ] **Step 1: 구현 작성**

`src/lib/expression-matching.ts`:

```ts
export interface Expression {
  expression: string;
  meaning: string;
  explanation: string;
  example: string;
}

export interface ParagraphToken {
  text: string;
  expressionKey?: string;
}

const MIN_EXPRESSION_LENGTH = 3;

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function tokenizeParagraph(
  paragraph: string,
  expressions: Expression[]
): ParagraphToken[] {
  const eligible = expressions
    .filter((e) => e.expression.length >= MIN_EXPRESSION_LENGTH)
    .sort((a, b) => b.expression.length - a.expression.length);

  if (eligible.length === 0) {
    return [{ text: paragraph }];
  }

  const pattern = eligible.map((e) => escapeRegex(e.expression)).join("|");
  const regex = new RegExp(`\\b(${pattern})\\b`, "gi");

  const tokens: ParagraphToken[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(paragraph)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ text: paragraph.slice(lastIndex, match.index) });
    }
    const matchedText = match[0];
    const matchedLower = matchedText.toLowerCase();
    const expressionKey = eligible.find(
      (e) => e.expression.toLowerCase() === matchedLower
    )?.expression;
    tokens.push({
      text: matchedText,
      expressionKey: expressionKey ?? matchedLower,
    });
    lastIndex = match.index + matchedText.length;
  }

  if (lastIndex < paragraph.length) {
    tokens.push({ text: paragraph.slice(lastIndex) });
  }

  return tokens;
}
```

- [ ] **Step 2: 테스트 실행 → 통과 확인**

```bash
pnpm test src/lib/expression-matching.test.ts
```

Expected: 모든 테스트 PASS (10건). 실패 시 어느 케이스가 깨졌는지 확인 후 구현 보정.

- [ ] **Step 3: Commit**

```bash
git add src/lib/expression-matching.ts src/lib/expression-matching.test.ts
git commit -m "$(cat <<'EOF'
feat(lib): add expression-matching tokenizer for reading highlights

paragraph + expressions[] 받아 토큰 배열 반환하는 순수 함수.
- 길이 < 3 expression 제외 (false positive 방지)
- longer-first greedy로 overlap 자동 해결
- case-insensitive + word boundary
- 정규식 메타문자 escape

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: ExpressionPopup 컴포넌트

**Files:**
- Create: `src/components/learning/expression-popup.tsx`

- [ ] **Step 1: 구현 작성**

`src/components/learning/expression-popup.tsx`:

```tsx
"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Expression } from "@/lib/expression-matching";

interface ExpressionPopupProps {
  anchor: HTMLElement;
  expression: Expression;
  onClose: () => void;
}

const POPUP_GAP = 8;

export function ExpressionPopup({ anchor, expression, onClose }: ExpressionPopupProps) {
  const popupRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; placement: "above" | "below" } | null>(null);

  useLayoutEffect(() => {
    const popup = popupRef.current;
    if (!popup) return;

    const anchorRect = anchor.getBoundingClientRect();
    const popupRect = popup.getBoundingClientRect();
    const viewportH = window.innerHeight;
    const viewportW = window.innerWidth;

    const spaceBelow = viewportH - anchorRect.bottom;
    const spaceAbove = anchorRect.top;
    const placement: "above" | "below" =
      spaceBelow >= popupRect.height + POPUP_GAP || spaceBelow >= spaceAbove
        ? "below"
        : "above";

    const top =
      placement === "below"
        ? anchorRect.bottom + window.scrollY + POPUP_GAP
        : anchorRect.top + window.scrollY - popupRect.height - POPUP_GAP;

    let left = anchorRect.left + window.scrollX;
    const maxLeft = viewportW + window.scrollX - popupRect.width - 8;
    const minLeft = window.scrollX + 8;
    if (left > maxLeft) left = maxLeft;
    if (left < minLeft) left = minLeft;

    setPos({ top, left, placement });
  }, [anchor, expression]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    function onPointer(e: MouseEvent | TouchEvent) {
      const target = e.target as Node;
      if (popupRef.current?.contains(target)) return;
      if (anchor.contains(target)) return;
      onClose();
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onPointer);
    window.addEventListener("touchstart", onPointer, { passive: true });
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onPointer);
      window.removeEventListener("touchstart", onPointer);
    };
  }, [anchor, onClose]);

  return (
    <div
      ref={popupRef}
      role="dialog"
      style={{
        position: "absolute",
        top: pos?.top ?? -9999,
        left: pos?.left ?? -9999,
        width: "min(360px, 90vw)",
        visibility: pos ? "visible" : "hidden",
      }}
      className="z-50 bg-surface border border-border-default rounded-lg p-4 shadow-[var(--shadow-overlay)]"
    >
      <p className="text-body font-semibold text-brand-primary mb-1">{expression.expression}</p>
      <p className="text-body text-text-primary mb-2">{expression.meaning}</p>
      <p className="text-body text-text-secondary leading-[1.7]">{expression.explanation}</p>
    </div>
  );
}
```

- [ ] **Step 2: 컴파일 확인**

```bash
pnpm dev
```

terminal에 컴파일 에러 없으면 Ctrl+C로 종료. (이 컴포넌트는 다음 task에서 사용되므로 아직 페이지 렌더 안 함.)

- [ ] **Step 3: Commit**

```bash
git add src/components/learning/expression-popup.tsx
git commit -m "$(cat <<'EOF'
feat(learning): add ExpressionPopup with auto above/below placement

reading 페이지 형광펜 클릭 시 anchor 기준으로 위/아래 자동 배치되는
popup. 외부 클릭/ESC로 닫힘. viewport 좌우 클램프 처리.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: ReadingView 재작성

**Files:**
- Modify: `src/components/learning/reading-view.tsx` (전체 교체)

- [ ] **Step 1: 파일 전체 교체**

`src/components/learning/reading-view.tsx`:

```tsx
"use client";

import { useMemo, useRef, useState } from "react";
import { tokenizeParagraph, type Expression } from "@/lib/expression-matching";
import { ExpressionPopup } from "./expression-popup";

interface ReadingViewProps {
  paragraphs: string[];
  expressions: Expression[];
}

export function ReadingView({ paragraphs, expressions }: ReadingViewProps) {
  const tokenized = useMemo(
    () => paragraphs.map((p) => tokenizeParagraph(p, expressions)),
    [paragraphs, expressions]
  );

  const expressionMap = useMemo(() => {
    const m = new Map<string, Expression>();
    for (const e of expressions) m.set(e.expression, e);
    return m;
  }, [expressions]);

  const [openKey, setOpenKey] = useState<string | null>(null);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  function handleClick(e: React.MouseEvent<HTMLElement>, key: string) {
    if (openKey === key) {
      setOpenKey(null);
      setAnchor(null);
      return;
    }
    setOpenKey(key);
    setAnchor(e.currentTarget);
  }

  const openExpression = openKey ? expressionMap.get(openKey) : null;

  return (
    <>
      <div className="max-w-[800px] mx-auto space-y-6">
        {tokenized.map((tokens, i) => (
          <p
            key={i}
            className="text-[20px] leading-[1.8] tracking-[-0.01em] text-text-primary"
          >
            {tokens.map((tok, j) =>
              tok.expressionKey ? (
                <span
                  key={j}
                  onClick={(e) => handleClick(e, tok.expressionKey!)}
                  className="bg-[var(--color-highlight)] hover:bg-[var(--color-highlight-hover)] px-0.5 rounded-[2px] cursor-pointer transition-colors"
                >
                  {tok.text}
                </span>
              ) : (
                <span key={j}>{tok.text}</span>
              )
            )}
          </p>
        ))}
      </div>
      {openExpression && anchor && (
        <ExpressionPopup
          anchor={anchor}
          expression={openExpression}
          onClose={() => {
            setOpenKey(null);
            setAnchor(null);
          }}
        />
      )}
    </>
  );
}
```

(기존 `useRef` import 안 쓰므로 빼고 작성. `useMemo`, `useState`만 사용.)

- [ ] **Step 2: 컴파일 확인**

```bash
pnpm dev
```

- 컴파일 에러: 다음 task에서 page.tsx도 같이 고치므로, 지금은 `keyPhrase` prop 누락 에러가 reading/page.tsx에서 날 수 있음. 그건 OK. 다른 에러(import path, type) 있으면 수정.

Ctrl+C로 종료.

(이 task는 다음 task와 묶어서 한 commit으로 처리하므로 여기선 commit하지 않음.)

---

### Task 6: reading/page.tsx 업데이트

**Files:**
- Modify: `src/app/(main)/learn/[contentId]/reading/page.tsx`

- [ ] **Step 1: Content interface와 fetch 응답 처리 변경**

`src/app/(main)/learn/[contentId]/reading/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ReadingView } from "@/components/learning/reading-view";
import { Button } from "@/components/ui/button";
import { parseLevel } from "@/lib/level";
import type { Expression } from "@/lib/expression-matching";

interface Content {
  id: number;
  title: string;
  paragraphs: string[];
  expressions: Expression[];
}

export default function ReadingPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const contentId = params.contentId as string;
  const level = parseLevel(searchParams.get("level")) ?? "beginner";
  const [content, setContent] = useState<Content | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/content/${contentId}?level=${level}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setContent(d);
      });
    return () => {
      cancelled = true;
    };
  }, [contentId, level]);

  async function handleComplete() {
    await fetch(`/api/progress/${contentId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: "reading", level }),
    }).catch(() => {});
    router.push(`/learn/${contentId}/listening?level=${level}`);
  }

  if (!content) return <div className="p-6 text-text-secondary">Loading...</div>;

  return (
    <div className="max-w-[800px] mx-auto px-6 py-12">
      <span className="text-caption font-semibold text-brand-primary uppercase">
        Step 1 · Reading
      </span>
      <h1 className="text-headline font-semibold mt-2 mb-8">
        {content.title}
      </h1>

      <ReadingView paragraphs={content.paragraphs} expressions={content.expressions ?? []} />

      <div className="mt-10 flex justify-end">
        <Button onClick={handleComplete}>Next: Listening</Button>
      </div>
    </div>
  );
}
```

변경 핵심:
- `Content` interface에서 `keyPhrase`, `keyKo` 제거, `expressions: Expression[]` 추가.
- `<ReadingView>` props 교체 (`keyPhrase` → `expressions`).
- 본문 아래 keyPhrase 카드(`<div className="mt-6 bg-surface border border-border-default rounded-lg p-4">...`) 통째로 삭제.
- API가 반환하는 expressions가 `Json` 타입이라 런타임에 잘못된 형태일 수 있으니 `?? []` 가드.

- [ ] **Step 2: dev 서버 띄워서 페이지 동작 확인**

```bash
pnpm dev
```

브라우저에서 `http://localhost:3000/learn/13/reading` (또는 `?level=beginner` 등) 접속.

수동 체크:
- [ ] 페이지가 에러 없이 뜨는가
- [ ] 본문에 노란 형광펜이 4~6개 떠 있는가 (기존 글이라 매칭률은 보장 안 됨, 하나도 없을 수도 있음)
- [ ] 형광펜 클릭하면 popup이 위 또는 아래에 뜨는가
- [ ] popup에 영어 표현 + 한글 의미 + 한글 설명이 보이는가
- [ ] 같은 popup이 떠있는 상태에서 같은 표현 다시 클릭 → 닫힘
- [ ] 다른 형광펜 클릭 → 이전 popup 닫히고 새 popup 열림
- [ ] popup 외부 클릭 → 닫힘
- [ ] ESC → 닫힘
- [ ] 본문 아래 keyPhrase 카드는 사라졌는가
- [ ] 페이지 하단에 스크롤해서 형광펜 클릭하면 popup이 자동으로 위로 뜨는가
- [ ] 모바일 뷰포트 (DevTools) 에서 popup이 좌우로 잘리지 않는가

매칭이 하나도 안 되는 글이면 다른 글(`/learn/<다른_id>/reading`)도 시도. dev 콘솔에서 SQL 또는 API 응답 확인:

```bash
curl -s http://localhost:3000/api/content/13?level=beginner | python3 -c "import sys,json;d=json.load(sys.stdin);print('expressions:',[e['expression'] for e in d.get('expressions',[])]);print('paragraphs sample:',d['paragraphs'][0][:200])"
```

문제 발생 시:
- popup이 안 뜸 → DevTools console에러 확인. `useLayoutEffect`의 `getBoundingClientRect()` 0인지 확인.
- 형광펜이 너무 많이/적게 → expressions 배열 길이와 매칭 결과 비교.
- popup이 뷰포트 밖 → ExpressionPopup의 클램프 로직 점검.

- [ ] **Step 3: typecheck**

```bash
pnpm tsc --noEmit
```

Expected: 에러 없음. 에러 있으면 fix.

- [ ] **Step 4: 테스트 전체 한 번**

```bash
pnpm test
```

Expected: 모든 기존 테스트 + Task 2의 expression-matching 테스트 PASS.

- [ ] **Step 5: Commit (Task 5 + 6 묶어서)**

```bash
git add src/components/learning/reading-view.tsx src/app/\(main\)/learn/\[contentId\]/reading/page.tsx
git commit -m "$(cat <<'EOF'
feat(reading): replace keyPhrase card with highlighter + click popup

reading 페이지에서 keyPhrase 1개만 brown 텍스트로 보이던 걸,
expressions 배열 전체를 노란 형광펜으로 칠하고 클릭 시 popup으로
의미+설명을 노출하는 구조로 전환.

- ReadingView: tokenizeParagraph로 매치 토큰을 형광펜 span으로 렌더,
  같은 expression은 한 popup으로 통일 (expression 텍스트가 키)
- reading/page.tsx: keyPhrase 카드 제거, expressions 전달, Content
  interface에서 keyPhrase/keyKo 제거 (다른 페이지에선 그대로 사용)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: 신규 글 생성 프롬프트에 verbatim 등장 규칙 추가

**Files:**
- Modify: `src/lib/generation-prompts.ts` (line 155 부근, expressions 항목)

- [ ] **Step 1: expressions 섹션에 sub-bullet 추가**

`src/lib/generation-prompts.ts`의 line 155~159 부분을 다음으로 교체:

```ts
- expressions: 3 to 6 objects with { "expression": "...", "meaning": "...", "explanation": "...", "example": "..." }.
  - "expression" (ENGLISH): the English expression itself — the learning target. MUST appear verbatim (case-insensitive) somewhere in the "paragraphs" text. If the phrase wouldn't fit naturally into a paragraph, do not include it as an expression.
  - "meaning" (한국어): ${spec.expressionMeaning}
  - "explanation" (한국어): ${spec.expressionExplanation}
  - "example" (ENGLISH): ONE natural English example sentence using the expression.
```

(기존 첫 번째 sub-bullet 한 줄에 verbatim 등장 + 본문에 안 맞으면 제외 두 가지를 합쳐 한 문장으로 추가.)

- [ ] **Step 2: typecheck + 테스트**

```bash
pnpm tsc --noEmit
pnpm test
```

Expected: 둘 다 PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/generation-prompts.ts
git commit -m "$(cat <<'EOF'
feat(generation): require expressions to appear verbatim in paragraphs

신규 글 생성 시 expression 필드가 paragraphs 본문에 동일 형태로
등장하도록 프롬프트 규칙 보완. 본문에 안 맞는 표현은 expressions에
포함하지 않도록 명시. reading 페이지 형광펜 매칭률 향상 목적.

기존 글은 영향 없음 (재생성 시에만 새 규칙 적용).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: 최종 수동 검증 + 운영 체크리스트

**Files:** (없음 — 검증만)

- [ ] **Step 1: 빌드 통과 확인**

```bash
cd /var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines
pnpm build
```

Expected: 빌드 성공. 실패 시 출력의 에러 fix.

- [ ] **Step 2: 운영 데이터셋으로 매칭률 spot check**

dev 서버 띄운 상태에서 콘텐츠 ID 3~5개 골라 reading 페이지 직접 열어 확인:

```bash
pnpm dev
```

체크 사항:
- 글마다 형광펜 개수 (목표: expressions 5~6개 중 3개 이상 매칭)
- 매칭 0건이면 어떤 글인지 메모 (운영 후 수동 보정 또는 재생성 후보)

- [ ] **Step 3: 모바일 뷰포트 점검**

DevTools 디바이스 모드 (iPhone SE 375px, Galaxy 360px) 에서:
- [ ] 형광펜이 텍스트 줄바꿈 시에도 자연스럽게 보임
- [ ] popup이 화면 좌우로 안 잘림
- [ ] popup 외부 터치로 닫힘
- [ ] 같은 표현이 본문 여러 군데 있을 때 다 매칭됨

- [ ] **Step 4: 회귀 체크 — 다른 step 페이지가 영향 안 받았는지**

- [ ] `/learn/<id>/listening` 정상 동작
- [ ] `/learn/<id>/expressions` (Step 3) 카드 정상 노출 (이번 작업 영향 없음)
- [ ] `/learn/<id>/quiz` 정상 동작
- [ ] 글 목록 페이지에서 keyPhrase가 미리보기로 정상 노출 (다른 페이지/컴포넌트는 keyPhrase 계속 씀)

- [ ] **Step 5: 커밋 로그 정리 & 최종 상태 확인**

```bash
git log --oneline -10
git status
```

Expected:
- 6개 commit (Task 1, 3, 4, 5+6 묶음, 7) — 또는 분할 양상에 따라 5~7개
- working tree clean

- [ ] **Step 6: 사용자에게 PR/push 의향 확인**

이 시점에서 사용자에게:
- 매칭률 spot check 결과 (n개 글 확인, 평균 m개 형광펜)
- 매칭 0건이거나 적었던 글 ID 리스트
- 추후 follow-up 후보: 매칭률 낮은 기존 글 재생성/수동 보정 / 모바일 bottom-sheet 변형 / 매칭률 모니터링

routines는 main 단일 브랜치이므로 push 시점은 사용자 결정.

---

## Out of Scope (이번 plan에서 안 다룸)

- Step 3 Expressions 페이지 변경
- 기존 글의 expressions 데이터 마이그레이션/재생성
- 매칭률 대시보드/모니터링
- 사용자가 형광펜을 직접 추가/제거하는 기능
- 모바일 bottom-sheet 변형
- jsdom 도입 + React 컴포넌트 자동 테스트

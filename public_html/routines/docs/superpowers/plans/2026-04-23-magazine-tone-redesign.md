# 매거진 톤 리뉴얼 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** routines.soritune.com을 Long Black 풍 매거진 톤(베이지 종이 배경 + Pretendard tight typography + brand orange #FF6400)으로 풀 리뉴얼한다.

**Architecture:** Tailwind v4의 `@theme`/`@utility` 블록에 디자인 토큰을 일괄 정의하고, 모든 페이지/컴포넌트가 이 토큰을 참조하도록 교체한다. CSS 변수 기반이라 토큰만 바꿔도 자동 전환되는 영역이 많다. UI 구조와 비즈니스 로직은 변경하지 않고 색·radius·typography만 교체.

**Tech Stack:** Next.js 16 (App Router) + Tailwind CSS v4 + Pretendard (CDN) + TypeScript + pnpm + vitest

**Spec:** `docs/superpowers/specs/2026-04-23-magazine-tone-redesign-design.md`

**테스트 전략:** 시각적 변경이라 일반적 TDD 적용 어려움. 대신 각 task마다 다음 3가지로 검증:
1. `pnpm build` 빌드 통과
2. `pnpm dev` 띄워서 해당 페이지 시각 확인 (사용자 확인 단계)
3. 기존 `pnpm test` 회귀 없음 (vitest 단위 테스트)

**작업 환경:** routines는 main 단일 브랜치. 각 task 끝에 main에 직접 commit. 운영 반영은 별도 빌드/PM2 restart가 필요해 commit이 자동 운영 반영은 아님 (안전).

---

## File Structure (변경 대상)

| 파일 | 책임 | 변경 task |
|------|------|----------|
| `src/app/globals.css` | 디자인 토큰 정의 (색/typo/radius/shadow) | Task 1 |
| `src/app/layout.tsx` | body 배경/텍스트 색 | Task 2 |
| `src/components/nav.tsx` | 상단 네비게이션 | Task 2 |
| `src/components/ui/button.tsx` | 공통 버튼 | Task 3 |
| `src/components/ui/card.tsx` | 공통 카드 | Task 3 |
| `src/components/ui/input.tsx` | 공통 입력 | Task 3 |
| `src/app/(main)/page.tsx` | 홈 메인 | Task 4 |
| `src/app/(main)/today/page.tsx` | 오늘의 학습 | Task 5 |
| `src/app/(main)/archive/page.tsx` | 아카이브 | Task 5 |
| `src/app/(main)/_profile/page.tsx` | 프로필 | Task 5 |
| `src/app/(main)/learn/[contentId]/**` | 학습 6단계 + 레이아웃 | Task 6 |
| `src/components/learning/reading-view.tsx` | reading 본문 (20px/lh 1.8 별도) | Task 6 |
| `src/app/(admin)/admin/layout.tsx` + `src/components/admin/sidebar.tsx` | 어드민 레이아웃 | Task 7 |
| `src/app/(admin)/admin/**` (7개 페이지) | 어드민 페이지 | Task 8 |
| `src/components/learning/*` (reading-view 외) | 학습 도메인 컴포넌트 | Task 9 |
| `src/components/admin/*` (sidebar 외) | 어드민 도메인 컴포넌트 | Task 9 |

---

## Task 1: 디자인 토큰 (globals.css 전면 교체)

**Files:**
- Modify: `src/app/globals.css`

**목표:** spec §3~5의 모든 토큰을 Tailwind v4 `@theme` + `@utility`로 정의. 이것만으로도 `bg-brand-primary`, `text-text-primary`, `text-hero` 같은 utility가 사용 가능해진다.

- [ ] **Step 1: 현재 파일 백업 확인**

```bash
cd /var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines
git diff src/app/globals.css
```

Expected: 변경 없음 (working tree clean).

- [ ] **Step 2: globals.css 전체 교체**

`src/app/globals.css` 의 전체 내용을 아래로 교체:

```css
@import "tailwindcss";

@theme {
  /* ============ Brand ============ */
  --color-brand-primary: #FF6400;
  --color-brand-primary-hover: #E55A00;
  --color-brand-primary-active: #CC5000;
  --color-brand-primary-light: #FFE4D1;

  /* ============ Background / Surface (베이지 종이) ============ */
  --color-bg-page: #F1ECE6;
  --color-bg-subtle: #FAF7F2;
  --color-surface: #FFFFFF;
  --color-border-default: #E7E1D8;
  --color-border-strong: #D3CFC6;

  /* ============ Text ============ */
  --color-text-primary: #282828;
  --color-text-secondary: #666666;
  --color-text-tertiary: #999999;
  --color-text-inverse: #FFFFFF;
  --color-text-brand-brown: #7C4126;

  /* ============ System messages (deep tones) ============ */
  --color-success: #2E8188;
  --color-danger: #823F4C;
  --color-warning: #9A583A;
  --color-info: #666666;

  /* ============ Font ============ */
  --font-pretendard: "Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, system-ui, "Helvetica Neue", sans-serif;

  /* ============ Radius ============ */
  --radius-none: 0;
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-pill: 100px;

  /* ============ Shadow ============ */
  --shadow-hover: 0 4px 12px rgba(0, 0, 0, 0.08);
  --shadow-overlay: 0 8px 28px rgba(0, 0, 0, 0.15);

  /* ============ Container ============ */
  --width-container: 1200px;
  --width-reading: 800px;
}

/* ============ Typography utilities (반응형 포함) ============ */
@utility text-hero {
  font-size: clamp(56px, 8vw, 100px);
  line-height: 1.0;
  letter-spacing: -0.05em;
  font-weight: 700;
}

@utility text-display {
  font-size: clamp(36px, 5vw, 56px);
  line-height: 1.15;
  letter-spacing: -0.03em;
  font-weight: 300;
}

@utility text-headline {
  font-size: 26px;
  line-height: 1.3;
  letter-spacing: -0.02em;
  font-weight: 700;
}
@media (min-width: 768px) {
  .text-headline { font-size: 32px; }
}

@utility text-title {
  font-size: 20px;
  line-height: 1.4;
  letter-spacing: -0.02em;
  font-weight: 600;
}
@media (min-width: 768px) {
  .text-title { font-size: 24px; }
}

@utility text-body {
  font-size: 17px;
  line-height: 1.7;
  letter-spacing: -0.01em;
  font-weight: 400;
}
@media (min-width: 768px) {
  .text-body { font-size: 18px; }
}

@utility text-caption {
  font-size: 12px;
  line-height: 1.5;
  letter-spacing: 0;
  font-weight: 400;
}
@media (min-width: 768px) {
  .text-caption { font-size: 13px; }
}

/* ============ Base styles ============ */
html {
  background-color: var(--color-bg-page);
  color: var(--color-text-primary);
}

body {
  font-family: var(--font-pretendard);
  background-color: var(--color-bg-page);
  color: var(--color-text-primary);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

*:focus-visible {
  outline: 2px solid var(--color-brand-primary);
  outline-offset: 2px;
}

::placeholder {
  color: var(--color-text-tertiary);
}

/* ============ 호버 효과 (카드/버튼이 살짝 들어올림) ============ */
@utility hover-lift {
  transition: transform 0.2s ease-out, box-shadow 0.2s ease-out;
}
.hover-lift:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-hover);
}
```

- [ ] **Step 3: Tailwind v4가 새 토큰 인식하는지 빌드 확인**

```bash
cd /var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines
pnpm build 2>&1 | tail -30
```

Expected: 빌드 성공 (현재 페이지들은 아직 옛 토큰 `bg-void-black` 등을 사용해서 일부 unknown class warning이 나올 수 있음 — 무시. 빌드 자체가 fail이면 globals.css syntax 점검).

> 만약 unknown utility로 빌드 fail 시: 옛 토큰 (`bg-void-black`, `text-framer-blue` 등)이 여전히 사용 중인 곳에 한해서 globals.css에 임시 호환 토큰을 잠깐 두는 것도 OK. 단, Task 2 이후에는 삭제.

- [ ] **Step 4: vitest 회귀 확인**

```bash
pnpm test 2>&1 | tail -20
```

Expected: 모든 테스트 통과 (디자인 토큰 변경은 비즈니스 로직 영향 없음).

- [ ] **Step 5: Commit**

```bash
git add src/app/globals.css
git commit -m "$(cat <<'EOF'
feat(design): 디자인 토큰 매거진 톤으로 전면 교체

베이지 배경(#F1ECE6) + raisinblack 텍스트(#282828) + brand orange(#FF6400)
6단계 typography utility(text-hero/display/headline/title/body/caption) 정의
radius 8/12px, shadow 최소화 (hover/overlay만)
시스템 메시지(success/danger/warning)는 매거진 친화 딥 톤

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Root layout + Nav

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/components/nav.tsx`

- [ ] **Step 1: `src/app/layout.tsx` body 클래스 변경**

37번 줄:
```tsx
<body className="font-pretendard bg-void-black text-white min-h-screen">
```
↓ 로 변경:
```tsx
<body className="font-pretendard bg-bg-page text-text-primary min-h-screen">
```

- [ ] **Step 2: `src/components/nav.tsx` 전체 교체**

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { LevelToggle } from "@/components/level-toggle";

export function Nav() {
  const [mobileOpen, setMobileOpen] = useState(false);

  const closeMenu = () => setMobileOpen(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-bg-page/80 backdrop-blur-sm border-b border-border-default">
      <div className="max-w-[1200px] mx-auto px-6 h-16 flex items-center justify-between">
        <Link
          href="/"
          className="text-[20px] font-semibold tracking-[-0.02em] text-text-primary"
          onClick={closeMenu}
        >
          Routines
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-6">
          <Link
            href="/today"
            className="text-[15px] font-medium text-text-secondary hover:text-text-primary tracking-[-0.01em] transition-colors"
          >
            오늘의 학습
          </Link>
          <Link
            href="/archive"
            className="text-[15px] font-medium text-text-secondary hover:text-text-primary tracking-[-0.01em] transition-colors"
          >
            아카이브
          </Link>
          <LevelToggle />
        </div>

        {/* Mobile hamburger button */}
        <button
          className="md:hidden flex flex-col justify-center items-center w-8 h-8 gap-1.5"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="메뉴 열기"
        >
          <span
            className={`block w-5 h-0.5 bg-text-primary transition-transform duration-200 ${mobileOpen ? "rotate-45 translate-y-[4px]" : ""}`}
          />
          <span
            className={`block w-5 h-0.5 bg-text-primary transition-opacity duration-200 ${mobileOpen ? "opacity-0" : ""}`}
          />
          <span
            className={`block w-5 h-0.5 bg-text-primary transition-transform duration-200 ${mobileOpen ? "-rotate-45 -translate-y-[4px]" : ""}`}
          />
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-bg-page/95 backdrop-blur-sm border-b border-border-default px-6 pb-4 pt-2 flex flex-col gap-4">
          <Link
            href="/today"
            className="text-[15px] font-medium text-text-secondary hover:text-text-primary tracking-[-0.01em] transition-colors"
            onClick={closeMenu}
          >
            오늘의 학습
          </Link>
          <Link
            href="/archive"
            className="text-[15px] font-medium text-text-secondary hover:text-text-primary tracking-[-0.01em] transition-colors"
            onClick={closeMenu}
          >
            아카이브
          </Link>
          <div className="pt-2 border-t border-border-default">
            <LevelToggle />
          </div>
        </div>
      )}
    </nav>
  );
}
```

- [ ] **Step 3: `src/components/level-toggle.tsx` 의 색상 클래스 점검**

```bash
grep -n "void-black\|near-black\|framer-blue\|muted-silver\|text-white\|frosted-white" src/components/level-toggle.tsx
```

발견된 옛 토큰을 새 토큰으로 변경 (예: `bg-near-black` → `bg-surface`, `text-white` → `text-text-primary`, `text-framer-blue` → `text-brand-primary`). 변경 후 다시 grep으로 0개 확인.

- [ ] **Step 4: `src/components/level-gate.tsx` 도 동일 점검**

```bash
grep -n "void-black\|near-black\|framer-blue\|muted-silver\|text-white\|frosted-white" src/components/level-gate.tsx
```

발견 시 동일하게 새 토큰으로 교체.

- [ ] **Step 5: 빌드 + dev 확인**

```bash
pnpm build 2>&1 | tail -20
pnpm dev   # 다른 터미널에서 localhost:3000 확인
```

Expected: 빌드 성공. 브라우저에서 헤더가 베이지 배경 + 다크 텍스트로 표시됨. (페이지 본문은 아직 다크 톤 그대로 — 다음 task에서 처리)

- [ ] **Step 6: Commit**

```bash
git add src/app/layout.tsx src/components/nav.tsx src/components/level-toggle.tsx src/components/level-gate.tsx
git commit -m "$(cat <<'EOF'
feat(design): root layout + nav 라이트 베이지 톤으로 전환

body 배경/텍스트 색을 새 토큰(bg-page/text-primary)으로 교체
nav 데스크톱/모바일 메뉴 모두 라이트 톤
level-toggle, level-gate 잔여 다크 토큰 정리

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: UI 컴포넌트 (button, card, input)

**Files:**
- Modify: `src/components/ui/button.tsx`
- Modify: `src/components/ui/card.tsx`
- Modify: `src/components/ui/input.tsx`

- [ ] **Step 1: `src/components/ui/button.tsx` 전체 교체**

```tsx
import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "solid" | "secondary" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  fullWidth?: boolean;
}

const variantStyles: Record<Variant, string> = {
  solid:
    "bg-brand-primary text-text-inverse rounded-md hover:bg-brand-primary-hover active:bg-brand-primary-active",
  secondary:
    "bg-surface text-text-primary border border-border-strong rounded-md hover:bg-bg-subtle",
  ghost:
    "bg-transparent text-text-primary hover:bg-bg-subtle rounded-md",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { variant = "solid", fullWidth, className = "", children, ...props },
    ref
  ) => {
    return (
      <button
        ref={ref}
        className={`px-6 py-3 text-[15px] font-medium tracking-[-0.01em] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
          fullWidth ? "w-full" : ""
        } ${variantStyles[variant]} ${className}`}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
```

> 변경점: `frosted` variant 이름이 어색하므로 `secondary`로 rename. `solid`는 brand orange CTA로 의미 변경. `rounded-pill` → `rounded-md` (8px).

- [ ] **Step 2: button variant 사용처 점검 (`frosted` 사용처를 `secondary`로 일괄 교체)**

```bash
cd /var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines
grep -rn 'variant="frosted"' src/
```

발견된 모든 위치에서 `variant="frosted"` → `variant="secondary"` 로 변경.

- [ ] **Step 3: `src/components/ui/card.tsx` 전체 교체**

```tsx
import { HTMLAttributes, forwardRef } from "react";

type Variant = "surface" | "subtle";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: Variant;
}

const variantStyles: Record<Variant, string> = {
  surface: "bg-surface border border-border-default rounded-lg",
  subtle: "bg-bg-subtle border border-border-default rounded-lg",
};

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant = "surface", className = "", children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`p-6 ${variantStyles[variant]} ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = "Card";
```

> 변경점: `elevated` variant 제거 (그림자 거의 안 쓰는 매거진 톤이라 의미 없음), 대신 `subtle`(연한 크림 배경) 추가. shadow 제거하고 border로 구분.

- [ ] **Step 4: card variant 사용처 점검**

```bash
grep -rn 'variant="elevated"' src/
```

발견된 모든 위치에서 `variant="elevated"` → `variant="surface"` 로 변경 (추후 시각 확인 시 `subtle`이 더 어울리는 곳은 개별 판단).

- [ ] **Step 5: `src/components/ui/input.tsx` 전체 교체**

```tsx
import { InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = "", ...props }, ref) => {
    return (
      <div className="flex flex-col gap-2">
        {label && (
          <label className="text-[13px] font-medium text-text-secondary tracking-[-0.01em]">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={`bg-surface border border-border-default rounded-md px-4 py-3 text-[15px] text-text-primary tracking-[-0.01em] leading-[1.5] placeholder:text-text-tertiary focus:border-brand-primary focus:outline-none transition-colors ${
            error ? "border-danger" : ""
          } ${className}`}
          {...props}
        />
        {error && <span className="text-[12px] text-danger">{error}</span>}
      </div>
    );
  }
);

Input.displayName = "Input";
```

- [ ] **Step 6: 빌드 + 테스트**

```bash
pnpm build 2>&1 | tail -20
pnpm test 2>&1 | tail -20
```

Expected: 빌드/테스트 모두 통과.

- [ ] **Step 7: Commit**

```bash
git add src/components/ui/button.tsx src/components/ui/card.tsx src/components/ui/input.tsx
# variant rename 사용처도 함께 add
git add -u
git commit -m "$(cat <<'EOF'
feat(design): UI 컴포넌트(button/card/input) 매거진 톤으로 교체

button: solid=brand orange CTA, frosted→secondary rename, pill→md(8px)
card: elevated 제거→subtle(크림 배경) 추가, shadow→border 1px
input: 다크 → surface(white) + border-default

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: 홈 페이지 (`(main)/page.tsx`)

**Files:**
- Modify: `src/app/(main)/page.tsx`

- [ ] **Step 1: `src/app/(main)/page.tsx` 전체 교체**

```tsx
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { todayKST } from "@/lib/date";
import { Button } from "@/components/ui/button";

export default async function Home() {
  const today = todayKST();
  const content = await prisma.content.findFirst({
    where: { publishedAt: today, isActive: true },
    orderBy: { priority: "desc" },
    select: {
      title: true,
      subtitle: true,
      genre: true,
      keyPhrase: true,
      keyKo: true,
    },
  });

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] px-6">
      <h1 className="text-hero text-text-primary text-center">
        Routines
      </h1>
      <p className="mt-6 text-body text-text-secondary text-center max-w-[600px]">
        매일 하나의 영어 콘텐츠로 학습 루틴을 만드세요
      </p>

      {content && (
        <div className="mt-12 bg-surface border border-border-default rounded-lg p-8 max-w-[600px] w-full text-center">
          <span className="text-caption font-semibold text-brand-primary tracking-[2px] uppercase">
            오늘의 콘텐츠
          </span>
          <h2 className="text-title text-text-primary mt-3">
            {content.title}
          </h2>
          {content.subtitle && (
            <p className="text-body text-text-secondary mt-2">
              {content.subtitle}
            </p>
          )}
          <p className="mt-4 text-body">
            <span className="text-brand-primary font-medium">{content.keyPhrase}</span>
            <span className="text-text-secondary ml-2">{content.keyKo}</span>
          </p>
        </div>
      )}

      <Link href="/today" className="mt-10">
        <Button>오늘 학습 시작하기</Button>
      </Link>
    </div>
  );
}
```

- [ ] **Step 2: 빌드 + dev 시각 확인**

```bash
pnpm build 2>&1 | tail -10
pnpm dev   # http://localhost:3000 → 홈 페이지 확인
```

Expected:
- 베이지 배경 위에 거대한 검은 "Routines" hero 타이틀
- 흰색 카드 위 "오늘의 콘텐츠" + brand orange "오늘의 콘텐츠" 라벨
- 오렌지 CTA 버튼

> ⚠️ **사용자 확인 단계** — 시각이 의도한 대로인지 직접 확인 후 진행. 어색한 부분 있으면 spec 검토 후 조정.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(main\)/page.tsx
git commit -m "$(cat <<'EOF'
feat(design): 홈 페이지 매거진 톤 적용

text-hero(100px) 타이틀 + 베이지 배경 + 흰 카드
brand orange CTA, 옛 임의 px 값을 typography utility로 교체

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: today + archive + profile 페이지

**Files:**
- Modify: `src/app/(main)/today/page.tsx`
- Modify: `src/app/(main)/archive/page.tsx`
- Modify: `src/app/(main)/_profile/page.tsx`

> 이 3개 페이지는 구조가 비슷해서 일괄 적용. 패턴이 동일.

**일괄 변환 패턴:**

| 옛 클래스 | 새 클래스 |
|----------|----------|
| `text-white` | `text-text-primary` |
| `text-muted-silver` | `text-text-secondary` |
| `text-white/40`, `text-white/50`, `text-white/60` | `text-text-tertiary` |
| `text-framer-blue` | `text-brand-primary` |
| `bg-void-black` | `bg-bg-page` |
| `bg-near-black` | `bg-surface` |
| `bg-frosted-white` | `bg-bg-subtle` |
| `border-white/5`, `border-white/10` | `border-border-default` |
| `shadow-ring-blue`, `shadow-elevated` | (제거하고 `border border-border-default` 추가) |
| `rounded-pill`, `rounded-pill-sm` | `rounded-md` |
| `text-[110px]` 등 거대한 타이틀 | `text-hero` |
| `text-[60~70px]` 서브 타이틀 | `text-display` |
| `text-[28~36px]` 섹션 제목 | `text-headline` |
| `text-[20~24px]` 카드 제목 | `text-title` |
| `text-[15~18px]` 본문 | `text-body` |
| `text-[12~13px]` 캡션 | `text-caption` |
| `tracking-[-...px]` 임의 값 | typography utility에 포함되므로 제거 |

- [ ] **Step 1: `today/page.tsx` 일괄 변환 + 시각 확인**

```bash
cd /var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines
# 옛 토큰 사용처 먼저 확인
grep -nE "void-black|near-black|framer-blue|muted-silver|frosted-white|subtle-white|ghost-white|blue-glow|shadow-ring|shadow-elevated|rounded-pill" src/app/\(main\)/today/page.tsx
```

각 라인을 위 표 패턴대로 교체. 타이포는 의미에 맞춰 utility 사용 (제목 = `text-headline`/`text-title`, 본문 = `text-body`).

교체 후 grep 다시 실행해서 0개 확인.

- [ ] **Step 2: `archive/page.tsx` 동일 변환**

```bash
grep -nE "void-black|near-black|framer-blue|muted-silver|frosted-white|subtle-white|ghost-white|blue-glow|shadow-ring|shadow-elevated|rounded-pill" src/app/\(main\)/archive/page.tsx
```

교체 후 0개 확인.

- [ ] **Step 3: `_profile/page.tsx` 동일 변환**

```bash
grep -nE "void-black|near-black|framer-blue|muted-silver|frosted-white|subtle-white|ghost-white|blue-glow|shadow-ring|shadow-elevated|rounded-pill" src/app/\(main\)/_profile/page.tsx
```

교체 후 0개 확인.

> ⚠️ profile 페이지의 **스트릭 숫자**(예: "🔥 7일 연속")는 spec §6.2에 따라 `text-brand-primary` 적용. **일반 통계 숫자**는 `text-headline text-text-primary`.

- [ ] **Step 4: 빌드 + 시각 확인**

```bash
pnpm build 2>&1 | tail -10
pnpm dev
```

`/today`, `/archive`, `/_profile` 모두 베이지 배경 + 라이트 톤 정상 표시. 어색한 부분이 있다면 즉시 수정.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(main\)/today/page.tsx src/app/\(main\)/archive/page.tsx src/app/\(main\)/_profile/page.tsx
git commit -m "$(cat <<'EOF'
feat(design): today/archive/profile 페이지 라이트 톤 적용

색상 토큰을 spec 변환 표대로 일괄 교체
typography utility(text-headline/title/body/caption) 적용
스트릭 숫자만 brand orange, 일반 통계는 검정 + headline

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: 학습 6단계 페이지 + reading-view 별도 처리

**Files:**
- Modify: `src/app/(main)/learn/[contentId]/layout.tsx`
- Modify: `src/app/(main)/learn/[contentId]/page.tsx` (학습 허브)
- Modify: `src/app/(main)/learn/[contentId]/reading/page.tsx`
- Modify: `src/app/(main)/learn/[contentId]/listening/page.tsx`
- Modify: `src/app/(main)/learn/[contentId]/expressions/page.tsx`
- Modify: `src/app/(main)/learn/[contentId]/quiz/page.tsx`
- Modify: `src/app/(main)/learn/[contentId]/interview/page.tsx`
- Modify: `src/app/(main)/learn/[contentId]/speaking/page.tsx`
- Modify: `src/components/learning/reading-view.tsx`

> 학습 6단계는 사용자가 가장 오래 머무는 영역이라 가장 중요한 task.

- [ ] **Step 1: 학습 페이지들의 옛 토큰 일괄 점검**

```bash
cd /var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines
grep -rnE "void-black|near-black|framer-blue|muted-silver|frosted-white|subtle-white|ghost-white|blue-glow|shadow-ring|shadow-elevated|rounded-pill" src/app/\(main\)/learn/
```

발견된 모든 라인을 Task 5 §일괄 변환 패턴 표대로 교체.

- [ ] **Step 2: 6단계 진도 표시 컴포넌트가 있다면 spec §6.3대로 적용**

학습 허브(`learn/[contentId]/page.tsx`)에서 6단계 진도 표시 부분:
- 완료된 단계: `bg-brand-primary text-text-inverse` + 체크 아이콘
- 현재 단계: `border-2 border-brand-primary text-brand-primary`
- 미완료: `border border-border-default text-text-tertiary`
- 잠김: `bg-bg-subtle text-[#C8C8C8]` + 잠금 아이콘

- [ ] **Step 3: `src/components/learning/reading-view.tsx` 색상 + 본문 사이즈 별도 적용**

reading-view는 spec §4.4에 따라 본문이 **20px / lh 1.8** (다른 페이지보다 한 단계 큼).

먼저 색상 토큰 교체:
```bash
grep -nE "void-black|near-black|framer-blue|muted-silver|frosted-white|subtle-white|ghost-white|blue-glow|shadow-ring|shadow-elevated|rounded-pill|text-white" src/components/learning/reading-view.tsx
```

위 표대로 교체.

다음, 본문 paragraph에 적용된 클래스를 찾아 `text-body` 대신 다음 인라인 클래스 적용:
```tsx
className="text-[20px] leading-[1.8] tracking-[-0.01em] text-text-primary"
```

`keyPhrase` 강조 부분은 색상을 `text-brand-primary` 또는 spec §3.3의 `text-brand-brown` (#7C4126) 중 시각적으로 어울리는 것으로. 본문 흐름과의 대비를 위해 **`text-brand-brown` + `font-semibold` + 옅은 underline**을 권장 (매거진 인용/강조 톤).

- [ ] **Step 4: 빌드 + dev 시각 확인**

```bash
pnpm build 2>&1 | tail -10
pnpm dev
```

학습 콘텐츠 1개를 골라 6단계를 모두 클릭하면서 시각 확인. reading 페이지의 본문이 다른 페이지보다 약간 큰지 확인.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(main\)/learn/ src/components/learning/reading-view.tsx
git commit -m "$(cat <<'EOF'
feat(design): 학습 6단계 페이지 + reading-view 매거진 톤 적용

색상 토큰 일괄 교체, typography utility 적용
6단계 진도 표시: brand orange 단일 컬러 + 명도 변형
reading-view 본문은 20px/lh 1.8로 별도 (가장 오래 머무는 페이지)
keyPhrase 강조는 brand-brown(#7C4126) + semibold

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: 어드민 layout + sidebar

**Files:**
- Modify: `src/app/(admin)/admin/layout.tsx`
- Modify: `src/components/admin/sidebar.tsx`

- [ ] **Step 1: `(admin)/admin/layout.tsx` 점검 및 색상 교체**

```bash
grep -nE "void-black|near-black|framer-blue|muted-silver|text-white|bg-black" src/app/\(admin\)/admin/layout.tsx
```

발견된 클래스를 Task 5 변환 표대로 교체. main 영역 배경은 `bg-bg-page`.

- [ ] **Step 2: `src/components/admin/sidebar.tsx` 색상 교체**

```bash
grep -nE "void-black|near-black|framer-blue|muted-silver|text-white|bg-black|border-white" src/components/admin/sidebar.tsx
```

발견된 클래스를 변환 표대로 교체. **사이드바 배경은 `bg-bg-subtle` (연한 크림)** 으로 — 메인 영역과 살짝 톤 차이를 주어 구분. 우측 경계는 `border-r border-border-default`.

활성 메뉴 항목:
- 활성: `bg-brand-primary-light text-brand-primary font-semibold`
- 비활성: `text-text-secondary hover:bg-bg-page hover:text-text-primary`

- [ ] **Step 3: 빌드 + dev 시각 확인**

```bash
pnpm build 2>&1 | tail -10
pnpm dev
```

`/admin/login` 으로 로그인 후 `/admin` 진입. 사이드바가 연한 크림 배경 + 활성 메뉴가 브랜드 오렌지 옅은 배경으로 표시되는지 확인.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(admin\)/admin/layout.tsx src/components/admin/sidebar.tsx
git commit -m "$(cat <<'EOF'
feat(design): 어드민 layout + sidebar 라이트 톤 적용

사이드바: bg-bg-subtle(연 크림) + border-default 분리선
활성 메뉴: brand-primary-light 배경 + brand-primary 텍스트
메인 영역: bg-bg-page

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: 어드민 페이지 7개 일괄

**Files (각 페이지의 `page.tsx`):**
- Modify: `src/app/(admin)/admin/page.tsx` (대시보드)
- Modify: `src/app/(admin)/admin/content/page.tsx` (콘텐츠 리스트)
- Modify: `src/app/(admin)/admin/content/new/page.tsx` (콘텐츠 생성)
- Modify: `src/app/(admin)/admin/content/[id]/edit/page.tsx` (콘텐츠 편집)
- Modify: `src/app/(admin)/admin/topics/page.tsx`
- Modify: `src/app/(admin)/admin/users/page.tsx`
- Modify: `src/app/(admin)/admin/usage/page.tsx`
- Modify: `src/app/(admin)/admin/settings/page.tsx`
- Modify: `src/app/(admin)/admin/login/page.tsx`

> 어드민 페이지가 정확히 7개라고 spec에 적었지만, 실제는 콘텐츠 CRUD 분기로 8~9개. 모두 일괄 처리.

- [ ] **Step 1: 어드민 페이지 옛 토큰 일괄 점검**

```bash
cd /var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines
grep -rnE "void-black|near-black|framer-blue|muted-silver|frosted-white|subtle-white|ghost-white|blue-glow|shadow-ring|shadow-elevated|rounded-pill" src/app/\(admin\)/admin/
```

발견된 모든 라인을 Task 5 §일괄 변환 패턴 표대로 교체.

- [ ] **Step 2: 통계/숫자 강조 처리**

대시보드(`/admin`)의 DAU, 완료율 같은 큰 숫자:
- 숫자 자체: `text-headline text-text-primary`
- 라벨: `text-caption text-text-secondary`
- 변동률(상승): `text-success`
- 변동률(하락): `text-danger`

- [ ] **Step 3: 폼 페이지의 에러 메시지/검증 색상**

`content/new`, `content/[id]/edit`, `topics`, `login` 등의 폼:
- 에러 메시지: `text-danger`
- 성공 토스트: `text-success`
- 경고: `text-warning`

(spec §3.4 시스템 메시지 딥 톤)

- [ ] **Step 4: 빌드 + 시각 확인**

```bash
pnpm build 2>&1 | tail -10
pnpm dev
```

7개 어드민 페이지 모두 브라우저로 진입해서 확인.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(admin\)/admin/
git commit -m "$(cat <<'EOF'
feat(design): 어드민 페이지 7개 매거진 톤 적용

대시보드 통계 숫자는 headline + 검정, 변동률은 success/danger
폼 에러는 danger(#823F4C), 성공은 success(#2E8188)
콘텐츠 CRUD/topics/users/usage/settings/login 모두 일괄

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: 학습/어드민 도메인 컴포넌트

**Files:**
- Modify: `src/components/learning/listening-player.tsx`
- Modify: `src/components/learning/expression-list.tsx`
- Modify: `src/components/learning/quiz-form.tsx`
- Modify: `src/components/learning/interview-chat.tsx`
- Modify: `src/components/learning/recording-studio.tsx`
- Modify: `src/components/learning/recording-card.tsx`
- Modify: `src/components/admin/content-form.tsx`
- Modify: `src/components/admin/content-topic-fields.tsx`
- Modify: `src/components/admin/content-variant-fields.tsx`
- Modify: `src/components/admin/generation-trigger.tsx`
- Modify: `src/components/admin/upcoming-topic-form.tsx`

- [ ] **Step 1: 학습 도메인 컴포넌트 옛 토큰 점검**

```bash
cd /var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines
grep -rnE "void-black|near-black|framer-blue|muted-silver|frosted-white|subtle-white|ghost-white|blue-glow|shadow-ring|shadow-elevated|rounded-pill" src/components/learning/
```

발견 라인을 Task 5 변환 표대로 교체.

**도메인 특화 처리:**
- listening-player: 재생 중인 활성 트랙 강조 → `border-brand-primary` + `bg-brand-primary-light`
- recording-studio: 녹음 중 표시 → `text-danger` (시각적 알림)
- quiz-form: 정답 → `border-success bg-bg-subtle`, 오답 → `border-danger bg-bg-subtle`
- interview-chat: 사용자 메시지 → `bg-brand-primary-light text-text-primary`, AI 메시지 → `bg-bg-subtle text-text-primary`

- [ ] **Step 2: 어드민 도메인 컴포넌트 옛 토큰 점검**

```bash
grep -rnE "void-black|near-black|framer-blue|muted-silver|frosted-white|subtle-white|ghost-white|blue-glow|shadow-ring|shadow-elevated|rounded-pill" src/components/admin/
```

발견 라인 교체. 폼 필드는 Input 컴포넌트가 이미 새 토큰 사용 중이므로 wrapper만 정리.

- [ ] **Step 3: 빌드 + 시각 확인**

```bash
pnpm build 2>&1 | tail -10
pnpm test 2>&1 | tail -10
pnpm dev
```

학습 페이지 6단계 + 어드민 폼들 모두 시각 확인.

- [ ] **Step 4: Commit**

```bash
git add src/components/learning/ src/components/admin/
git commit -m "$(cat <<'EOF'
feat(design): 학습/어드민 도메인 컴포넌트 매거진 톤 적용

listening-player: 활성 트랙은 brand-primary 강조
recording-studio: 녹음 중은 danger 색
quiz-form: 정답=success, 오답=danger 테두리
interview-chat: 사용자=brand-primary-light, AI=bg-subtle

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: QA & 정리

**Files:** 없음 (검증만)

- [ ] **Step 1: 옛 토큰 잔여 확인 (전체 src/)**

```bash
cd /var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines
grep -rnE "void-black|near-black|framer-blue|muted-silver|frosted-white|subtle-white|ghost-white|blue-glow|shadow-ring|shadow-elevated|rounded-pill|rounded-pill-sm" src/
```

Expected: 0 results. 발견되면 즉시 교체 후 commit.

- [ ] **Step 2: globals.css의 옛 토큰 정의 잔여 확인**

```bash
grep -nE "void-black|near-black|framer-blue|muted-silver|frosted-white|subtle-white|ghost-white|blue-glow" src/app/globals.css
```

Expected: 0 results. (Task 1에서 임시 호환 토큰을 뒀다면 여기서 제거.)

- [ ] **Step 3: 풀빌드 + 타입체크 + lint + test**

```bash
pnpm build 2>&1 | tail -30
pnpm lint 2>&1 | tail -20
pnpm test 2>&1 | tail -20
```

Expected: 모두 통과 (warnings 0개 또는 디자인 무관 warnings만).

- [ ] **Step 4: 모든 페이지 시각 점검 체크리스트**

`pnpm dev` 후 다음 페이지를 모두 브라우저로 진입해 확인:

**사용자 영역:**
- [ ] `/` — 홈, hero 타이틀
- [ ] `/today` — 오늘의 학습 허브
- [ ] `/archive` — 아카이브 리스트
- [ ] `/_profile` — 프로필, 스트릭, 통계
- [ ] `/learn/{콘텐츠ID}` — 학습 허브, 6단계 진도 표시
- [ ] `/learn/{콘텐츠ID}/reading` — reading 본문 (20px/lh 1.8)
- [ ] `/learn/{콘텐츠ID}/listening` — TTS 플레이어
- [ ] `/learn/{콘텐츠ID}/expressions` — 표현 리스트
- [ ] `/learn/{콘텐츠ID}/quiz` — 퀴즈
- [ ] `/learn/{콘텐츠ID}/interview` — 인터뷰 챗
- [ ] `/learn/{콘텐츠ID}/speaking` — 녹음 스튜디오

**어드민 영역:**
- [ ] `/admin/login` — 로그인 폼
- [ ] `/admin` — 대시보드, 통계 숫자
- [ ] `/admin/content` — 콘텐츠 리스트
- [ ] `/admin/content/new` — 콘텐츠 생성 폼
- [ ] `/admin/content/{id}/edit` — 콘텐츠 편집 폼
- [ ] `/admin/topics` — 주제 스케줄
- [ ] `/admin/users` — 회원 관리
- [ ] `/admin/usage` — API 사용량
- [ ] `/admin/settings` — AI 모델 설정

각 페이지에서 확인할 것:
- 베이지 배경이 정상 표시
- 텍스트 색이 검정/회색 위계 유지
- brand orange가 CTA에만 등장 (남용 X)
- 카드/입력 흰 배경 + border-default 1px
- 6단계 typography utility(text-hero/display/headline/title/body/caption)가 의도대로 적용

- [ ] **Step 5: 사용자 최종 승인**

> ⚠️ **사용자 확인 단계** — 모든 페이지 시각 점검 후 사용자에게 "리뉴얼 완료, 운영 반영해도 되나요?" 확인.

- [ ] **Step 6: 정리 commit (필요 시)**

QA 중 발견한 잔여 이슈 수정이 있다면:

```bash
git add -u
git commit -m "$(cat <<'EOF'
chore(design): 매거진 톤 리뉴얼 QA 잔여 정리

[QA에서 발견한 구체적 항목 나열]

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 7: 운영 반영 (PM2 restart)**

> ⚠️ 사용자가 운영 반영을 명시적으로 요청한 경우에만 진행.

```bash
cd /var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines
git push origin main
pnpm build
pm2 restart routines  # ecosystem.config.js의 앱 이름 확인
pm2 logs routines --lines 30
```

Expected: 빌드 성공 + PM2 정상 restart + 에러 로그 없음.

---

## 부록: 참고 변환 패턴 (Task 5 표 재사용)

이 플랜의 다수 task에서 참조되는 옛→새 토큰 변환 패턴:

| 옛 클래스 | 새 클래스 |
|----------|----------|
| `text-white` | `text-text-primary` |
| `text-muted-silver` | `text-text-secondary` |
| `text-white/40`, `/50`, `/60` | `text-text-tertiary` |
| `text-framer-blue` | `text-brand-primary` |
| `bg-void-black` | `bg-bg-page` |
| `bg-near-black` | `bg-surface` |
| `bg-frosted-white` | `bg-bg-subtle` |
| `border-white/5`, `/10` | `border-border-default` |
| `shadow-ring-blue`, `shadow-elevated` | (제거 + `border border-border-default`) |
| `rounded-pill`, `rounded-pill-sm` | `rounded-md` (8px) 또는 `rounded-lg` (12px) |
| `text-[110px]` 등 hero | `text-hero` |
| `text-[60~70px]` | `text-display` |
| `text-[28~36px]` 섹션 | `text-headline` |
| `text-[20~24px]` 카드 제목 | `text-title` |
| `text-[15~18px]` 본문 | `text-body` |
| `text-[12~13px]` 캡션 | `text-caption` |
| `tracking-[-...px]` 임의 값 | (제거 — utility에 포함됨) |

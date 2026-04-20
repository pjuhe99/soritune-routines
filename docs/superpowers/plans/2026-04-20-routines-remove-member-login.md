# routines.soritune.com — 회원 로그인 제거 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** routines.soritune.com 에서 회원 로그인/가입을 제거하고 `/today`, `/learn/*`, `/archive` 를 비로그인 공개 페이지로 전환한다. `/admin/*` 만 로그인을 유지하며 로그인 진입점은 `/admin/login` 으로 이전한다.

**Architecture:** 스펙 `2026-04-20-routines-remove-member-login-design.md` 의 결정(C/B/A/A)을 그대로 반영. 회원 종속 코드와 DB 스키마는 보존하고 라우팅/미들웨어/프론트엔드 호출만 변경. 파일럿 이후 복구 시 `git revert` 로 되돌릴 수 있도록 기능 단위로 커밋 분리.

**Tech Stack:** Next.js 16 (App Router), NextAuth.js v5 beta, Prisma 6, pnpm, PM2.

**작업 디렉토리**: `/var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines/`
**Git 브랜치**: `main` (routines 는 dev/prod 분리 없음)

## 스펙 대비 추가 결정 사항

스펙 작성 시점에는 프론트엔드 호출 제거만 고려했으나, 코드 확인 결과 **`/api/content/[id]`, `/api/content`, `/api/ai/interview` 가 모두 `requireAuth()` 를 걸고 있어** 비로그인 상태에서 콘텐츠 자체를 불러올 수 없다. 따라서 다음 2개 API 에서 `requireAuth()` 제거가 추가로 필요:

1. `src/app/api/content/[id]/route.ts` — 학습 콘텐츠 단건 조회
2. `src/app/api/content/route.ts` — 아카이브 목록
3. `src/app/api/ai/interview/route.ts` — AI 인터뷰 피드백

`/api/progress*`, `/api/streak` 는 프론트 호출을 모두 제거하므로 서버 측 `requireAuth()` 는 그대로 둔다 (추후 복구 시 그대로 재사용).

또한 `archive` 페이지가 `session.user.subscriptionStatus === "active"` 로 구독 회원 전용 콘텐츠를 잠그고 있다. 파일럿 기간 동안 **모든 콘텐츠를 공개**로 전환한다 (구독 로직 제거, 코드는 Git history 에 보존).

---

## 파일 변경 맵

### Create
- `src/app/(admin)/admin/login/page.tsx` — admin 전용 로그인 폼 (기존 `(auth)/login/page.tsx` 에서 signup/reset 링크 제거, 리다이렉트 대상 `/admin`)

### Modify
- `middleware.ts` — matcher 축소, 리다이렉트 대상 변경
- `src/lib/auth.ts` — `pages.signIn` 변경
- `src/app/page.tsx` — 랜딩 CTA 교체
- `src/components/nav.tsx` — auth 관련 UI 전부 제거
- `src/app/(main)/today/page.tsx` — session/progress 제거
- `src/app/(main)/archive/page.tsx` — session/subscriber 로직 제거
- `src/app/(main)/learn/[contentId]/reading/page.tsx` — progress 호출 제거
- `src/app/(main)/learn/[contentId]/listening/page.tsx` — progress 호출 제거
- `src/app/(main)/learn/[contentId]/expressions/page.tsx` — progress 호출 제거
- `src/app/(main)/learn/[contentId]/quiz/page.tsx` — progress 호출 제거
- `src/app/(main)/learn/[contentId]/interview/page.tsx` — progress 호출 제거
- `src/app/(main)/learn/[contentId]/speaking/page.tsx` — progress 호출 제거, 완료 후 항상 `/learn/.../complete` 로 이동
- `src/app/(main)/learn/[contentId]/complete/page.tsx` — streak 호출 제거, share 호출 유지
- `src/app/api/content/[id]/route.ts` — `requireAuth()` 제거
- `src/app/api/content/route.ts` — `requireAuth()` 제거
- `src/app/api/ai/interview/route.ts` — `requireAuth()` 제거

### Delete
- `src/app/(auth)/` 전체 디렉토리 (login, signup, reset-password)
- `src/app/api/auth/signup/route.ts`
- `src/app/api/auth/reset-password/route.ts`
- `src/app/api/auth/reset-password/confirm/route.ts`
- `src/components/streak-display.tsx`

### Rename
- `src/app/(main)/profile/` → `src/app/(main)/_profile/` (App Router 에서 `_` 접두사 폴더는 라우팅 제외)

### 변경 없음 (보존)
- `prisma/` 스키마 전체
- `src/app/api/progress/`, `src/app/api/streak/` 라우트
- `src/app/api/share/route.ts`, `src/app/api/events/route.ts` (optional auth 이미 지원)
- `src/app/api/auth/[...nextauth]/route.ts` (admin 로그인에 필요)

## 검증 환경

routines 프로젝트는 테스트 프레임워크가 설정되어 있지 않다 (`package.json` 에 `test` 스크립트 없음). 따라서 TDD 대신 **빌드 성공 + 수동 검증**으로 verification 을 수행한다. 각 태스크 끝에 `pnpm build` 로 타입/빌드 에러를 즉시 검출한다.

---

## Task 1: 미들웨어 및 NextAuth 설정 변경

**Files:**
- Modify: `middleware.ts:1-41`
- Modify: `src/lib/auth.ts:65-67`

- [ ] **Step 1: `middleware.ts` 전체 교체**

파일 경로: `/var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines/middleware.ts`

```typescript
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Admin routes require admin role. /admin/login itself is the sign-in page
  // and must remain publicly accessible so users can reach it to authenticate.
  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    if (!req.auth?.user) {
      return NextResponse.redirect(new URL("/admin/login", req.url));
    }
    if ((req.auth.user as { role: string }).role !== "admin") {
      return NextResponse.redirect(new URL("/", req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/admin/:path*"],
};
```

- [ ] **Step 2: `src/lib/auth.ts` 의 `pages.signIn` 변경**

기존:
```typescript
  pages: {
    signIn: "/login",
  },
```

변경 후:
```typescript
  pages: {
    signIn: "/admin/login",
  },
```

- [ ] **Step 3: 빌드 확인 (미들웨어 + auth.ts 만 바뀐 상태, 아직 `/login` 페이지는 존재)**

```bash
cd /var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines
pnpm build 2>&1 | tail -20
```

Expected: 타입/빌드 에러 없음. warning 은 무방.

- [ ] **Step 4: 커밋 보류** — Task 2~4 와 함께 하나의 "routing/auth 변경" 커밋으로 묶음

---

## Task 2: admin 로그인 페이지 신설

**Files:**
- Create: `src/app/(admin)/admin/login/page.tsx`

- [ ] **Step 1: 디렉토리 생성 및 페이지 파일 작성**

```bash
mkdir -p /var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines/src/app/\(admin\)/admin/login
```

파일 경로: `src/app/(admin)/admin/login/page.tsx`

```typescript
"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("이메일 또는 비밀번호가 올바르지 않습니다.");
      return;
    }

    router.push("/admin");
    router.refresh();
  }

  return (
    <main className="flex items-center justify-center min-h-screen px-4">
      <div className="w-full max-w-[400px]">
        <h1 className="text-[32px] font-semibold tracking-[-1px] leading-[1.13] text-center mb-2">
          관리자 로그인
        </h1>
        <p className="text-muted-silver text-[15px] tracking-[-0.01px] leading-[1.6] text-center mb-8">
          Routines 관리자 페이지
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="이메일"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@example.com"
            required
          />
          <Input
            label="비밀번호"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="8자 이상"
            required
          />

          {error && (
            <p className="text-red-400 text-[13px] text-center">{error}</p>
          )}

          <Button type="submit" fullWidth disabled={loading}>
            {loading ? "로그인 중..." : "로그인"}
          </Button>
        </form>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: `(admin)/admin/layout.tsx` 가 `/admin/login` 에 사이드바를 띄우지 않도록 하는지 확인**

Read `src/app/(admin)/admin/layout.tsx`. 레이아웃이 사이드바를 무조건 띄우는 구조라면 로그인 페이지에도 사이드바가 표시됨. 아래와 같이 `/admin/login` 경로일 때 레이아웃을 건너뛰도록 수정:

```typescript
"use client";

import { AdminSidebar } from "@/components/admin/sidebar";
import { usePathname } from "next/navigation";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // Login page has no sidebar (user not yet authenticated).
  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
```

- [ ] **Step 3: 빌드 확인**

```bash
pnpm build 2>&1 | tail -20
```

Expected: 빌드 성공. 이 시점에는 `/login` 과 `/admin/login` 이 둘 다 존재 — 다음 태스크에서 `/login` 제거.

---

## Task 3: 회원 auth 라우트/페이지 삭제

**Files:**
- Delete: `src/app/(auth)/` 디렉토리 전체
- Delete: `src/app/api/auth/signup/route.ts`
- Delete: `src/app/api/auth/reset-password/route.ts`
- Delete: `src/app/api/auth/reset-password/confirm/route.ts`

- [ ] **Step 1: `(auth)` 디렉토리 삭제**

```bash
cd /var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines
rm -rf "src/app/(auth)"
```

- [ ] **Step 2: signup / reset-password API 라우트 삭제**

```bash
rm -rf src/app/api/auth/signup
rm -rf src/app/api/auth/reset-password
```

`src/app/api/auth/[...nextauth]/route.ts` 는 **유지** (admin 로그인에 필요).

- [ ] **Step 3: 빌드 확인**

```bash
pnpm build 2>&1 | tail -20
```

Expected: 빌드 성공. `/login`, `/signup`, `/reset-password` 라우트가 사라짐.

---

## Task 4: `/profile` 폴더를 비라우트 폴더로 전환

**Files:**
- Rename: `src/app/(main)/profile/` → `src/app/(main)/_profile/`

- [ ] **Step 1: 폴더명 변경**

Next.js App Router 에서 `_` 접두사 폴더는 라우팅에서 제외되지만 파일 내용은 보존된다 (private folder 규칙).

```bash
cd /var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines
mv "src/app/(main)/profile" "src/app/(main)/_profile"
```

- [ ] **Step 2: 빌드 확인**

```bash
pnpm build 2>&1 | tail -20
```

Expected: 빌드 성공. `/profile` 라우트가 사라짐.

- [ ] **Step 3: 여기까지 (Task 1~4) 한 커밋으로 묶어 커밋**

```bash
cd /var/www/html/_______site_SORITUNECOM_ROUTINES
git add -A
git status  # 변경 파일 확인
git commit -m "$(cat <<'EOF'
refactor: route to /admin/login and remove member auth pages

- Middleware protects /admin only (except /admin/login itself)
- NextAuth signIn page moved to /admin/login
- Delete (auth)/ group, signup, reset-password routes and APIs
- Rename /profile -> /_profile (private folder, code preserved)

Code preserved via git history for pilot-phase re-introduction.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: 인증 필수 API 를 공개로 전환

**Files:**
- Modify: `src/app/api/content/[id]/route.ts:1-22`
- Modify: `src/app/api/content/route.ts:1-37`
- Modify: `src/app/api/ai/interview/route.ts:1-48`

비로그인 사용자가 학습 콘텐츠를 볼 수 있으려면 이들 API 가 공개여야 함. 스펙 작성 시점엔 고려하지 않았지만 코드 확인 과정에서 추가됨.

- [ ] **Step 1: `src/app/api/content/[id]/route.ts` 에서 `requireAuth()` 제거**

기존:
```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  ...
}
```

변경 후:
```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const content = await prisma.content.findUnique({
    where: { id: parseInt(id), isActive: true },
  });

  if (!content) {
    return NextResponse.json({ error: "Content not found" }, { status: 404 });
  }

  return NextResponse.json(content);
}
```

(사용하지 않는 `req` 매개변수는 유지 — Next.js App Router 시그니처 요구사항)

- [ ] **Step 2: `src/app/api/content/route.ts` 에서 `requireAuth()` 제거**

기존 상단 import 에서 `requireAuth` 제거, GET 함수 시작의 `const { error } = await requireAuth(); if (error) return error;` 2줄 삭제.

최종 파일:
```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const page = parseInt(req.nextUrl.searchParams.get("page") || "1");
  const limit = 20;

  const [contents, total] = await Promise.all([
    prisma.content.findMany({
      where: { isActive: true, publishedAt: { not: null } },
      select: {
        id: true,
        genre: true,
        title: true,
        subtitle: true,
        keyPhrase: true,
        keyKo: true,
        publishedAt: true,
      },
      orderBy: { publishedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.content.count({
      where: { isActive: true, publishedAt: { not: null } },
    }),
  ]);

  return NextResponse.json({
    contents,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}
```

- [ ] **Step 3: `src/app/api/ai/interview/route.ts` 에서 `requireAuth()` 제거**

기존 상단 import 에서 `requireAuth` 제거, POST 함수 시작의 `const { error } = await requireAuth(); if (error) return error;` 2줄 삭제.

최종 파일:
```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getInterviewFeedback } from "@/lib/ai-service";

export async function POST(req: NextRequest) {
  try {
    const { contentId, question, answer } = await req.json();

    if (!contentId || !question || !answer) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const content = await prisma.content.findUnique({
      where: { id: contentId },
      select: { title: true, keyPhrase: true },
    });

    const contentContext = content
      ? `${content.title} - ${content.keyPhrase}`
      : "General English conversation";

    const feedback = await getInterviewFeedback(question, answer, contentContext);

    return NextResponse.json({ feedback });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";

    if (message === "AI provider not configured") {
      return NextResponse.json(
        { error: "AI service is not configured" },
        { status: 503 }
      );
    }

    console.error("AI interview error:", message);
    return NextResponse.json(
      { error: "Failed to get AI feedback" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 4: 빌드 확인**

```bash
pnpm build 2>&1 | tail -20
```

Expected: 빌드 성공.

- [ ] **Step 5: 커밋**

```bash
cd /var/www/html/_______site_SORITUNECOM_ROUTINES
git add -A
git commit -m "$(cat <<'EOF'
refactor: open content and interview APIs for anonymous access

- Remove requireAuth from /api/content, /api/content/[id]
- Remove requireAuth from /api/ai/interview
- /api/progress*, /api/streak keep requireAuth (no frontend callers)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: 네비게이션 컴포넌트 정리

**Files:**
- Modify: `src/components/nav.tsx:1-152`
- Delete: `src/components/streak-display.tsx`

- [ ] **Step 1: `src/components/nav.tsx` 전체 교체**

로그인/회원가입/프로필/스트릭/로그아웃/관리자 링크 전부 제거. 공개 링크(`/today`, `/archive`) 만 표시.

```typescript
"use client";

import { useState } from "react";
import Link from "next/link";

export function Nav() {
  const [mobileOpen, setMobileOpen] = useState(false);

  const closeMenu = () => setMobileOpen(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-void-black/80 backdrop-blur-sm border-b border-white/5">
      <div className="max-w-container mx-auto px-6 h-16 flex items-center justify-between">
        <Link
          href="/"
          className="text-[20px] font-semibold tracking-[-0.8px] text-white"
          onClick={closeMenu}
        >
          Routines
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-6">
          <Link
            href="/today"
            className="text-[15px] font-medium text-white/80 hover:text-white tracking-[-0.15px] transition-colors"
          >
            오늘의 학습
          </Link>
          <Link
            href="/archive"
            className="text-[15px] font-medium text-white/80 hover:text-white tracking-[-0.15px] transition-colors"
          >
            아카이브
          </Link>
        </div>

        {/* Mobile hamburger button */}
        <button
          className="md:hidden flex flex-col justify-center items-center w-8 h-8 gap-1.5"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="메뉴 열기"
        >
          <span
            className={`block w-5 h-0.5 bg-white transition-transform duration-200 ${mobileOpen ? "rotate-45 translate-y-[4px]" : ""}`}
          />
          <span
            className={`block w-5 h-0.5 bg-white transition-opacity duration-200 ${mobileOpen ? "opacity-0" : ""}`}
          />
          <span
            className={`block w-5 h-0.5 bg-white transition-transform duration-200 ${mobileOpen ? "-rotate-45 -translate-y-[4px]" : ""}`}
          />
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-void-black/95 backdrop-blur-sm border-b border-white/5 px-6 pb-4 pt-2 flex flex-col gap-4">
          <Link
            href="/today"
            className="text-[15px] font-medium text-white/80 hover:text-white tracking-[-0.15px] transition-colors"
            onClick={closeMenu}
          >
            오늘의 학습
          </Link>
          <Link
            href="/archive"
            className="text-[15px] font-medium text-white/80 hover:text-white tracking-[-0.15px] transition-colors"
            onClick={closeMenu}
          >
            아카이브
          </Link>
        </div>
      )}
    </nav>
  );
}
```

- [ ] **Step 2: 사용되지 않는 `streak-display.tsx` 삭제**

```bash
rm /var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines/src/components/streak-display.tsx
```

- [ ] **Step 3: 빌드 확인**

```bash
pnpm build 2>&1 | tail -20
```

Expected: 빌드 성공. (nav 에서 `useSession` 호출 제거되어 경고도 줄어야 함)

---

## Task 7: 랜딩 페이지 CTA 교체

**Files:**
- Modify: `src/app/page.tsx:52-54`

- [ ] **Step 1: signup CTA 를 `/today` 로 교체**

기존:
```typescript
        <Link href="/signup" className="mt-10">
          <Button>무료로 시작하기</Button>
        </Link>
```

변경 후:
```typescript
        <Link href="/today" className="mt-10">
          <Button>오늘 학습 시작하기</Button>
        </Link>
```

- [ ] **Step 2: 빌드 확인**

```bash
pnpm build 2>&1 | tail -20
```

- [ ] **Step 3: 커밋 (Task 6~7 묶어서)**

```bash
cd /var/www/html/_______site_SORITUNECOM_ROUTINES
git add -A
git commit -m "$(cat <<'EOF'
refactor: simplify nav and landing CTA for logged-out pilot

- Nav shows only public links (오늘의 학습 / 아카이브)
- Remove login, signup, profile, streak, logout, admin links
- Landing CTA: signup -> /today
- Delete streak-display component

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: `/today` 페이지 — 세션 및 progress 호출 제거

**Files:**
- Modify: `src/app/(main)/today/page.tsx:1-168`

- [ ] **Step 1: `today/page.tsx` 전체 교체**

`useSession` 제거, progress API 호출 제거, 세션 게이트 제거. 진도 표시는 "첫 번째 스텝 active, 나머지 locked" 로 고정.

```typescript
"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { StepCard } from "@/components/step-card";
import Link from "next/link";

interface Content {
  id: number;
  title: string;
  subtitle: string;
  genre: string;
  keyPhrase: string;
  keyKo: string;
}

const STEPS = [
  { key: "reading", label: "읽기", description: "오늘의 콘텐츠를 읽어보세요" },
  { key: "listening", label: "듣기", description: "문장을 들어보세요" },
  { key: "expressions", label: "표현", description: "핵심 표현을 학습하세요" },
  { key: "quiz", label: "퀴즈", description: "배운 표현을 테스트하세요" },
  { key: "interview", label: "AI 인터뷰", description: "AI와 영어로 대화하세요" },
  { key: "speaking", label: "말하기", description: "직접 발음해보세요" },
];

export default function TodayPage() {
  const [content, setContent] = useState<Content | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const contentRes = await fetch("/api/content/today");

        if (contentRes.ok) {
          const contentData = await contentRes.json();
          setContent(contentData);

          // Track anonymous view (optional-auth endpoint)
          fetch("/api/events", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: "view", contentId: contentData.id }),
          }).catch(() => {});
        }
      } catch {
        // Network error
      }
      setLoading(false);
    }

    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-silver">로딩 중...</p>
      </div>
    );
  }

  if (!content) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-silver">오늘의 콘텐츠가 아직 없습니다.</p>
      </div>
    );
  }

  // Without user progress tracking, always show first step as active, rest locked.
  // Users navigate through steps sequentially via the learn flow.
  function getStepStatus(index: number) {
    if (index === 0) return "active" as const;
    return "locked" as const;
  }

  return (
    <div className="max-w-container mx-auto px-6 py-12">
      <div className="mb-10">
        <span className="text-[12px] font-semibold text-framer-blue tracking-[2px] uppercase">
          {content.genre}
        </span>
        <h1 className="text-[62px] font-bold tracking-[-3.1px] leading-[1] mt-2 mb-3">
          {content.title}
        </h1>
        {content.subtitle && (
          <p className="text-[18px] text-muted-silver tracking-[-0.01px] leading-[1.6]">
            {content.subtitle}
          </p>
        )}
        <Card variant="surface" className="mt-6 inline-block">
          <p className="text-[15px]">
            <span className="text-framer-blue font-medium">
              {content.keyPhrase}
            </span>
            <span className="text-muted-silver ml-3">{content.keyKo}</span>
          </p>
        </Card>
      </div>

      <div className="grid gap-3">
        {STEPS.map((step, i) => (
          <StepCard
            key={step.key}
            label={step.label}
            description={step.description}
            status={getStepStatus(i)}
            href={i === 0 ? `/learn/${content.id}/${step.key}` : undefined}
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 빌드 확인**

```bash
pnpm build 2>&1 | tail -20
```

---

## Task 9: `/archive` 페이지 — 세션 및 구독 로직 제거

**Files:**
- Modify: `src/app/(main)/archive/page.tsx:1-113`

- [ ] **Step 1: `archive/page.tsx` 전체 교체**

`useSession` 제거. 모든 콘텐츠를 누구나 접근 가능하게 전환 (구독 게이트 제거).

```typescript
"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import Link from "next/link";

interface ContentItem {
  id: number;
  genre: string;
  title: string;
  subtitle: string;
  keyPhrase: string;
  keyKo: string;
  publishedAt: string;
}

export default function ArchivePage() {
  const [contents, setContents] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/content");
      if (res.ok) {
        const data = await res.json();
        setContents(data.contents);
      }
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-silver">로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="max-w-container mx-auto px-6 py-12">
      <h1 className="text-[32px] font-semibold tracking-[-1px] leading-[1.13] mb-8">
        아카이브
      </h1>

      <div className="grid gap-4">
        {contents.map((content) => (
          <Link key={content.id} href={`/learn/${content.id}/reading`}>
            <Card variant="surface" className="hover:bg-white/5 transition-all">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[12px] text-framer-blue font-medium tracking-[1px] uppercase">
                    {content.genre}
                  </span>
                  <h2 className="text-[20px] font-semibold tracking-[-0.8px] leading-[1.2] mt-1">
                    {content.title}
                  </h2>
                  {content.subtitle && (
                    <p className="text-[14px] text-muted-silver mt-1 leading-[1.4]">
                      {content.subtitle}
                    </p>
                  )}
                </div>
                <span className="text-[12px] text-muted-silver shrink-0 ml-4">
                  {content.publishedAt?.split("T")[0]}
                </span>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 빌드 확인**

```bash
pnpm build 2>&1 | tail -20
```

---

## Task 10: learn 6단계 페이지에서 progress 호출 제거

**Files (Modify):**
- `src/app/(main)/learn/[contentId]/reading/page.tsx:28-35`
- `src/app/(main)/learn/[contentId]/listening/page.tsx:22-29`
- `src/app/(main)/learn/[contentId]/expressions/page.tsx:27-34`
- `src/app/(main)/learn/[contentId]/quiz/page.tsx:25-32`
- `src/app/(main)/learn/[contentId]/interview/page.tsx:19-26`
- `src/app/(main)/learn/[contentId]/speaking/page.tsx:19-45`

패턴: 각 페이지 `handleComplete` 함수에서 `fetch("/api/progress/...")` 호출 삭제, 즉시 다음 페이지로 `router.push()`.

- [ ] **Step 1: reading — `handleComplete` 수정**

파일: `src/app/(main)/learn/[contentId]/reading/page.tsx`

기존:
```typescript
  async function handleComplete() {
    await fetch(`/api/progress/${contentId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: "reading" }),
    });
    router.push(`/learn/${contentId}/listening`);
  }
```

변경 후 (async 제거):
```typescript
  function handleComplete() {
    router.push(`/learn/${contentId}/listening`);
  }
```

- [ ] **Step 2: listening — `handleComplete` 수정**

파일: `src/app/(main)/learn/[contentId]/listening/page.tsx`

기존:
```typescript
  async function handleComplete(skipped = false) {
    await fetch(`/api/progress/${contentId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: "listening", skipped }),
    });
    router.push(`/learn/${contentId}/expressions`);
  }
```

변경 후:
```typescript
  function handleComplete() {
    router.push(`/learn/${contentId}/expressions`);
  }
```

호출부도 인자 제거 (Skip 버튼과 Next 버튼 모두 동일하게 이동):
```typescript
        {!ttsAvailable && (
          <Button variant="ghost" onClick={handleComplete}>
            Skip
          </Button>
        )}
        <Button onClick={handleComplete}>Next: Expressions</Button>
```

- [ ] **Step 3: expressions — `handleComplete` 수정**

파일: `src/app/(main)/learn/[contentId]/expressions/page.tsx`

기존 (7~14번 라인 부근):
```typescript
  async function handleComplete() {
    await fetch(`/api/progress/${contentId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: "expressions" }),
    });
    router.push(`/learn/${contentId}/quiz`);
  }
```

변경 후:
```typescript
  function handleComplete() {
    router.push(`/learn/${contentId}/quiz`);
  }
```

- [ ] **Step 4: quiz — `handleComplete` 수정**

파일: `src/app/(main)/learn/[contentId]/quiz/page.tsx`

기존:
```typescript
  async function handleComplete(score: number) {
    await fetch(`/api/progress/${contentId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: "quiz", score }),
    });
    router.push(`/learn/${contentId}/interview`);
  }
```

변경 후 (QuizForm 의 onComplete 시그니처가 `(score: number) => void` 이므로 score 파라미터는 유지하되 사용하지 않음):
```typescript
  function handleComplete(_score: number) {
    router.push(`/learn/${contentId}/interview`);
  }
```

(eslint 가 미사용 변수를 `_` 접두사로 허용하는지 확인. 필요 시 파라미터 자체를 뺄 것.)

- [ ] **Step 5: interview — `handleComplete` 수정**

파일: `src/app/(main)/learn/[contentId]/interview/page.tsx`

기존:
```typescript
  async function handleComplete() {
    await fetch(`/api/progress/${contentId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: "interview" }),
    });
    router.push(`/learn/${contentId}/speaking`);
  }
```

변경 후:
```typescript
  function handleComplete() {
    router.push(`/learn/${contentId}/speaking`);
  }
```

- [ ] **Step 6: speaking — 두 핸들러 수정 + complete 로 항상 이동**

파일: `src/app/(main)/learn/[contentId]/speaking/page.tsx`

기존:
```typescript
  async function handleComplete(score: number) {
    const res = await fetch(`/api/progress/${contentId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: "speaking", score }),
    });
    const data = await res.json();
    if (data.allDone) {
      router.push(`/learn/${contentId}/complete`);
    } else {
      router.push(`/today`);
    }
  }

  async function handleSkip() {
    const res = await fetch(`/api/progress/${contentId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: "speaking", skipped: true }),
    });
    const data = await res.json();
    if (data.allDone) {
      router.push(`/learn/${contentId}/complete`);
    } else {
      router.push(`/today`);
    }
  }
```

진도 추적이 없으므로 마지막 단계(speaking) 완료 시 **항상 complete 로 이동**:

변경 후:
```typescript
  function handleComplete(_score: number) {
    router.push(`/learn/${contentId}/complete`);
  }

  function handleSkip() {
    router.push(`/learn/${contentId}/complete`);
  }
```

- [ ] **Step 7: 빌드 확인**

```bash
pnpm build 2>&1 | tail -20
```

Expected: 빌드 성공. 미사용 파라미터 린팅 에러가 나면 파라미터 자체를 제거하거나 `eslint-disable-next-line` 으로 처리.

---

## Task 11: `/learn/.../complete` 페이지 — streak 호출 제거

**Files:**
- Modify: `src/app/(main)/learn/[contentId]/complete/page.tsx:1-65`

- [ ] **Step 1: `complete/page.tsx` 전체 교체**

streak fetch 제거. streak 표시 블록을 "오늘 학습 완료!" 메시지로 교체. share 기능은 유지 (`/api/share` 는 optional-auth).

```typescript
"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function CompletePage() {
  const params = useParams();
  const contentId = Number(params.contentId);

  async function handleShare() {
    const text = `Completed today's English learning on Routines! https://routines.soritune.com`;
    navigator.clipboard.writeText(text);

    try {
      await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentId, channel: "copy" }),
      });
    } catch {
      // Share tracking failed silently - clipboard copy still works
    }

    alert("Copied to clipboard!");
  }

  return (
    <div className="max-w-[600px] mx-auto px-6 py-20 text-center">
      <div className="text-[80px] mb-6">&#127881;</div>
      <h1 className="text-[62px] font-bold tracking-[-3.1px] leading-[1] mb-4">
        Complete!
      </h1>
      <p className="text-[18px] text-muted-silver leading-[1.6] mb-8">
        You finished today&apos;s learning routine
      </p>

      <div className="flex flex-col items-center gap-3">
        <Button variant="frosted" onClick={handleShare}>
          Share Result
        </Button>
        <Link href="/today">
          <Button variant="ghost">Back to Today</Button>
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 빌드 확인**

```bash
pnpm build 2>&1 | tail -20
```

- [ ] **Step 3: 커밋 (Task 8~11 묶어서)**

```bash
cd /var/www/html/_______site_SORITUNECOM_ROUTINES
git add -A
git commit -m "$(cat <<'EOF'
refactor: remove auth-required API calls from learn flow

- /today: drop useSession and /api/progress (first step always active)
- /archive: drop session and subscriber gating (all content open)
- /learn/* (6 steps): drop /api/progress calls from handleComplete
- /learn/.../speaking: always route to /complete on finish
- /learn/.../complete: drop /api/streak fetch, keep share (optional-auth)

/api/events and /api/share already accept anonymous calls so we keep
the view/share tracking intact.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: 배포 및 수동 검증

PM2 로 운영 중인 Next.js 인스턴스를 재시작하여 변경사항을 반영하고 전체 플로우를 수동 확인한다.

- [ ] **Step 1: 최종 빌드**

```bash
cd /var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines
pnpm build 2>&1 | tail -30
```

Expected: 빌드 성공. 경고(warning) 허용, 에러(error) 없음.

- [ ] **Step 2: PM2 상태 확인 후 재시작**

```bash
pm2 list
pm2 reload ecosystem.config.js --update-env 2>&1 | tail -10
pm2 logs --lines 20 --nostream 2>&1 | tail -40
```

Expected: 프로세스가 online 상태로 재기동되고, 에러 로그 없음.

- [ ] **Step 3: 비로그인 상태 수동 검증 (시크릿 창 / 쿠키 삭제 후)**

다음을 순서대로 확인. https://routines.soritune.com 에 접속해 확인:

1. `/` 랜딩 페이지 — "오늘 학습 시작하기" CTA 가 `/today` 로 연결됨
2. `/today` — 콘텐츠 정상 표시. reading 스텝만 active, 나머지 locked
3. `/today` → reading → listening → expressions → quiz → interview → speaking → complete 전체 6단계 완주
4. 완주 페이지에서 "Share Result" 클릭 시 클립보드 복사 + `/api/share` 호출 성공 (DevTools Network 탭에서 201 응답 확인)
5. `/archive` — 전체 콘텐츠 목록 표시, 모든 항목 클릭 가능 (구독 잠금 없음)
6. DevTools Network 탭에서 **`/api/progress`, `/api/streak` 호출이 전혀 없음** 확인
7. `/login`, `/signup`, `/reset-password`, `/profile` 직접 접근 시 404
8. `/admin` 접근 시 `/admin/login` 으로 리다이렉트

- [ ] **Step 4: admin 로그인 수동 검증**

1. `/admin/login` 에서 기존 admin 계정으로 로그인
2. `/admin` 대시보드 정상 진입
3. 기존 admin 기능(콘텐츠 CRUD, Users, AI Settings) 정상 동작
4. admin 로그인 후 `/today` 등 공개 페이지도 정상 (nav 은 공개 메뉴만 표시)

- [ ] **Step 5: GitHub push**

```bash
cd /var/www/html/_______site_SORITUNECOM_ROUTINES
git push origin main
```

Expected: 푸시 성공. 커밋 3건이 origin/main 에 반영됨.

- [ ] **Step 6: 문제가 있으면 특정 커밋만 revert**

예를 들어 nav 변경에 문제가 있으면:
```bash
git revert <nav 커밋 해시>
git push origin main
pm2 reload ecosystem.config.js --update-env
```

---

## 완료 체크리스트

- [ ] middleware 가 `/admin/*` 만 보호
- [ ] `/admin/login` 로 관리자 로그인 이전
- [ ] `/login`, `/signup`, `/reset-password`, `/profile` 완전 제거
- [ ] 회원가입 / 비밀번호 재설정 API 삭제
- [ ] 콘텐츠 / AI 인터뷰 API 공개 전환
- [ ] 네비게이션에 인증 관련 UI 없음
- [ ] 랜딩 CTA 가 `/today` 로 연결
- [ ] 학습 6단계 전체가 비로그인에서 동작
- [ ] `/api/progress`, `/api/streak` 호출 없음 (Network 탭 확인)
- [ ] admin 로그인 및 admin 페이지 정상
- [ ] Prisma 스키마 변경 없음
- [ ] 변경사항 `main` 브랜치에 커밋 + GitHub push 완료

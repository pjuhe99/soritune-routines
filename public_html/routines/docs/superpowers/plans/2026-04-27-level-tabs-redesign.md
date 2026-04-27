# Level Tabs & Progress Bar Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** routines.soritune.com 의 LevelGate 모달을 제거하고, `/learn/[contentId]/*` 상단에 항상 보이는 LevelTabs + 6단계 ProgressBar 를 도입한다. UserProgress 를 레벨별로 분리해 학습자가 자유롭게 레벨을 바꿔도 데이터가 꼬이지 않게 한다. `/` 와 `/today` 를 단일 진입 페이지로 합친다.

**Architecture:** Next.js 16 App Router 의 라우트 구조는 그대로 유지(6개 step 페이지 분리 유지). `/learn/[contentId]/layout.tsx` 를 server component 로 만들어 progress 데이터 fetch 후 신규 `LearnTopBar` 를 렌더링. 레벨은 URL `?level=` query param 이 single source of truth (없으면 `beginner`). LevelTabs/ProgressBar 는 client component 로서 `usePathname()` 으로 현재 step 추출. `UserProgress` 에 `level` 컬럼 추가, unique key 확장.

**Tech Stack:** Next.js 16, React 19, Prisma 6 + MySQL, Tailwind 4, Vitest 4, pnpm.

**Spec:** `docs/superpowers/specs/2026-04-27-level-tabs-redesign-design.md`

**Project root for all paths below:** `/var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines/`

---

## Context the engineer needs

- **userId 는 String UUID (`@db.VarChar(36)`)**, 정수 아님. SQL/Prisma 코드 작성 시 주의.
- **익명 사용자 지원**: 학습 페이지는 로그인 없이도 동작해야 함. `requireAuth()` 가 아닌 `requireUser()` (in `src/lib/auth-helpers.ts`) 를 사용. anon 쿠키 (`routines_anon_id`) 가 자동 User 생성.
- **현재 `/api/progress` 는 학습 흐름에서 호출되지 않음** (커밋 `a54af020` 이후). 이 plan 에서 다시 wiring 한다.
- **테스트 패턴**: vitest 순수 unit test (`src/lib/*.test.ts`). DB 접근/React 컴포넌트 테스트는 없음. 이 plan 도 같은 패턴 — 순수 함수만 자동 테스트, UI/API 는 수동 E2E.
- **ContentLevel enum**: `beginner | intermediate | advanced` (Prisma)
- **LearningStep enum**: `reading | listening | expressions | quiz | interview | speaking` (Prisma)
- **Step 순서**: 위 LearningStep enum 그대로 (reading=1 → speaking=6).
- **DB 상태**: `user_progress` / `interview_answers` / `recordings` 모두 0 rows. 마이그레이션 백필 불필요.
- **모든 commit 메시지 형식**: 기존 컨벤션 따라 `feat:` `fix:` `refactor:` `chore:` 등 prefix + 한 줄 요약. Co-Authored-By trailer 포함.

---

## File Structure

### 신규 파일
| 경로 | 책임 |
|------|------|
| `prisma/migrations/<timestamp>_add_level_to_user_progress/migration.sql` | UserProgress 에 `level` 컬럼 + 새 unique key + 인덱스 |
| `src/lib/progress.ts` | step 진행 위치 계산 (pure 로직) + Prisma 조회 헬퍼 |
| `src/lib/progress.test.ts` | `pickNextStep`, `progressToMap` 등 pure 함수 테스트 |
| `src/components/learn/learn-top-bar.tsx` | LevelTabs + ProgressBar 컨테이너 (server-friendly props) |
| `src/components/learn/level-tabs.tsx` | 3개 pill 탭, 클릭 시 router.push (client) |
| `src/components/learn/progress-bar.tsx` | 6칸 세그먼트 바 + 라벨 (client, usePathname) |

### 수정 파일
| 경로 | 변경 |
|------|------|
| `prisma/schema.prisma` | UserProgress 모델에 `level` 추가, unique 키 변경, 인덱스 추가 |
| `src/lib/level.ts` | localStorage 로직 제거, `parseLevel` + LEVELS/LABELS 만 남김 |
| `src/lib/level.test.ts` (신규) | `parseLevel` 단위 테스트 |
| `src/app/api/progress/[contentId]/route.ts` | level body/query 추가, requireUser 로 전환, 레벨별 done 체크, streak 중복 방지 |
| `src/app/(main)/learn/[contentId]/layout.tsx` | server component 로 변환, LearnTopBar 렌더링 |
| `src/app/(main)/learn/[contentId]/reading/page.tsx` | useLevel → useSearchParams, Next 시 progress POST + Link query 보존 |
| `src/app/(main)/learn/[contentId]/listening/page.tsx` | 동일 |
| `src/app/(main)/learn/[contentId]/expressions/page.tsx` | 동일 |
| `src/app/(main)/learn/[contentId]/quiz/page.tsx` | 동일 |
| `src/app/(main)/learn/[contentId]/interview/page.tsx` | 동일 |
| `src/app/(main)/learn/[contentId]/speaking/page.tsx` | 동일 |
| `src/app/(main)/learn/[contentId]/complete/page.tsx` | useLevel → useSearchParams |
| `src/components/learning/interview-chat.tsx` | useLevel → props 또는 useSearchParams |
| `src/components/learning/recording-studio.tsx` | useLevel → props 또는 useSearchParams |
| `src/app/(main)/page.tsx` | server component, `/today` 의 step list 흡수, hero + 시작하기 |
| `src/app/(main)/today/page.tsx` | `redirect('/')` 한 줄 |
| `src/app/(main)/layout.tsx` | LevelProvider/LevelGate 제거, SplashIntro/Nav 만 유지 |
| `src/components/nav.tsx` | LevelToggle 임포트/렌더 제거 |

### 삭제 파일 (Task 18 cleanup)
- `src/components/level-gate.tsx`
- `src/components/level-toggle.tsx`
- `src/contexts/level-context.tsx`

---

## Tasks

### Task 1: Prisma schema 변경 + migration 생성

**Files:**
- Modify: `prisma/schema.prisma` (UserProgress 모델)
- Create: `prisma/migrations/<timestamp>_add_level_to_user_progress/migration.sql` (Prisma CLI 가 생성)

- [ ] **Step 1: `user_progress` 가 비어있는지 확인**

```bash
cd /var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines
source ../../.db_credentials
mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -N -B \
  -e "SELECT COUNT(*) FROM user_progress;"
```

Expected: `0`. 0 이 아니면 STOP — backfill 전략 사용자와 재논의 필요.

- [ ] **Step 2: `prisma/schema.prisma` 의 `UserProgress` 모델 수정**

기존:
```prisma
model UserProgress {
  id          Int          @id @default(autoincrement())
  userId      String       @map("user_id") @db.VarChar(36)
  contentId   Int          @map("content_id")
  step        LearningStep
  completed   Boolean      @default(false)
  skipped     Boolean      @default(false)
  score       Int?
  completedAt DateTime?    @map("completed_at")

  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  content Content @relation(fields: [contentId], references: [id], onDelete: Cascade)

  @@unique([userId, contentId, step])
  @@map("user_progress")
}
```

변경 후:
```prisma
model UserProgress {
  id          Int          @id @default(autoincrement())
  userId      String       @map("user_id") @db.VarChar(36)
  contentId   Int          @map("content_id")
  level       ContentLevel
  step        LearningStep
  completed   Boolean      @default(false)
  skipped     Boolean      @default(false)
  score       Int?
  completedAt DateTime?    @map("completed_at")

  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  content Content @relation(fields: [contentId], references: [id], onDelete: Cascade)

  @@unique([userId, contentId, level, step])
  @@index([userId, contentId, level])
  @@map("user_progress")
}
```

- [ ] **Step 3: migration 생성**

```bash
cd /var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines
pnpm prisma migrate dev --name add_level_to_user_progress
```

Expected: 새 디렉토리 `prisma/migrations/<timestamp>_add_level_to_user_progress/` 생성, `migration.sql` 안에 ALTER TABLE 문, prisma generate 자동 실행.

`migration.sql` 예시 (자동 생성):
```sql
-- AlterTable
ALTER TABLE `user_progress` DROP INDEX `user_progress_user_id_content_id_step_key`;
ALTER TABLE `user_progress` ADD COLUMN `level` ENUM('beginner', 'intermediate', 'advanced') NOT NULL;
CREATE UNIQUE INDEX `user_progress_user_id_content_id_level_step_key` ON `user_progress`(`user_id`, `content_id`, `level`, `step`);
CREATE INDEX `user_progress_user_id_content_id_level_idx` ON `user_progress`(`user_id`, `content_id`, `level`);
```

- [ ] **Step 4: 빌드 통과 확인** (Prisma client 재생성됨)

```bash
pnpm build
```

Expected: 빌드 통과. (이 시점에는 코드 쪽 변경 없으므로 type 오류는 없어야 함; `userProgress` 의 모든 사용처가 새 필드 없이도 컴파일 되는지 검증.)

만약 type error 발생 (예: `userProgress.upsert` 의 `where` 절이 옛 unique 키 사용 중) → Task 5 에서 어차피 수정하므로 일단 NOTE 만 해두고 진행.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "$(cat <<'EOF'
feat(db): add level column to user_progress for per-level tracking

Per design spec, each content level (beginner/intermediate/advanced)
now tracks its own progression so users can switch levels mid-flow
without state corruption. Table is empty so no backfill needed.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: `src/lib/level.ts` 슬림화 + parseLevel 테스트

**Files:**
- Modify: `src/lib/level.ts`
- Create: `src/lib/level.test.ts`

- [ ] **Step 1: 새 테스트 파일 작성 (failing test)**

`src/lib/level.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { parseLevel, LEVELS, LEVEL_LABELS } from "./level";

describe("parseLevel", () => {
  it("returns the value if it is a known level", () => {
    expect(parseLevel("beginner")).toBe("beginner");
    expect(parseLevel("intermediate")).toBe("intermediate");
    expect(parseLevel("advanced")).toBe("advanced");
  });

  it("returns null for unknown strings", () => {
    expect(parseLevel("expert")).toBeNull();
    expect(parseLevel("")).toBeNull();
    expect(parseLevel("BEGINNER")).toBeNull();
  });

  it("returns null for non-string inputs", () => {
    expect(parseLevel(null)).toBeNull();
    expect(parseLevel(undefined)).toBeNull();
    expect(parseLevel(123)).toBeNull();
    expect(parseLevel({})).toBeNull();
  });
});

describe("LEVELS / LEVEL_LABELS", () => {
  it("has 3 levels in beginner→advanced order", () => {
    expect(LEVELS).toEqual(["beginner", "intermediate", "advanced"]);
  });

  it("has Korean label per level", () => {
    expect(LEVEL_LABELS.beginner).toBe("초급");
    expect(LEVEL_LABELS.intermediate).toBe("중급");
    expect(LEVEL_LABELS.advanced).toBe("고급");
  });
});
```

- [ ] **Step 2: 테스트 실행해서 fail 확인**

```bash
pnpm vitest run src/lib/level.test.ts
```

Expected: FAIL — `parseLevel` is not a function (현재 level.ts 에 없음).

- [ ] **Step 3: `src/lib/level.ts` 를 슬림한 새 버전으로 교체**

```ts
export const LEVELS = ["beginner", "intermediate", "advanced"] as const;
export type Level = (typeof LEVELS)[number];

export const LEVEL_LABELS: Record<Level, string> = {
  beginner: "초급",
  intermediate: "중급",
  advanced: "고급",
};

export function parseLevel(value: unknown): Level | null {
  if (typeof value !== "string") return null;
  return (LEVELS as readonly string[]).includes(value) ? (value as Level) : null;
}
```

기존 `DEFAULT_LEVEL`, `LEVEL_DESCRIPTIONS`, `LEVEL_STORAGE_KEY`, `isLevel` 모두 삭제 (다음 task 들에서 사용처 제거).

- [ ] **Step 4: 테스트 통과 확인**

```bash
pnpm vitest run src/lib/level.test.ts
```

Expected: PASS — 3 describe / 7 it 모두 통과.

- [ ] **Step 5: 빌드는 아직 깨질 수 있음 (다른 곳에서 옛 export 사용 중) — 일단 NOTE**

`level-context.tsx` 등이 `LEVEL_STORAGE_KEY`, `isLevel`, `LEVEL_DESCRIPTIONS` 를 import 중. 이들 파일은 Task 17~18 에서 삭제됨. 빌드 체크는 cleanup 후로 미룸.

- [ ] **Step 6: Commit**

```bash
git add src/lib/level.ts src/lib/level.test.ts
git commit -m "$(cat <<'EOF'
refactor(lib): slim level.ts to parseLevel + LEVELS/LABELS

Remove localStorage key, descriptions, and isLevel — they belong to
the deleted LevelContext flow. parseLevel replaces isLevel with a
narrowing-friendly API used by URL searchParams parsing.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `src/lib/progress.ts` pure 함수 + 테스트

**Files:**
- Create: `src/lib/progress.ts`
- Create: `src/lib/progress.test.ts`

- [ ] **Step 1: pure 함수 spec 정의 (failing test)**

`src/lib/progress.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { pickNextStep, progressRowsToMap, STEP_ORDER } from "./progress";
import type { LearningStep } from "@prisma/client";

describe("STEP_ORDER", () => {
  it("lists 6 steps in canonical order", () => {
    expect(STEP_ORDER).toEqual([
      "reading", "listening", "expressions", "quiz", "interview", "speaking",
    ]);
  });
});

describe("progressRowsToMap", () => {
  it("returns map with all 6 steps, missing rows default to false", () => {
    const map = progressRowsToMap([
      { step: "reading", completed: true, skipped: false },
      { step: "listening", completed: false, skipped: true },
    ]);
    expect(map.reading).toEqual({ completed: true, skipped: false });
    expect(map.listening).toEqual({ completed: false, skipped: true });
    expect(map.expressions).toEqual({ completed: false, skipped: false });
    expect(map.quiz).toEqual({ completed: false, skipped: false });
    expect(map.interview).toEqual({ completed: false, skipped: false });
    expect(map.speaking).toEqual({ completed: false, skipped: false });
  });
});

describe("pickNextStep", () => {
  function map(done: LearningStep[]): ReturnType<typeof progressRowsToMap> {
    return progressRowsToMap(
      done.map((s) => ({ step: s, completed: true, skipped: false })),
    );
  }

  it("returns reading when nothing is done", () => {
    expect(pickNextStep(map([]))).toBe("reading");
  });

  it("returns the first incomplete step in order", () => {
    expect(pickNextStep(map(["reading"]))).toBe("listening");
    expect(pickNextStep(map(["reading", "listening", "expressions"]))).toBe("quiz");
  });

  it("treats skipped as done", () => {
    const m = progressRowsToMap([
      { step: "reading", completed: false, skipped: true },
      { step: "listening", completed: true, skipped: false },
    ]);
    expect(pickNextStep(m)).toBe("expressions");
  });

  it("returns 'complete' when all 6 are done", () => {
    expect(
      pickNextStep(
        map(["reading", "listening", "expressions", "quiz", "interview", "speaking"]),
      ),
    ).toBe("complete");
  });

  it("ignores out-of-order completions and finds the earliest gap", () => {
    expect(pickNextStep(map(["reading", "expressions"]))).toBe("listening");
  });
});
```

- [ ] **Step 2: 실행해서 fail 확인**

```bash
pnpm vitest run src/lib/progress.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: pure 함수 구현 + 타입 정의**

`src/lib/progress.ts`:
```ts
import type { LearningStep, ContentLevel } from "@prisma/client";
import { prisma } from "./prisma";

export const STEP_ORDER: readonly LearningStep[] = [
  "reading",
  "listening",
  "expressions",
  "quiz",
  "interview",
  "speaking",
] as const;

export type StepState = { completed: boolean; skipped: boolean };
export type ProgressMap = Record<LearningStep, StepState>;

interface ProgressRow {
  step: LearningStep;
  completed: boolean;
  skipped: boolean;
}

const EMPTY_STATE: StepState = { completed: false, skipped: false };

export function progressRowsToMap(rows: ProgressRow[]): ProgressMap {
  const map = Object.fromEntries(
    STEP_ORDER.map((s) => [s, { ...EMPTY_STATE }]),
  ) as ProgressMap;
  for (const row of rows) {
    map[row.step] = { completed: row.completed, skipped: row.skipped };
  }
  return map;
}

export function pickNextStep(map: ProgressMap): LearningStep | "complete" {
  for (const step of STEP_ORDER) {
    const s = map[step];
    if (!s.completed && !s.skipped) return step;
  }
  return "complete";
}

export function isStepDone(state: StepState): boolean {
  return state.completed || state.skipped;
}

// ───────────── Prisma-backed helpers ─────────────

export async function progressMapForLevel(
  userId: string,
  contentId: number,
  level: ContentLevel,
): Promise<ProgressMap> {
  const rows = await prisma.userProgress.findMany({
    where: { userId, contentId, level },
    select: { step: true, completed: true, skipped: true },
  });
  return progressRowsToMap(rows);
}

export async function nextStepForLevel(
  userId: string,
  contentId: number,
  level: ContentLevel,
): Promise<LearningStep | "complete"> {
  const map = await progressMapForLevel(userId, contentId, level);
  return pickNextStep(map);
}

export interface LevelSummary {
  nextStep: LearningStep | "complete";
  completedCount: number;
}

export async function progressSummaryByLevel(
  userId: string,
  contentId: number,
): Promise<Record<ContentLevel, LevelSummary>> {
  const rows = await prisma.userProgress.findMany({
    where: { userId, contentId },
    select: { level: true, step: true, completed: true, skipped: true },
  });
  const byLevel: Record<ContentLevel, ProgressRow[]> = {
    beginner: [],
    intermediate: [],
    advanced: [],
  };
  for (const r of rows) {
    byLevel[r.level].push(r);
  }
  const result = {} as Record<ContentLevel, LevelSummary>;
  for (const lvl of Object.keys(byLevel) as ContentLevel[]) {
    const map = progressRowsToMap(byLevel[lvl]);
    result[lvl] = {
      nextStep: pickNextStep(map),
      completedCount: STEP_ORDER.filter((s) => isStepDone(map[s])).length,
    };
  }
  return result;
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
pnpm vitest run src/lib/progress.test.ts
```

Expected: PASS — 3 describe / 8 it 모두 통과.

- [ ] **Step 5: Commit**

```bash
git add src/lib/progress.ts src/lib/progress.test.ts
git commit -m "$(cat <<'EOF'
feat(lib): add per-level progress helpers and pure step picker

pickNextStep + progressRowsToMap are pure (and tested) so they can be
reused in API code, layout, and tabs. progressMapForLevel /
nextStepForLevel / progressSummaryByLevel wrap them with the per-level
queries needed by the new top bar.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: `GET /api/progress/[contentId]` — level filter + requireUser

**Files:**
- Modify: `src/app/api/progress/[contentId]/route.ts` (GET 핸들러만)

- [ ] **Step 1: GET 핸들러를 level 필터 + requireUser 로 교체**

기존 GET (route.ts 의 첫 export):
```ts
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ contentId: string }> }
) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const { contentId } = await params;

  const progress = await prisma.userProgress.findMany({
    where: {
      userId: session!.user.id,
      contentId: parseInt(contentId),
    },
  });

  return NextResponse.json(progress);
}
```

변경 후:
```ts
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ contentId: string }> }
) {
  const { userId } = await requireUser();
  const { contentId } = await params;
  const cId = parseInt(contentId, 10);

  const url = new URL(req.url);
  const level = parseLevel(url.searchParams.get("level"));
  if (!level) {
    return NextResponse.json(
      { error: "Missing or invalid `level` query param" },
      { status: 400 },
    );
  }

  const progressMap = await progressMapForLevel(userId, cId, level);
  return NextResponse.json(progressMap);
}
```

같은 파일 상단 import 도 추가/조정:
- Remove: `import { requireAuth }` (POST 도 다음 task 에서 교체됨; remove 는 Task 5 에서 함께)
- Add: `import { requireUser } from "@/lib/auth-helpers";`
- Add: `import { parseLevel } from "@/lib/level";`
- Add: `import { progressMapForLevel } from "@/lib/progress";`

- [ ] **Step 2: 빌드 + lint 확인**

```bash
pnpm build && pnpm lint
```

Expected: 통과. POST 핸들러는 아직 `requireAuth` 사용 중이라 import 가 살아있어야 함 (Task 5 에서 정리).

- [ ] **Step 3: 수동 smoke (선택, 익명 쿠키로)**

```bash
# 로컬 dev 서버 가동 중이라면:
curl -i "http://localhost:3000/api/progress/1?level=beginner" \
  -H "cookie: routines_anon_id=<anon_uuid>"
# Expected: 200 + JSON 객체 { reading: {completed: false, skipped: false}, ... }
curl -i "http://localhost:3000/api/progress/1?level=foo" \
  -H "cookie: routines_anon_id=<anon_uuid>"
# Expected: 400
```

dev 서버 안 띄울 거면 skip.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/progress/[contentId]/route.ts
git commit -m "$(cat <<'EOF'
refactor(api): GET /api/progress now filters by level + supports anon

Switches from requireAuth to requireUser so anon-cookie pilot users can
fetch progress. Returns the 6-step ProgressMap shape consumed by
ProgressBar instead of raw rows. Requires ?level= query param.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: `POST /api/progress/[contentId]` — level body, per-level done, streak dedup

**Files:**
- Modify: `src/app/api/progress/[contentId]/route.ts` (POST 핸들러)

- [ ] **Step 1: POST 핸들러 전체 교체**

```ts
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ contentId: string }> }
) {
  const { userId } = await requireUser();
  const { contentId } = await params;
  const cId = parseInt(contentId, 10);

  const body = await req.json() as {
    step?: LearningStep;
    level?: string;
    score?: number;
    skipped?: boolean;
  };
  const { step, score, skipped } = body;
  const level = parseLevel(body.level);

  if (!level) {
    return NextResponse.json(
      { error: "Missing or invalid `level` in body" },
      { status: 400 },
    );
  }
  if (!step || !STEP_ORDER.includes(step)) {
    return NextResponse.json({ error: "Invalid step" }, { status: 400 });
  }

  // Upsert progress (idempotent within a level)
  await prisma.userProgress.upsert({
    where: {
      userId_contentId_level_step: { userId, contentId: cId, level, step },
    },
    update: {},
    create: {
      userId,
      contentId: cId,
      level,
      step,
      completed: !skipped,
      skipped: skipped || false,
      score: score ?? null,
      completedAt: new Date(),
    },
  });

  // Per-level done check
  const map = await progressMapForLevel(userId, cId, level);
  const allDone = STEP_ORDER.every((s) => map[s].completed || map[s].skipped);

  if (!allDone) {
    return NextResponse.json({ success: true, allDone: false });
  }

  // First time this content is fully completed (any level) → bump streak.
  // Otherwise just confirm.
  await prisma.$transaction(async (tx) => {
    const existingComplete = await tx.analyticsEvent.findFirst({
      where: { userId, type: "complete", contentId: cId },
      select: { id: true },
    });
    if (existingComplete) return; // Streak already counted for this content

    // Re-verify per-level done inside transaction
    const verified = await tx.userProgress.findMany({
      where: { userId, contentId: cId, level },
      select: { step: true, completed: true, skipped: true },
    });
    const verifiedMap = progressRowsToMap(verified);
    const verifiedDone = STEP_ORDER.every(
      (s) => verifiedMap[s].completed || verifiedMap[s].skipped,
    );
    if (!verifiedDone) return;

    // Lock and update streak
    const streakRows = await tx.$queryRaw<Array<{
      id: number;
      user_id: string;
      current_streak: number;
      longest_streak: number;
      last_completed: Date | null;
    }>>`SELECT * FROM streaks WHERE user_id = ${userId} FOR UPDATE`;

    let streak = streakRows[0];
    if (!streak) {
      await tx.streak.create({
        data: { userId, currentStreak: 0, longestStreak: 0 },
      });
      const newRows = await tx.$queryRaw<typeof streakRows>`SELECT * FROM streaks WHERE user_id = ${userId} FOR UPDATE`;
      streak = newRows[0];
    }

    const today = todayKST();
    const yesterday = yesterdayKST();

    if (streak.last_completed && isSameDateKST(streak.last_completed, today)) {
      // Same-day double-bump guard (kept for safety; existingComplete check above
      // also catches this because complete event would already exist for today's content)
      return;
    }

    const newStreak =
      streak.last_completed && isSameDateKST(streak.last_completed, yesterday)
        ? streak.current_streak + 1
        : 1;

    await tx.streak.update({
      where: { userId },
      data: {
        currentStreak: newStreak,
        longestStreak: Math.max(newStreak, streak.longest_streak),
        lastCompleted: today,
      },
    });

    await tx.analyticsEvent.create({
      data: { userId, type: "complete", contentId: cId, metadata: { level } },
    });
  });

  return NextResponse.json({ success: true, allDone: true });
}
```

- [ ] **Step 2: 파일 상단 import 정리**

다음 import 문이 있는지 확인 (없으면 추가):
```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { todayKST, yesterdayKST, isSameDateKST } from "@/lib/date";
import { parseLevel } from "@/lib/level";
import { progressMapForLevel, progressRowsToMap, STEP_ORDER } from "@/lib/progress";
import type { LearningStep } from "@prisma/client";
```

`ALL_STEPS` 상수 (파일 상단) 는 삭제 (`STEP_ORDER` 사용). `requireAuth` import 제거.

- [ ] **Step 3: 빌드 + lint**

```bash
pnpm build && pnpm lint
```

Expected: 통과. (UserProgress 의 새 unique key `userId_contentId_level_step` 는 Task 1 에서 schema 변경했으므로 prisma client 가 알고 있어야 함.)

- [ ] **Step 4: AnalyticsEvent 모델에 metadata 필드 있는지 확인**

```bash
grep -A 10 "model AnalyticsEvent" prisma/schema.prisma
```

`metadata` 필드(JSON) 있으면 그대로 사용. 없으면 `{ userId, type: "complete", contentId: cId }` 만 기록 (level 정보 생략).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/progress/[contentId]/route.ts
git commit -m "$(cat <<'EOF'
refactor(api): POST /api/progress level-aware + dedupe streak per content

Per-level upsert lets each level track its own 6-step completion. When
all 6 of any level finish, streak bumps once per content (guarded by
checking analytics_events). Switches to requireUser so anon pilot users
can record progress.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: `<ProgressBar>` 컴포넌트

**Files:**
- Create: `src/components/learn/progress-bar.tsx`

- [ ] **Step 1: 파일 작성**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LearningStep, ContentLevel } from "@prisma/client";
import { STEP_ORDER, type ProgressMap, isStepDone } from "@/lib/progress";

const STEP_LABELS: Record<LearningStep, string> = {
  reading: "읽기",
  listening: "듣기",
  expressions: "표현",
  quiz: "퀴즈",
  interview: "인터뷰",
  speaking: "말하기",
};

interface Props {
  contentId: number;
  level: ContentLevel;
  progress: ProgressMap;
}

function getCurrentStep(pathname: string): LearningStep | "complete" | null {
  // /learn/[id]/{step}
  const segments = pathname.split("/").filter(Boolean);
  const idx = segments.findIndex((s) => s === "learn");
  const step = segments[idx + 2];
  if (step === "complete") return "complete";
  return (STEP_ORDER as readonly string[]).includes(step) ? (step as LearningStep) : null;
}

export function ProgressBar({ contentId, level, progress }: Props) {
  const pathname = usePathname();
  const currentStep = getCurrentStep(pathname);

  return (
    <div aria-label="학습 진행 상태">
      <ol className="grid grid-cols-6 gap-1.5">
        {STEP_ORDER.map((step) => {
          const state = progress[step];
          const done = isStepDone(state);
          const isCurrent = currentStep === step;
          const tone =
            isCurrent
              ? "bg-brand-primary"
              : done
              ? "bg-emerald-500"
              : "bg-bg-subtle";
          const cell = (
            <span
              className={`block h-2 rounded-full transition-colors ${tone}`}
              aria-hidden="true"
            />
          );
          const labelTone =
            isCurrent
              ? "text-brand-primary font-semibold"
              : done
              ? "text-emerald-600"
              : "text-text-tertiary";
          const wrap = (
            <li className="flex flex-col gap-1.5 min-w-0">
              {cell}
              <span className={`text-[11px] text-center truncate ${labelTone}`}>
                {STEP_LABELS[step]}
              </span>
            </li>
          );
          if (done && !isCurrent) {
            return (
              <Link
                key={step}
                href={`/learn/${contentId}/${step}?level=${level}`}
                className="block"
                aria-label={`${STEP_LABELS[step]} 단계 복습`}
              >
                {wrap}
              </Link>
            );
          }
          return <div key={step}>{wrap}</div>;
        })}
      </ol>
    </div>
  );
}
```

- [ ] **Step 2: 빌드 통과 확인**

```bash
pnpm build
```

Expected: 통과. 사용처는 아직 없으므로 unused 경고 가능 (Task 9 에서 wire).

- [ ] **Step 3: Commit**

```bash
git add src/components/learn/progress-bar.tsx
git commit -m "$(cat <<'EOF'
feat(learn): ProgressBar — 6-cell segmented bar with per-step labels

Completed steps render as Link for revision; current cell is indigo;
future cells are inert grey. Pure presentational — reads current step
from usePathname so layout doesn't have to thread it.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: `<LevelTabs>` 컴포넌트

**Files:**
- Create: `src/components/learn/level-tabs.tsx`

- [ ] **Step 1: 파일 작성**

```tsx
"use client";

import { useRouter } from "next/navigation";
import type { ContentLevel } from "@prisma/client";
import { LEVELS, LEVEL_LABELS } from "@/lib/level";
import type { LevelSummary } from "@/lib/progress";

interface Props {
  contentId: number;
  currentLevel: ContentLevel;
  progressByLevel: Record<ContentLevel, LevelSummary>;
}

export function LevelTabs({ contentId, currentLevel, progressByLevel }: Props) {
  const router = useRouter();

  function jumpTo(target: ContentLevel) {
    if (target === currentLevel) return;
    const next = progressByLevel[target].nextStep;
    const segment = next === "complete" ? "complete" : next;
    router.push(`/learn/${contentId}/${segment}?level=${target}`);
  }

  return (
    <div role="tablist" aria-label="레벨 선택" className="flex gap-2">
      {LEVELS.map((lv) => {
        const active = lv === currentLevel;
        return (
          <button
            key={lv}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => jumpTo(lv)}
            className={
              "px-4 py-2 rounded-full text-[14px] font-medium transition-colors " +
              (active
                ? "bg-brand-primary text-text-inverse"
                : "bg-surface text-text-secondary border border-border-default hover:border-brand-primary")
            }
          >
            {LEVEL_LABELS[lv]}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: 빌드 확인**

```bash
pnpm build
```

Expected: 통과.

- [ ] **Step 3: Commit**

```bash
git add src/components/learn/level-tabs.tsx
git commit -m "$(cat <<'EOF'
feat(learn): LevelTabs — pill tabs that jump to each level's progress

Clicking a tab routes to the next-incomplete step at that level (or
/complete if all done), matching the spec policy: switching levels
respects per-level progress instead of preserving the current step.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: `<LearnTopBar>` 컨테이너

**Files:**
- Create: `src/components/learn/learn-top-bar.tsx`

- [ ] **Step 1: 파일 작성**

```tsx
import type { ContentLevel } from "@prisma/client";
import type { ProgressMap, LevelSummary } from "@/lib/progress";
import { LevelTabs } from "./level-tabs";
import { ProgressBar } from "./progress-bar";

interface Props {
  contentId: number;
  currentLevel: ContentLevel;
  progress: ProgressMap;
  progressByLevel: Record<ContentLevel, LevelSummary>;
}

export function LearnTopBar({
  contentId,
  currentLevel,
  progress,
  progressByLevel,
}: Props) {
  return (
    <div className="sticky top-16 z-10 bg-bg-page/95 backdrop-blur-sm border-b border-border-default">
      <div className="max-w-[900px] mx-auto px-6 py-4 flex flex-col gap-4">
        <LevelTabs
          contentId={contentId}
          currentLevel={currentLevel}
          progressByLevel={progressByLevel}
        />
        <ProgressBar
          contentId={contentId}
          level={currentLevel}
          progress={progress}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 빌드 확인**

```bash
pnpm build
```

Expected: 통과.

- [ ] **Step 3: Commit**

```bash
git add src/components/learn/learn-top-bar.tsx
git commit -m "$(cat <<'EOF'
feat(learn): LearnTopBar wraps tabs + progress for the learn layout

Server-friendly container (no client directive, props drilled from the
server layout). Sticky just below the global Nav so tabs stay reachable
while scrolling long readings.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: `learn/[contentId]/layout.tsx` 를 server component 로 + LearnTopBar wire

**Files:**
- Modify: `src/app/(main)/learn/[contentId]/layout.tsx`

- [ ] **Step 1: 파일 전체 교체**

```tsx
import { SpeechProvider } from "@/contexts/speech-context";
import { requireUser } from "@/lib/auth-helpers";
import { parseLevel } from "@/lib/level";
import {
  progressMapForLevel,
  progressSummaryByLevel,
} from "@/lib/progress";
import { LearnTopBar } from "@/components/learn/learn-top-bar";

export default async function LearnLayout({
  children,
  params,
  searchParams,
}: {
  children: React.ReactNode;
  params: Promise<{ contentId: string }>;
  searchParams: Promise<{ level?: string }>;
}) {
  const { contentId } = await params;
  const sp = await searchParams;
  const level = parseLevel(sp.level) ?? "beginner";
  const cId = parseInt(contentId, 10);

  const { userId } = await requireUser();
  const [progress, progressByLevel] = await Promise.all([
    progressMapForLevel(userId, cId, level),
    progressSummaryByLevel(userId, cId),
  ]);

  return (
    <SpeechProvider>
      <LearnTopBar
        contentId={cId}
        currentLevel={level}
        progress={progress}
        progressByLevel={progressByLevel}
      />
      <div className="max-w-[900px] mx-auto">{children}</div>
    </SpeechProvider>
  );
}
```

- [ ] **Step 2: 빌드 확인**

```bash
pnpm build
```

Expected: 통과. (이 시점에서 step 페이지들은 아직 useLevel 사용 중이지만 `(main)/layout.tsx` 의 `<LevelProvider>` 는 Task 19 까지 살아있어 런타임은 정상 동작. 단, level 이 URL 과 localStorage 에 두 개 source 로 공존하는 과도기 상태.)

- [ ] **Step 3: Commit**

```bash
git add src/app/\(main\)/learn/[contentId]/layout.tsx
git commit -m "$(cat <<'EOF'
feat(learn): server-render LearnTopBar in the learn layout

Layout becomes async, parses ?level= once and prefetches both the
current-level progress map and the 3-level summary so the tabs and
progress bar render with no client round-trip. Step pages will switch
off useLevel in the next tasks.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Reading 페이지 — useSearchParams + Link query + progress POST

**Files:**
- Modify: `src/app/(main)/learn/[contentId]/reading/page.tsx`

- [ ] **Step 1: 파일 전체 교체**

```tsx
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ReadingView } from "@/components/learning/reading-view";
import { Button } from "@/components/ui/button";
import { parseLevel } from "@/lib/level";

interface Content {
  id: number;
  title: string;
  paragraphs: string[];
  keyPhrase: string;
  keyKo: string;
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

      <ReadingView paragraphs={content.paragraphs} keyPhrase={content.keyPhrase} />

      <div className="mt-6 bg-surface border border-border-default rounded-lg p-4">
        <p className="text-body">
          <span className="text-text-brand-brown font-semibold">{content.keyPhrase}</span>
          <span className="text-text-secondary ml-3">{content.keyKo}</span>
        </p>
      </div>

      <div className="mt-10 flex justify-end">
        <Button onClick={handleComplete}>Next: Listening</Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 빌드 확인**

```bash
pnpm build
```

Expected: 통과 (LevelContext 사용 제거됨).

- [ ] **Step 3: Commit**

```bash
git add src/app/\(main\)/learn/[contentId]/reading/page.tsx
git commit -m "$(cat <<'EOF'
refactor(learn): reading page uses URL ?level= and posts progress

Removes useLevel coupling. POSTs to /api/progress with the current
level on Next so the new ProgressBar can render real completion state.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Step-page transformation recipe (Tasks 11~15 공통)

각 step 페이지에 적용할 7가지 변경:

1. import 변경:
   - 제거: `import { useLevel } from "@/contexts/level-context";`
   - 추가: `import { useSearchParams } from "next/navigation";`
   - 추가: `import { parseLevel } from "@/lib/level";`
2. 컴포넌트 함수 시작 부분에서 `const { level, ready } = useLevel();` 제거
3. 대신 다음 두 줄 추가:
   ```ts
   const searchParams = useSearchParams();
   const level = parseLevel(searchParams.get("level")) ?? "beginner";
   ```
4. `if (!ready || !level) return ...;` 같은 가드 블록이 있으면 제거
5. `useEffect` dependency 배열에서 `ready` 제거 (level 은 유지)
6. "Next" 버튼 핸들러를 async 로 만들고, push 직전에 progress POST:
   ```ts
   async function handleComplete() {
     await fetch(`/api/progress/${contentId}`, {
       method: "POST",
       headers: { "Content-Type": "application/json" },
       body: JSON.stringify({ step: "<this-step-name>", level /*, score */ }),
     }).catch(() => {});
     router.push(`/learn/${contentId}/<next-step>?level=${level}`);
   }
   ```
7. 다른 곳에서 `router.push("/learn/...")` 또는 `<Link href="/learn/...">` 가 있으면 모두 `?level=${level}` 또는 `?level=beginner` 보존하도록 수정

각 task 의 페이지별 값은 task 안에 명시.

---

### Task 11: Listening 페이지

**Files:**
- Modify: `src/app/(main)/learn/[contentId]/listening/page.tsx`

**페이지별 값:**
- POST step 명: `"listening"`
- POST 추가 필드: 없음
- Next URL: `/learn/${contentId}/expressions?level=${level}`

- [ ] **Step 1: 현재 파일 읽기**

```bash
cat 'src/app/(main)/learn/[contentId]/listening/page.tsx'
```

- [ ] **Step 2: 위 "Step-page transformation recipe" 의 7단계 적용**

step 명, next URL 은 위 페이지별 값 사용.

- [ ] **Step 3: 빌드 + lint 확인**

```bash
pnpm build && pnpm lint
```

Expected: 통과. listening 페이지에 `useLevel` import 가 더 이상 없음.

- [ ] **Step 4: Commit**

```bash
git add 'src/app/(main)/learn/[contentId]/listening/page.tsx'
git commit -m "refactor(learn): listening page uses URL ?level= and posts progress

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 12: Expressions 페이지

**Files:**
- Modify: `src/app/(main)/learn/[contentId]/expressions/page.tsx`

**페이지별 값:**
- POST step 명: `"expressions"`
- POST 추가 필드: 없음
- Next URL: `/learn/${contentId}/quiz?level=${level}`

- [ ] **Step 1: 현재 파일 읽기**

```bash
cat 'src/app/(main)/learn/[contentId]/expressions/page.tsx'
```

- [ ] **Step 2: "Step-page transformation recipe" 의 7단계 적용**

- [ ] **Step 3: 빌드 + lint 확인**

```bash
pnpm build && pnpm lint
```

- [ ] **Step 4: Commit**

```bash
git add 'src/app/(main)/learn/[contentId]/expressions/page.tsx'
git commit -m "refactor(learn): expressions page uses URL ?level= and posts progress

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 13: Quiz 페이지

**Files:**
- Modify: `src/app/(main)/learn/[contentId]/quiz/page.tsx`

**페이지별 값:**
- POST step 명: `"quiz"`
- POST 추가 필드: `score` (기존 quiz 점수 변수 그대로 — `body: JSON.stringify({ step: "quiz", level, score })`)
- Next URL: `/learn/${contentId}/interview?level=${level}`

- [ ] **Step 1: 현재 파일 읽고 quiz 점수 변수명 확인**

```bash
cat 'src/app/(main)/learn/[contentId]/quiz/page.tsx'
```

quiz 결과 점수가 어느 변수에 들어있는지 확인 후 POST body 에 포함.

- [ ] **Step 2: "Step-page transformation recipe" 의 7단계 적용 + score 추가**

- [ ] **Step 3: 빌드 + lint 확인**

```bash
pnpm build && pnpm lint
```

- [ ] **Step 4: Commit**

```bash
git add 'src/app/(main)/learn/[contentId]/quiz/page.tsx'
git commit -m "refactor(learn): quiz page uses URL ?level= and posts progress with score

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 14: Interview 페이지 + InterviewChat 컴포넌트

**Files:**
- Modify: `src/app/(main)/learn/[contentId]/interview/page.tsx`
- Modify: `src/components/learning/interview-chat.tsx`

**페이지별 값:**
- POST step 명: `"interview"`
- POST 추가 필드: 없음
- Next URL: `/learn/${contentId}/speaking?level=${level}`

- [ ] **Step 1: 페이지 파일 읽고 "Step-page transformation recipe" 의 7단계 적용**

```bash
cat 'src/app/(main)/learn/[contentId]/interview/page.tsx'
```

- [ ] **Step 2: `interview-chat.tsx` 변환**

```bash
cat src/components/learning/interview-chat.tsx
```

InterviewChat 안에 `useLevel()` 호출이 있으므로:
1. `import { useLevel } from "@/contexts/level-context";` 제거
2. `import type { ContentLevel } from "@prisma/client";` 추가 (또는 기존 import 합치기)
3. props 인터페이스에 `level: ContentLevel` 필드 추가
4. 내부의 `useLevel()` 사용처를 prop `level` 사용으로 변경
5. 호출하는 페이지(`interview/page.tsx`) 에서 `<InterviewChat ... level={level} />` 로 prop 전달

- [ ] **Step 3: 빌드 + lint 확인**

```bash
pnpm build && pnpm lint
```

- [ ] **Step 4: Commit**

```bash
git add 'src/app/(main)/learn/[contentId]/interview/page.tsx' src/components/learning/interview-chat.tsx
git commit -m "refactor(learn): interview page + chat use URL ?level= and post progress

InterviewChat now takes level as prop instead of reading LevelContext.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 15: Speaking 페이지 + RecordingStudio 컴포넌트

**Files:**
- Modify: `src/app/(main)/learn/[contentId]/speaking/page.tsx`
- Modify: `src/components/learning/recording-studio.tsx`

**페이지별 값:**
- POST step 명: `"speaking"`
- POST 추가 필드: 없음
- Next URL: `/learn/${contentId}/complete?level=${level}`

- [ ] **Step 1: 페이지 파일 읽고 "Step-page transformation recipe" 의 7단계 적용**

```bash
cat 'src/app/(main)/learn/[contentId]/speaking/page.tsx'
```

- [ ] **Step 2: `recording-studio.tsx` 변환**

```bash
cat src/components/learning/recording-studio.tsx
```

InterviewChat 와 동일한 방식 (Task 14 Step 2):
1. `import { useLevel } from "@/contexts/level-context";` 제거
2. `import type { ContentLevel } from "@prisma/client";` 추가
3. props 에 `level: ContentLevel` 추가
4. 내부 useLevel 사용처를 prop 사용으로 변경
5. 호출 페이지(`speaking/page.tsx`)에서 `<RecordingStudio ... level={level} />` 전달

- [ ] **Step 3: 빌드 + lint 확인**

```bash
pnpm build && pnpm lint
```

- [ ] **Step 4: Commit**

```bash
git add 'src/app/(main)/learn/[contentId]/speaking/page.tsx' src/components/learning/recording-studio.tsx
git commit -m "refactor(learn): speaking page + studio use URL ?level= and post progress

RecordingStudio now takes level as prop instead of reading LevelContext.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 16: Complete 페이지 — useSearchParams 로 전환

**Files:**
- Modify: `src/app/(main)/learn/[contentId]/complete/page.tsx`

- [ ] **Step 1: 현재 파일 읽기**

```bash
cat src/app/\(main\)/learn/[contentId]/complete/page.tsx
```

- [ ] **Step 2: useLevel → useSearchParams 변환**

POST 호출 없음 (이미 speaking 에서 마지막 step 으로 POST 됨). 단순히 level 표시/링크만.

```ts
// 추가
import { useSearchParams } from "next/navigation";
import { parseLevel } from "@/lib/level";

// useLevel 사용처 대체
const searchParams = useSearchParams();
const level = parseLevel(searchParams.get("level")) ?? "beginner";
```

`if (!ready || !level)` 가드 있으면 제거. 다른 페이지 링크 (예: 메인으로) 는 query 유지 안 해도 됨.

- [ ] **Step 3: 빌드 + lint**

```bash
pnpm build && pnpm lint
```

- [ ] **Step 4: Commit**

```bash
git add src/app/\(main\)/learn/[contentId]/complete/page.tsx
git commit -m "refactor(learn): complete page uses URL ?level= instead of context

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 17: 메인 페이지 (`/`) 가 학습 진입점이 됨

**Files:**
- Modify: `src/app/(main)/page.tsx`

- [ ] **Step 1: 파일 전체 교체 (server component, beginner 기본)**

```tsx
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { todayKST } from "@/lib/date";

const STEPS = [
  { key: "reading", label: "읽기" },
  { key: "listening", label: "듣기" },
  { key: "expressions", label: "표현" },
  { key: "quiz", label: "퀴즈" },
  { key: "interview", label: "AI 인터뷰" },
  { key: "speaking", label: "말하기" },
] as const;

export default async function Home() {
  const today = todayKST();
  const content = await prisma.content.findFirst({
    where: { publishedAt: today, isActive: true },
    orderBy: { priority: "desc" },
    select: {
      id: true,
      title: true,
      subtitle: true,
      genre: true,
      keyPhrase: true,
      keyKo: true,
    },
  });

  if (!content) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] px-6">
        <h1 className="text-hero text-text-primary text-center">Routines</h1>
        <p className="mt-6 text-body text-text-secondary text-center max-w-[600px]">
          오늘의 콘텐츠가 아직 없습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-[900px] mx-auto px-6 py-12">
      <h1 className="text-hero text-text-primary text-center">Routines</h1>
      <p className="mt-4 text-body text-text-secondary text-center">
        매일 하나의 영어 콘텐츠로 학습 루틴을 만드세요
      </p>

      <div className="mt-12 bg-surface border border-border-default rounded-lg p-8">
        <span className="text-caption font-semibold text-brand-primary tracking-[2px] uppercase">
          {content.genre}
        </span>
        <h2 className="text-display font-bold mt-2 mb-3">{content.title}</h2>
        {content.subtitle && (
          <p className="text-body text-text-secondary">{content.subtitle}</p>
        )}
        <p className="mt-4 text-body">
          <span className="text-brand-primary font-medium">{content.keyPhrase}</span>
          <span className="text-text-secondary ml-2">{content.keyKo}</span>
        </p>
      </div>

      <Link
        href={`/learn/${content.id}/reading`}
        className="mt-6 block bg-brand-primary rounded-lg px-6 py-5 text-center text-text-inverse text-body font-semibold hover:bg-brand-primary-hover active:bg-brand-primary-active transition-colors"
      >
        시작하기
      </Link>

      <ol className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2 text-caption text-text-secondary justify-center">
        {STEPS.map((step, i) => (
          <li key={step.key} className="flex items-center gap-3">
            <span className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-bg-subtle text-caption text-text-tertiary">
                {i + 1}
              </span>
              <span>{step.label}</span>
            </span>
            {i < STEPS.length - 1 && (
              <span className="text-text-tertiary" aria-hidden="true">→</span>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
```

- [ ] **Step 2: 빌드 + lint**

```bash
pnpm build && pnpm lint
```

- [ ] **Step 3: Commit**

```bash
git add src/app/\(main\)/page.tsx
git commit -m "$(cat <<'EOF'
feat(home): consolidate landing — hero + content card + step preview

Replaces the prior split between / (hero) and /today (step list +
시작하기). Single click from / to /learn/[id]/reading at default
beginner level. Per spec: no in-page level selector here.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 18: `/today` 페이지를 `/` 로 redirect

**Files:**
- Modify: `src/app/(main)/today/page.tsx`

- [ ] **Step 1: 파일 전체 교체**

```tsx
import { redirect } from "next/navigation";

export default function TodayRedirect(): never {
  redirect("/");
}
```

- [ ] **Step 2: 빌드 + lint**

```bash
pnpm build && pnpm lint
```

- [ ] **Step 3: Commit**

```bash
git add src/app/\(main\)/today/page.tsx
git commit -m "$(cat <<'EOF'
refactor(today): redirect /today to / (consolidated landing)

Old bookmarks land on the new unified entry page.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 19: `(main)/layout.tsx` + `nav.tsx` 정리

**Files:**
- Modify: `src/app/(main)/layout.tsx`
- Modify: `src/components/nav.tsx`

- [ ] **Step 1: `(main)/layout.tsx` 에서 LevelProvider/LevelGate 제거**

변경 후:
```tsx
import { Nav } from "@/components/nav";
import { SplashIntro } from "@/components/splash-intro";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <SplashIntro />
      <Nav />
      <main className="pt-16 min-h-screen">
        <div className="max-w-[1200px] mx-auto">{children}</div>
      </main>
    </>
  );
}
```

- [ ] **Step 2: `nav.tsx` 에서 LevelToggle 임포트/렌더 제거**

```bash
grep -n "LevelToggle\|level-toggle" src/components/nav.tsx
```

해당 라인들 제거 (import 1줄 + JSX 1~2 곳).

- [ ] **Step 3: 빌드 + lint + 모든 테스트 실행**

```bash
pnpm build && pnpm lint && pnpm test
```

Expected: 모두 통과. 이 시점에서 `useLevel`/LevelProvider 참조가 코드 어디에도 없어야 함.

- [ ] **Step 4: useLevel/LevelContext/LevelProvider 잔재 grep 으로 확인**

```bash
grep -rn "useLevel\|LevelProvider\|LevelGate\|LevelToggle\|level-context\|level-gate\|level-toggle\|LEVEL_STORAGE_KEY" src/ --include="*.ts" --include="*.tsx"
```

Expected: 매치 0 (단, 다음 task 에서 삭제될 파일 자체의 정의는 제외).

매치가 남아있으면 그 파일에서 같은 정리 적용.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(main\)/layout.tsx src/components/nav.tsx
git commit -m "$(cat <<'EOF'
chore(layout): drop LevelProvider/LevelGate/LevelToggle from chrome

All consumers now read level from URL searchParams; the modal/dropdown
chrome is no longer wired anywhere. Files themselves removed in next
commit.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 20: Dead code 삭제

**Files:**
- Delete: `src/components/level-gate.tsx`
- Delete: `src/components/level-toggle.tsx`
- Delete: `src/contexts/level-context.tsx`

- [ ] **Step 1: 다시 한 번 grep — 삭제 안전성 확인**

```bash
grep -rn "level-gate\|level-toggle\|level-context\|LevelGate\|LevelToggle\|LevelProvider\|useLevel" src/ --include="*.ts" --include="*.tsx" \
  | grep -v "src/components/level-gate.tsx\|src/components/level-toggle.tsx\|src/contexts/level-context.tsx"
```

Expected: 0 매치 (정의 파일 자체만 빼고 사용처 없음).

- [ ] **Step 2: 파일 삭제**

```bash
rm src/components/level-gate.tsx
rm src/components/level-toggle.tsx
rm src/contexts/level-context.tsx
```

- [ ] **Step 3: 빌드 + lint + 테스트**

```bash
pnpm build && pnpm lint && pnpm test
```

Expected: 모두 통과.

- [ ] **Step 4: Commit**

```bash
git add -u src/components/level-gate.tsx src/components/level-toggle.tsx src/contexts/level-context.tsx
git commit -m "$(cat <<'EOF'
chore: delete LevelGate, LevelToggle, LevelContext (no consumers)

Replaced by URL-driven LevelTabs in the learn layout.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 21: 통합 검증 — 빌드/테스트/수동 E2E

**Files:** 없음 (검증)

- [ ] **Step 1: 풀 빌드 + 린트 + 테스트**

```bash
cd /var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines
pnpm build && pnpm lint && pnpm test
```

Expected: 전부 통과. 어느 하나라도 실패하면 fix 후 재실행.

- [ ] **Step 2: dev 서버 가동**

```bash
pnpm dev
```

(별도 터미널 또는 PM2 로컬). `http://localhost:3000`.

- [ ] **Step 3: 수동 스모크 체크리스트**

각 항목 확인 후 체크. 실패 항목은 issue/note 후 수정.

- [ ] 메인 페이지(`/`) 진입 — hero + 오늘 콘텐츠 카드 + 6단계 미리보기 + 시작하기 버튼 한 화면에 보임
- [ ] LevelGate 모달 안 뜸 / Nav 에 LevelToggle 드롭다운 사라짐
- [ ] 시작하기 클릭 → `/learn/[id]/reading` 진입, 초급 콘텐츠 자동 로딩
- [ ] 상단 탭: 초급 active (인디고 fill), 중급/고급 inactive (회색 outline)
- [ ] 프로그레스 바 6칸: 첫 칸 인디고(현재), 나머지 5칸 회색
- [ ] reading 의 Next 버튼 클릭 → URL `?level=beginner` 유지된 채 `/listening` 진입, 첫 칸 녹색(완료) + 두 번째 칸 인디고
- [ ] expressions 진행 중 → 프로그레스 바의 reading 칸 클릭 → reading 페이지로 (복습 동작)
- [ ] expressions 진행 중 → 프로그레스 바의 quiz/interview/speaking 칸 클릭 → 무반응 (Link 아님)
- [ ] 중급 탭 클릭 → URL `?level=intermediate` 로 reading 페이지 (중급 진행 0)
- [ ] 중급에서 reading 완료 → 초급 탭 클릭 → 초급 expressions (초급 진행 위치) 로 점프
- [ ] 한 레벨로 6 step 완료 → /complete 페이지 + DB 의 `streaks.current_streak` +1 + `analytics_events` 에 `complete` row 1개
- [ ] 같은 글을 다른 레벨로도 6/6 → streak 추가 증가 ❌ (DB 직접 확인)
- [ ] `/today` 직접 접속 → `/` 로 redirect
- [ ] `/archive` → 항목 클릭 → 그 글의 `/learn/[id]/reading` (default 초급)
- [ ] 잘못된 `?level=foo` URL → 초급 콘텐츠로 fallback (에러 X)
- [ ] 모바일 가로 폭 (DevTools 375px) — 상단 바 가독성 OK, 라벨 잘림 적정 수준

- [ ] **Step 4: DB 검증 쿼리**

```bash
source ../../.db_credentials
mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -e "
SELECT level, step, completed FROM user_progress
  WHERE user_id = '<test_anon_uuid>'
  ORDER BY content_id, level, step;
"
```

레벨별 row 가 분리되어 들어왔는지 확인.

- [ ] **Step 5: 결과 정리**

체크리스트 결과를 사용자에게 요약 보고. 실패 항목 있으면 fix 후 재검증.

검증 완료되면 push 가능 단계. **단, `git push` 는 사용자 명시 요청 후에만**.

---

## 자체 검증 (Self-review checklist)

이 plan 작성 직후 fresh eye 로 spec 과 대조:

- [x] 스펙 §1 (페이지 구조) → Task 17, 18, 19
- [x] 스펙 §2 (UserProgress level + migration) → Task 1
- [x] 스펙 §2 (progress.ts 헬퍼) → Task 3
- [x] 스펙 §2 (POST/GET /api/progress 변경) → Task 4, 5
- [x] 스펙 §2 (Streak 정책) → Task 5 의 `existingComplete` 분기
- [x] 스펙 §3 (LearnTopBar/LevelTabs/ProgressBar) → Task 6, 7, 8
- [x] 스펙 §3 (learn layout server component) → Task 9
- [x] 스펙 §3 (각 step 페이지 useLevel → useSearchParams) → Task 10~16
- [x] 스펙 §3 (메인 페이지 흡수) → Task 17
- [x] 스펙 §3 (today redirect) → Task 18
- [x] 스펙 §3 (LevelGate/Toggle/Context 제거) → Task 19, 20
- [x] 스펙 §4 (엣지 케이스 1: 잘못된 level) → Task 5 의 parseLevel 분기 + Task 9, 10 의 fallback
- [x] 스펙 §4 (엣지 케이스 2/3: 점프 동작) → Task 7 의 LevelTabs.jumpTo
- [x] 스펙 §4 (엣지 케이스 4: URL 직접 미래 step 진입) → 본 plan 막지 않음 (스펙 정책)
- [x] 스펙 §4 (엣지 케이스 5: streak 중복 방지) → Task 5
- [x] 스펙 §4 (엣지 케이스 8: /today 보호) → Task 18
- [x] 스펙 §4 (엣지 케이스 9: 모바일) → Task 21 의 수동 체크
- [x] 스펙 §5 (자동 테스트: pure 함수) → Task 2, 3
- [x] 스펙 §5 (수동 E2E) → Task 21

**Type/이름 일관성**:
- `pickNextStep`, `progressRowsToMap`, `progressMapForLevel`, `nextStepForLevel`, `progressSummaryByLevel`, `STEP_ORDER`, `ProgressMap`, `LevelSummary` — Task 3 정의, Task 5/7/9/10~16 사용. 일관됨.
- `parseLevel` (반환 `Level | null`) — Task 2 정의, Task 4/5/9/10~16 사용. 일관됨.

**Placeholder scan**: 모든 task 가 구체적 코드/명령/예상 결과 포함. "TBD"/"비슷하게" 등 없음.

**스코프**: 21 task, 한 plan 안에 들어갈 적정 규모. 단계별 commit 으로 회귀 시 bisect 가능.

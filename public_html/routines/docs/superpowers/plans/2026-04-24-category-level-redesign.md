# Category & Level Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retarget routines.soritune.com for Korean 40s–50s by replacing free-form genres with 5 Korean lifestyle categories, recalibrating difficulty levels to Korean-reader standards, adopting a magazine-column tone, and rebuilding the 6 existing test articles under the new rules.

**Architecture:** `genre` column stays (value domain shifts to 5 Korean strings). Two new tables: `topic_pool` (subtopic inventory, idempotent via `(category, subtopic_ko)` unique key) and `category_rotation_state` (singleton row tracking last category). Daily generation picks via `SELECT ... FOR UPDATE` inside one transaction so concurrent runs never collide. Prompt gains a magazine-column style block, new per-level sentence-length rules, and `ADVANCED_FORBIDDEN` term list enforced by a post-generation validator with retry.

**Tech Stack:** Next.js App Router, Prisma (MySQL), vitest (unit tests only), Tailwind v4, pnpm, TypeScript strict.

**Spec:** `docs/superpowers/specs/2026-04-24-category-level-redesign-design.md`

---

## File Structure

### New files
| Path | Responsibility |
|---|---|
| `prisma/migrations/<ts>_add_topic_pool_and_rotation/migration.sql` | DDL for two tables + unique index |
| `prisma/seed-topic-pool.ts` | 50-row idempotent upsert, called from `prisma/seed.ts` |
| `src/lib/categories.ts` | Single source of truth: ordered `CATEGORIES` + `isCategory()` |
| `src/lib/categories.test.ts` | Unit tests |
| `src/lib/level-validation.ts` | Word-count + forbidden-term checks with pass/soft-fail/hard-fail result |
| `src/lib/level-validation.test.ts` | Unit tests |
| `src/lib/topic-pool.ts` | `nextCategoryAfter()`, `pickAndClaimTopic()` (FOR UPDATE tx), `compensatePoolClaim()` |
| `src/lib/topic-pool.test.ts` | Unit tests for `nextCategoryAfter` |
| `src/app/api/admin/topic-pool/route.ts` | GET list, POST create |
| `src/app/api/admin/topic-pool/[id]/route.ts` | PATCH, DELETE |
| `src/app/(admin)/admin/topic-pool/page.tsx` | List + add-new page |
| `src/components/admin/topic-pool-table.tsx` | Table component |
| `src/components/admin/topic-pool-form.tsx` | Add/edit form component |
| `scripts/migrate-existing-articles.ts` | One-time date-based delete + regenerate trigger |

### Modified files
| Path | Change |
|---|---|
| `prisma/schema.prisma` | Add `TopicPool` + `CategoryRotationState` models |
| `prisma/seed.ts` | Call `seedTopicPool()` |
| `src/lib/generation-prompts.ts` | New `LEVEL_SPEC`, 5-category genre enum, magazine-column style block, `ADVANCED_FORBIDDEN` constant |
| `src/lib/content-generation.ts` | Call `pickAndClaimTopic()` when no upcoming override; integrate `validateLevelRules()` retry; compensate on failure |
| `src/components/admin/content-topic-fields.tsx` | `<select>` dropdown for genre |
| `src/components/admin/upcoming-topic-form.tsx` | `<select>` dropdown for genre |
| `src/components/admin/sidebar.tsx` | Add "주제 풀" link |

---

## Task 1: Prisma schema + migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260424100000_add_topic_pool_and_rotation/migration.sql`

- [ ] **Step 1.1: Add new Prisma models**

Append to `prisma/schema.prisma` (after the existing `ApiUsage` model; do NOT touch existing models):

```prisma
model TopicPool {
  id            Int       @id @default(autoincrement())
  category      String    @db.VarChar(20)
  subtopicKo    String    @map("subtopic_ko") @db.VarChar(255)
  keyPhraseEn   String    @map("key_phrase_en") @db.VarChar(255)
  keyKo         String    @map("key_ko") @db.VarChar(255)
  lastUsedAt    DateTime? @map("last_used_at") @db.Date
  useCount      Int       @default(0) @map("use_count")
  isActive      Boolean   @default(true) @map("is_active")
  notes         String?   @db.Text
  createdAt     DateTime  @default(now()) @map("created_at")
  updatedAt     DateTime  @updatedAt @map("updated_at")

  @@unique([category, subtopicKo], name: "uk_category_subtopic")
  @@index([category, lastUsedAt])
  @@map("topic_pool")
}

model CategoryRotationState {
  id           Int       @id
  lastCategory String?   @map("last_category") @db.VarChar(20)
  lastUsedAt   DateTime? @map("last_used_at") @db.Date
  updatedAt    DateTime  @updatedAt @map("updated_at")

  @@map("category_rotation_state")
}
```

- [ ] **Step 1.2: Generate the migration**

Run:
```bash
cd /var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines
pnpm prisma migrate dev --name add_topic_pool_and_rotation --create-only
```

Expected: a new directory `prisma/migrations/<timestamp>_add_topic_pool_and_rotation/` containing `migration.sql`. The timestamp will differ from `20260424100000` — that's fine. Do NOT apply yet.

- [ ] **Step 1.3: Verify the generated SQL**

Open the new `migration.sql`. It must contain:
- `CREATE TABLE` for `topic_pool` with a `UNIQUE INDEX` on `(category, subtopic_ko)` and an index on `(category, last_used_at)`.
- `CREATE TABLE` for `category_rotation_state`.

If the unique index is missing, regenerate after re-saving `schema.prisma`. Do NOT hand-edit the migration unless fixing Prisma omissions.

- [ ] **Step 1.4: Append singleton row insert**

Prisma does not seed data in migrations. Append this to the end of the generated `migration.sql`:

```sql
-- Seed the singleton rotation-state row.
INSERT INTO `category_rotation_state` (`id`, `last_category`, `last_used_at`) VALUES (1, NULL, NULL);
```

- [ ] **Step 1.5: Apply the migration**

Run:
```bash
pnpm prisma migrate dev
```

Expected output: `The migration has been applied successfully.` and `Generated Prisma Client`.

- [ ] **Step 1.6: Verify tables exist**

Run:
```bash
mysql --defaults-extra-file=<(printf "[client]\nuser=SORITUNECOM_ROUTINES\npassword=fj6eNiUqlCa7k/dh3ZU+a1Yg\n") -h localhost SORITUNECOM_ROUTINES -e "SHOW TABLES LIKE 'topic_pool'; SHOW TABLES LIKE 'category_rotation_state'; SELECT * FROM category_rotation_state;"
```

Expected: both tables listed; `category_rotation_state` has one row with `id=1, last_category=NULL, last_used_at=NULL`.

- [ ] **Step 1.7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(db): add topic_pool and category_rotation_state tables"
```

---

## Task 2: Categories constants module

**Files:**
- Create: `src/lib/categories.ts`
- Create: `src/lib/categories.test.ts`

- [ ] **Step 2.1: Write the failing tests**

Create `src/lib/categories.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { CATEGORIES, isCategory, type Category } from "./categories";

describe("categories module", () => {
  it("exports exactly 5 categories in rotation order", () => {
    expect(CATEGORIES).toEqual(["웰빙", "교육", "자기개발", "환경", "일상"]);
  });

  it("isCategory accepts all known categories", () => {
    for (const c of CATEGORIES) {
      expect(isCategory(c)).toBe(true);
    }
  });

  it("isCategory rejects unknown values", () => {
    expect(isCategory("Daily Life")).toBe(false);
    expect(isCategory("")).toBe(false);
    expect(isCategory(null)).toBe(false);
    expect(isCategory(undefined)).toBe(false);
    expect(isCategory(123)).toBe(false);
  });

  it("Category type is a narrowed union", () => {
    const c: Category = "웰빙";
    expect(CATEGORIES).toContain(c);
  });
});
```

- [ ] **Step 2.2: Run tests — expect failure**

```bash
pnpm test src/lib/categories.test.ts
```

Expected: FAIL — `Cannot find module './categories'`.

- [ ] **Step 2.3: Implement the module**

Create `src/lib/categories.ts`:

```ts
export const CATEGORIES = ["웰빙", "교육", "자기개발", "환경", "일상"] as const;
export type Category = (typeof CATEGORIES)[number];

export function isCategory(value: unknown): value is Category {
  return typeof value === "string" && (CATEGORIES as readonly string[]).includes(value);
}
```

- [ ] **Step 2.4: Run tests — expect pass**

```bash
pnpm test src/lib/categories.test.ts
```

Expected: all 4 tests pass.

- [ ] **Step 2.5: Commit**

```bash
git add src/lib/categories.ts src/lib/categories.test.ts
git commit -m "feat(lib): add 5-category constants + type guard"
```

---

## Task 3: Level validation module

**Files:**
- Create: `src/lib/level-validation.ts`
- Create: `src/lib/level-validation.test.ts`

- [ ] **Step 3.1: Write the failing tests**

Create `src/lib/level-validation.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { validateLevelRules, countWords, splitSentences } from "./level-validation";

describe("countWords", () => {
  it("counts space-separated tokens", () => {
    expect(countWords("I take a walk")).toBe(4);
  });
  it("ignores punctuation-only tokens", () => {
    expect(countWords("Hello, world!")).toBe(2);
  });
  it("returns 0 for empty/whitespace", () => {
    expect(countWords("")).toBe(0);
    expect(countWords("   ")).toBe(0);
  });
});

describe("splitSentences", () => {
  it("splits on terminal punctuation", () => {
    expect(splitSentences("First. Second! Third?")).toEqual(["First.", "Second!", "Third?"]);
  });
  it("keeps em-dash-joined clauses as one sentence", () => {
    const result = splitSentences("Simple idea — big impact.");
    expect(result).toEqual(["Simple idea — big impact."]);
  });
  it("ignores trailing whitespace", () => {
    expect(splitSentences("  A. B.  ")).toEqual(["A.", "B."]);
  });
});

describe("validateLevelRules", () => {
  it("passes a clean beginner paragraph", () => {
    const result = validateLevelRules(
      ["I take a walk every morning.", "The air is fresh.", "I feel good."],
      "beginner"
    );
    expect(result.ok).toBe(true);
    expect(result.hardFail).toBe(false);
  });

  it("hard-fails beginner when a sentence is far over tolerance", () => {
    // beginner tolerance max = 10. 13-word sentence is >2 over = hard fail.
    const result = validateLevelRules(
      [
        "I take a walk every morning because it is really very good for me.",
        "Short.",
        "Short.",
      ],
      "beginner"
    );
    expect(result.ok).toBe(false);
    expect(result.hardFail).toBe(true);
  });

  it("soft-fails (ok=true) when ≤30% of sentences are out of tolerance by ≤2 words", () => {
    // 4 sentences; 1 slightly over = 25% — acceptable with warning.
    const result = validateLevelRules(
      [
        "I walk every day.",
        "The air is fresh this morning and it wakes me up.", // 11 words = within tolerance 10
        "I feel good.",
        "It helps my mood.",
      ],
      "beginner"
    );
    expect(result.ok).toBe(true);
    expect(result.warnings.length).toBeGreaterThanOrEqual(0);
  });

  it("hard-fails when >30% of sentences violate tolerance", () => {
    const result = validateLevelRules(
      [
        "This is a long sentence that goes past the beginner tolerance limit.",
        "Another long sentence that is also past the beginner tolerance limit here.",
        "Third long sentence that also exceeds the beginner tolerance range plainly.",
        "Short one.",
      ],
      "beginner"
    );
    expect(result.ok).toBe(false);
    expect(result.hardFail).toBe(true);
  });

  it("hard-fails advanced when a forbidden term appears", () => {
    const result = validateLevelRules(
      [
        "The seismic shift in technology is changing everything around us completely.",
        "Every generation must adapt or fall behind in this fast-moving world.",
      ],
      "advanced"
    );
    expect(result.ok).toBe(false);
    expect(result.hardFail).toBe(true);
    expect(result.reasons.some((r) => r.includes("forbidden"))).toBe(true);
  });

  it("forbidden-term check is case-insensitive", () => {
    const result = validateLevelRules(
      ["Relentless pressure from work can wear anyone down over time."],
      "advanced"
    );
    expect(result.hardFail).toBe(true);
  });
});
```

- [ ] **Step 3.2: Run tests — expect failure**

```bash
pnpm test src/lib/level-validation.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3.3: Implement the module**

Create `src/lib/level-validation.ts`:

```ts
import type { Level } from "./generation-prompts";

interface Range {
  hardMin: number;
  hardMax: number;
  tolMin: number;
  tolMax: number;
}

const LEVEL_RANGES: Record<Level, Range> = {
  beginner: { hardMin: 5, hardMax: 9, tolMin: 5, tolMax: 10 },
  intermediate: { hardMin: 10, hardMax: 16, tolMin: 9, tolMax: 18 },
  advanced: { hardMin: 14, hardMax: 22, tolMin: 12, tolMax: 25 },
};

export const ADVANCED_FORBIDDEN = [
  "seismic",
  "relentless",
  "unprecedented",
  "landscape of",
  "in the wake of",
  "burgeoning",
  "ubiquitous",
  "paradigm",
  "quintessential",
  "ostensibly",
];

const SOFT_FAIL_RATIO = 0.3;
const HARD_OUTLIER_WORDS = 2;

export interface ValidationResult {
  ok: boolean;         // true if can be saved (hardFail never overrides this)
  hardFail: boolean;   // true if a retry should be triggered
  warnings: string[];  // non-blocking issues to log
  reasons: string[];   // human-readable fail reasons (for generation_logs)
}

export function countWords(text: string): number {
  const tokens = text.trim().split(/\s+/).filter((t) => /[A-Za-z0-9]/.test(t));
  return tokens.length;
}

export function splitSentences(paragraph: string): string[] {
  return paragraph
    .trim()
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function validateLevelRules(
  paragraphs: string[],
  level: Level
): ValidationResult {
  const range = LEVEL_RANGES[level];
  const result: ValidationResult = { ok: true, hardFail: false, warnings: [], reasons: [] };

  const allSentences = paragraphs.flatMap(splitSentences);
  if (allSentences.length === 0) {
    return { ok: false, hardFail: true, warnings: [], reasons: ["no sentences parsed"] };
  }

  let violations = 0;
  let anyFarOutlier = false;

  for (const sentence of allSentences) {
    const words = countWords(sentence);
    const inTolerance = words >= range.tolMin && words <= range.tolMax;
    if (!inTolerance) {
      violations++;
      const distance =
        words < range.tolMin ? range.tolMin - words : words - range.tolMax;
      if (distance > HARD_OUTLIER_WORDS) anyFarOutlier = true;
    }
  }

  const violationRatio = violations / allSentences.length;

  if (anyFarOutlier) {
    result.ok = false;
    result.hardFail = true;
    result.reasons.push(
      `sentence more than ${HARD_OUTLIER_WORDS} words outside tolerance (${range.tolMin}-${range.tolMax})`
    );
  } else if (violationRatio > SOFT_FAIL_RATIO) {
    result.ok = false;
    result.hardFail = true;
    result.reasons.push(
      `${violations}/${allSentences.length} sentences outside tolerance (>${Math.round(SOFT_FAIL_RATIO * 100)}%)`
    );
  } else if (violations > 0) {
    result.warnings.push(
      `${violations}/${allSentences.length} sentences outside ${range.hardMin}-${range.hardMax} range`
    );
  }

  if (level === "advanced") {
    const haystack = paragraphs.join(" ").toLowerCase();
    for (const term of ADVANCED_FORBIDDEN) {
      if (haystack.includes(term.toLowerCase())) {
        result.ok = false;
        result.hardFail = true;
        result.reasons.push(`forbidden advanced-register term: "${term}"`);
      }
    }
  }

  return result;
}
```

- [ ] **Step 3.4: Run tests — expect pass**

```bash
pnpm test src/lib/level-validation.test.ts
```

Expected: all tests pass. If a test fails, inspect — the fix should be in the module, NOT in the test (tests encode the spec).

- [ ] **Step 3.5: Commit**

```bash
git add src/lib/level-validation.ts src/lib/level-validation.test.ts
git commit -m "feat(lib): level-rule validator (word count + advanced forbidden terms)"
```

---

## Task 4: Topic-pool rotation-advance pure function

**Files:**
- Create: `src/lib/topic-pool.ts` (partial — only pure helpers in this task)
- Create: `src/lib/topic-pool.test.ts`

- [ ] **Step 4.1: Write the failing tests**

Create `src/lib/topic-pool.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { nextCategoryAfter } from "./topic-pool";

describe("nextCategoryAfter", () => {
  it("starts at 웰빙 when last is null", () => {
    expect(nextCategoryAfter(null)).toBe("웰빙");
  });

  it("wraps after 일상 back to 웰빙", () => {
    expect(nextCategoryAfter("일상")).toBe("웰빙");
  });

  it("advances through the full cycle", () => {
    expect(nextCategoryAfter("웰빙")).toBe("교육");
    expect(nextCategoryAfter("교육")).toBe("자기개발");
    expect(nextCategoryAfter("자기개발")).toBe("환경");
    expect(nextCategoryAfter("환경")).toBe("일상");
  });

  it("starts at 웰빙 for unknown inputs (defensive)", () => {
    expect(nextCategoryAfter("UnknownGenre")).toBe("웰빙");
  });
});
```

- [ ] **Step 4.2: Run tests — expect failure**

```bash
pnpm test src/lib/topic-pool.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 4.3: Implement `nextCategoryAfter` (pure function only; DB helpers come in Task 5)**

Create `src/lib/topic-pool.ts`:

```ts
import { CATEGORIES, type Category } from "./categories";

export function nextCategoryAfter(last: string | null): Category {
  if (last === null) return CATEGORIES[0];
  const idx = (CATEGORIES as readonly string[]).indexOf(last);
  if (idx === -1) return CATEGORIES[0];
  return CATEGORIES[(idx + 1) % CATEGORIES.length];
}
```

- [ ] **Step 4.4: Run tests — expect pass**

```bash
pnpm test src/lib/topic-pool.test.ts
```

Expected: all 5 tests pass.

- [ ] **Step 4.5: Commit**

```bash
git add src/lib/topic-pool.ts src/lib/topic-pool.test.ts
git commit -m "feat(lib): nextCategoryAfter for 5-day rotation"
```

---

## Task 5: Topic-pool atomic claim transaction

**Files:**
- Modify: `src/lib/topic-pool.ts`

No unit tests for this — it depends on MySQL `FOR UPDATE` semantics and cannot be meaningfully exercised without a real DB. Manual verification in Task 14.

- [ ] **Step 5.1: Append claim helpers**

Append to `src/lib/topic-pool.ts`:

```ts
import { prisma } from "./prisma";
import { CATEGORIES, type Category } from "./categories";

export class NoPoolTopicError extends Error {
  constructor(public category: Category) {
    super(`No eligible topic in pool for category "${category}"`);
    this.name = "NoPoolTopicError";
  }
}

export interface ClaimedTopic {
  poolId: number;
  category: Category;
  subtopicKo: string;
  keyPhraseEn: string;
  keyKo: string;
  // Snapshot of previous state so a caller can compensate on AI failure.
  previousPoolLastUsedAt: Date | null;
  previousPoolUseCount: number;
  previousRotationCategory: string | null;
  previousRotationLastUsedAt: Date | null;
}

interface PoolRow {
  id: number;
  category: string;
  subtopic_ko: string;
  key_phrase_en: string;
  key_ko: string;
  last_used_at: Date | null;
  use_count: number;
}

interface RotationRow {
  last_category: string | null;
  last_used_at: Date | null;
}

export async function pickAndClaimTopic(today: Date): Promise<ClaimedTopic> {
  return await prisma.$transaction(async (tx) => {
    const rotationRows = await tx.$queryRaw<RotationRow[]>`
      SELECT last_category, last_used_at
      FROM category_rotation_state
      WHERE id = 1
      FOR UPDATE
    `;
    if (rotationRows.length === 0) {
      throw new Error("category_rotation_state row id=1 missing");
    }
    const prevRotation = rotationRows[0];
    const nextCategory = nextCategoryAfter(prevRotation.last_category);

    const candidates = await tx.$queryRaw<PoolRow[]>`
      SELECT id, category, subtopic_ko, key_phrase_en, key_ko, last_used_at, use_count
      FROM topic_pool
      WHERE category = ${nextCategory} AND is_active = TRUE
      ORDER BY
        (last_used_at IS NULL) DESC,
        last_used_at ASC,
        use_count ASC,
        id ASC
      LIMIT 1
      FOR UPDATE
    `;
    if (candidates.length === 0) {
      throw new NoPoolTopicError(nextCategory);
    }
    const pick = candidates[0];

    await tx.topicPool.update({
      where: { id: pick.id },
      data: { lastUsedAt: today, useCount: { increment: 1 } },
    });

    await tx.categoryRotationState.update({
      where: { id: 1 },
      data: { lastCategory: nextCategory, lastUsedAt: today },
    });

    return {
      poolId: pick.id,
      category: nextCategory,
      subtopicKo: pick.subtopic_ko,
      keyPhraseEn: pick.key_phrase_en,
      keyKo: pick.key_ko,
      previousPoolLastUsedAt: pick.last_used_at,
      previousPoolUseCount: pick.use_count,
      previousRotationCategory: prevRotation.last_category,
      previousRotationLastUsedAt: prevRotation.last_used_at,
    };
  });
}

export async function compensatePoolClaim(claim: ClaimedTopic): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.topicPool.update({
      where: { id: claim.poolId },
      data: {
        lastUsedAt: claim.previousPoolLastUsedAt,
        useCount: claim.previousPoolUseCount,
      },
    });
    await tx.categoryRotationState.update({
      where: { id: 1 },
      data: {
        lastCategory: claim.previousRotationCategory,
        lastUsedAt: claim.previousRotationLastUsedAt,
      },
    });
  });
}
```

- [ ] **Step 5.2: Verify typecheck**

```bash
pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5.3: Commit**

```bash
git add src/lib/topic-pool.ts
git commit -m "feat(lib): atomic pool pick with FOR UPDATE + compensation helper"
```

---

## Task 6: Initial topic pool seed (idempotent)

**Files:**
- Create: `prisma/seed-topic-pool.ts`
- Modify: `prisma/seed.ts`

- [ ] **Step 6.1: Create the seed data file**

Create `prisma/seed-topic-pool.ts`:

```ts
import { PrismaClient } from "@prisma/client";

interface SeedRow {
  category: string;
  subtopicKo: string;
  keyPhraseEn: string;
  keyKo: string;
}

const SEED_ROWS: SeedRow[] = [
  // 웰빙
  { category: "웰빙", subtopicKo: "아침 산책 습관", keyPhraseEn: "take a walk", keyKo: "산책하다" },
  { category: "웰빙", subtopicKo: "깊은 숙면", keyPhraseEn: "get a good night's sleep", keyKo: "숙면을 취하다" },
  { category: "웰빙", subtopicKo: "스트레스 관리", keyPhraseEn: "keep stress in check", keyKo: "스트레스 관리" },
  { category: "웰빙", subtopicKo: "건강한 식단 유지", keyPhraseEn: "stick to a healthy diet", keyKo: "건강식 유지" },
  { category: "웰빙", subtopicKo: "갱년기 증상 다루기", keyPhraseEn: "deal with", keyKo: "잘 다루다" },
  { category: "웰빙", subtopicKo: "명상 루틴", keyPhraseEn: "clear your mind", keyKo: "머리를 비우다" },
  { category: "웰빙", subtopicKo: "혈압 관리", keyPhraseEn: "keep an eye on", keyKo: "주시하다" },
  { category: "웰빙", subtopicKo: "수분 섭취", keyPhraseEn: "stay hydrated", keyKo: "수분 유지" },
  { category: "웰빙", subtopicKo: "무리 없는 운동", keyPhraseEn: "work out", keyKo: "운동하다" },
  { category: "웰빙", subtopicKo: "체중 관리", keyPhraseEn: "keep the weight off", keyKo: "살이 찌지 않게 유지하다" },
  // 교육
  { category: "교육", subtopicKo: "자녀와 소통", keyPhraseEn: "open up to", keyKo: "마음을 열다" },
  { category: "교육", subtopicKo: "학습 동기 부여", keyPhraseEn: "be motivated", keyKo: "동기부여되다" },
  { category: "교육", subtopicKo: "진로 고민 함께하기", keyPhraseEn: "figure out", keyKo: "알아내다" },
  { category: "교육", subtopicKo: "대학 입시 스트레스", keyPhraseEn: "under pressure", keyKo: "압박을 받다" },
  { category: "교육", subtopicKo: "자녀 사춘기 이해", keyPhraseEn: "go through", keyKo: "겪다" },
  { category: "교육", subtopicKo: "잔소리 줄이기", keyPhraseEn: "back off", keyKo: "물러서다" },
  { category: "교육", subtopicKo: "독서 습관 들이기", keyPhraseEn: "make a habit of", keyKo: "습관이 되다" },
  { category: "교육", subtopicKo: "스마트폰 사용 규칙", keyPhraseEn: "set boundaries", keyKo: "한계를 정하다" },
  { category: "교육", subtopicKo: "자존감 키우기", keyPhraseEn: "believe in yourself", keyKo: "자신을 믿다" },
  { category: "교육", subtopicKo: "실패에서 배우기", keyPhraseEn: "learn from mistakes", keyKo: "실수에서 배우다" },
  // 자기개발
  { category: "자기개발", subtopicKo: "은퇴 준비", keyPhraseEn: "plan ahead", keyKo: "미리 계획하다" },
  { category: "자기개발", subtopicKo: "새로운 기술 배우기", keyPhraseEn: "pick up", keyKo: "익히다" },
  { category: "자기개발", subtopicKo: "재테크 기초", keyPhraseEn: "set aside", keyKo: "따로 떼어두다" },
  { category: "자기개발", subtopicKo: "평생 독서 습관", keyPhraseEn: "keep up with", keyKo: "뒤처지지 않다" },
  { category: "자기개발", subtopicKo: "시간 효율 관리", keyPhraseEn: "make the most of", keyKo: "최대한 활용하다" },
  { category: "자기개발", subtopicKo: "인생 2막 커리어", keyPhraseEn: "start over", keyKo: "다시 시작하다" },
  { category: "자기개발", subtopicKo: "부업 사이드잡", keyPhraseEn: "on the side", keyKo: "부업으로" },
  { category: "자기개발", subtopicKo: "네트워킹", keyPhraseEn: "stay in touch", keyKo: "연락을 유지하다" },
  { category: "자기개발", subtopicKo: "외국어 학습", keyPhraseEn: "get the hang of", keyKo: "감을 잡다" },
  { category: "자기개발", subtopicKo: "목표 설정", keyPhraseEn: "set your mind on", keyKo: "결심하다" },
  // 환경
  { category: "환경", subtopicKo: "플라스틱 줄이기", keyPhraseEn: "cut down on", keyKo: "줄이다" },
  { category: "환경", subtopicKo: "재활용 분리배출", keyPhraseEn: "sort out", keyKo: "분류하다" },
  { category: "환경", subtopicKo: "전기 절약", keyPhraseEn: "turn off", keyKo: "끄다" },
  { category: "환경", subtopicKo: "친환경 장보기", keyPhraseEn: "go green", keyKo: "친환경적이다" },
  { category: "환경", subtopicKo: "음식물 쓰레기 줄이기", keyPhraseEn: "throw away", keyKo: "버리다" },
  { category: "환경", subtopicKo: "중고 구매와 재사용", keyPhraseEn: "second-hand", keyKo: "중고의" },
  { category: "환경", subtopicKo: "대중교통 이용", keyPhraseEn: "get around", keyKo: "돌아다니다" },
  { category: "환경", subtopicKo: "에너지 효율 가전", keyPhraseEn: "save energy", keyKo: "에너지 절약" },
  { category: "환경", subtopicKo: "지속가능한 소비", keyPhraseEn: "think twice", keyKo: "재고하다" },
  { category: "환경", subtopicKo: "작은 실천의 힘", keyPhraseEn: "make a difference", keyKo: "차이를 만들다" },
  // 일상
  { category: "일상", subtopicKo: "가족 저녁 식사", keyPhraseEn: "sit down together", keyKo: "함께 앉다" },
  { category: "일상", subtopicKo: "이웃과 인사", keyPhraseEn: "wave hello", keyKo: "손 흔들어 인사" },
  { category: "일상", subtopicKo: "주말 집 정리", keyPhraseEn: "clean up", keyKo: "치우다" },
  { category: "일상", subtopicKo: "부모님 안부 전화", keyPhraseEn: "check in on", keyKo: "안부를 확인하다" },
  { category: "일상", subtopicKo: "동네 카페 발견", keyPhraseEn: "drop by", keyKo: "들르다" },
  { category: "일상", subtopicKo: "계절 반찬 만들기", keyPhraseEn: "put together", keyKo: "만들다" },
  { category: "일상", subtopicKo: "오래된 친구 만나기", keyPhraseEn: "catch up with", keyKo: "근황을 나누다" },
  { category: "일상", subtopicKo: "빨래 루틴", keyPhraseEn: "get done", keyKo: "끝내다" },
  { category: "일상", subtopicKo: "아침 커피 한잔", keyPhraseEn: "kick off", keyKo: "시작하다" },
  { category: "일상", subtopicKo: "잠자리 정리", keyPhraseEn: "make the bed", keyKo: "침대 정리하다" },
];

export async function seedTopicPool(prisma: PrismaClient): Promise<void> {
  for (const row of SEED_ROWS) {
    await prisma.topicPool.upsert({
      where: { uk_category_subtopic: { category: row.category, subtopicKo: row.subtopicKo } },
      create: {
        category: row.category,
        subtopicKo: row.subtopicKo,
        keyPhraseEn: row.keyPhraseEn,
        keyKo: row.keyKo,
        isActive: true,
        useCount: 0,
        lastUsedAt: null,
      },
      update: {
        keyPhraseEn: row.keyPhraseEn,
        keyKo: row.keyKo,
      },
    });
  }
  console.log(`Seeded/upserted ${SEED_ROWS.length} topic_pool rows`);
}
```

- [ ] **Step 6.2: Wire the new seeder into `prisma/seed.ts`**

Open `prisma/seed.ts`. At the top, add (below existing imports):

```ts
import { seedTopicPool } from "./seed-topic-pool";
```

In the existing `main()` (or equivalent bootstrap) function, add a call to `await seedTopicPool(prisma);` before the final `prisma.$disconnect()`.

If `prisma/seed.ts` does not exist or has a different shape, inspect it and adapt — the goal is that `pnpm prisma db seed` runs `seedTopicPool`.

- [ ] **Step 6.3: Run the seed**

```bash
pnpm prisma db seed
```

Expected output: `Seeded/upserted 50 topic_pool rows`.

- [ ] **Step 6.4: Verify row count**

```bash
mysql --defaults-extra-file=<(printf "[client]\nuser=SORITUNECOM_ROUTINES\npassword=fj6eNiUqlCa7k/dh3ZU+a1Yg\n") -h localhost SORITUNECOM_ROUTINES -e "SELECT category, COUNT(*) FROM topic_pool GROUP BY category;"
```

Expected: each category has count = 10.

- [ ] **Step 6.5: Run seed a second time — prove idempotency**

```bash
pnpm prisma db seed
mysql --defaults-extra-file=<(printf "[client]\nuser=SORITUNECOM_ROUTINES\npassword=fj6eNiUqlCa7k/dh3ZU+a1Yg\n") -h localhost SORITUNECOM_ROUTINES -e "SELECT COUNT(*) FROM topic_pool;"
```

Expected: still 50 rows. If the count is 100, the unique index or upsert is broken — investigate.

- [ ] **Step 6.6: Commit**

```bash
git add prisma/seed-topic-pool.ts prisma/seed.ts
git commit -m "feat(seed): idempotent topic_pool seed with 50 subtopics"
```

---

## Task 7: Rewrite generation prompts

**Files:**
- Modify: `src/lib/generation-prompts.ts`

- [ ] **Step 7.1: Replace genre enum in Stage 1 prompt**

In `src/lib/generation-prompts.ts`, inside `buildStage1Prompt`, find the `genre:` line in the `system` string:

```
- genre: one of: Daily Life, Workplace, Travel, Relationships, Technology, Health, Culture, Education, Entertainment, Environment.
```

Replace with:

```
- genre: one of (Korean, exact string): 웰빙, 교육, 자기개발, 환경, 일상.
```

- [ ] **Step 7.2: Replace `LEVEL_SPEC` object with new per-level rules**

Replace the entire `LEVEL_SPEC` object with:

```ts
const LEVEL_SPEC: Record<Level, LevelGuidance> = {
  beginner: {
    paragraph:
      "Audience: Korean elementary school reader (CEFR A1). Sentence length: 5-9 words. Vocabulary: basic everyday words only (go, eat, take, walk, home, friend, morning, mood). Grammar: present simple by default; past simple only when unavoidable. NO idioms, NO phrasal verbs, NO passive voice, NO relative clauses. 4-6 sentences per paragraph.",
    expressionMeaning:
      "한국어로 1문장, 핵심 의미만 아주 간단하게. 초급 학습자가 바로 이해할 수 있는 쉬운 표현을 써라.",
    expressionExplanation:
      "한국어로 2-3문장. 이 표현을 언제/어떤 상황에서 쓰는지 일상 맥락에서 설명하고, 학습자가 이미 아는 더 쉬운 한국어/영어 유사 표현을 하나 제시해라. 각 문장은 짧게.",
  },
  intermediate: {
    paragraph:
      "Audience: Korean middle/high school reader (CEFR A2-B1). Sentence length: 10-16 words. Common phrasal verbs and accessible idioms are welcome (run into, head to, have trouble, keep up). Mix tenses naturally. Some compound sentences; avoid heavy subordination.",
    expressionMeaning:
      "한국어로 1문장, 자연스러운 뉘앙스까지 담은 핵심 의미.",
    expressionExplanation:
      "한국어로 2-3문장. 사용 뉘앙스, 격식/비격식, 구어/문어 여부, 비슷한 표현과의 차이, 자주 하는 실수를 짚어라. 구체적으로.",
  },
  advanced: {
    paragraph:
      "Audience: educated Korean adult who has studied English (CEFR B1-B2). NOT native register. Sentence length: 14-22 words. Abstract vocabulary and common collocations are fine. FORBIDDEN: obscure/literary vocabulary (seismic, relentless, unprecedented, burgeoning, ubiquitous, paradigm, quintessential, ostensibly, 'landscape of X', 'in the wake of'), dense subordinate clauses, academic register. Keep prose warm and readable — polished but not literary.",
    expressionMeaning:
      "한국어로 1문장, 미묘한 함의와 정확한 사전적 의미를 담아라.",
    expressionExplanation:
      "한국어로 2-3문장. 레지스터(격식도), 함축, 전형적 연어(collocation), 화용적 뉘앙스(아이러니·완곡·헷지)를 다뤄라. 자주 쓰이는 연어 2-3개를 예시로 포함.",
  },
};
```

- [ ] **Step 7.3: Add magazine-column style block to Stage 2 system prompt**

In `buildStage2Prompt`, the `system` template literal currently starts with `You are writing English learning material for Korean learners at ${level} level.`. Immediately after that sentence, insert a new paragraph:

```
STYLE (applies to all paragraphs):
- Write like a short lifestyle magazine column, NOT a personal essay, NOT a textbook.
- Structure: 2-3 short paragraphs. Hook (observation or trend) → concrete detail (fact, data, or example) → takeaway or gentle recommendation.
- Use "I" or "we" when natural; avoid meandering reflection.
- Concrete over abstract. Specific numbers/examples welcome.
- End with a line that gives the reader something to try or remember.
- Target reader: Korean adult in their 40s-50s.
```

Place it ABOVE the existing `LANGUAGE POLICY (critical, read twice):` block. Do NOT duplicate or replace the language policy.

- [ ] **Step 7.4: Typecheck**

```bash
pnpm tsc --noEmit
```

Expected: no errors. (The existing example-shape JSON in the prompt literal still uses `level === "beginner"` etc., which stays valid.)

- [ ] **Step 7.5: Commit**

```bash
git add src/lib/generation-prompts.ts
git commit -m "feat(prompts): 5-category genre list, magazine-column tone, new LEVEL_SPEC"
```

---

## Task 8: Integrate topic-pool + validation into content generation

**Files:**
- Modify: `src/lib/content-generation.ts`

This task has two integrations: (a) call `pickAndClaimTopic` when no `upcoming_topics` override exists, and (b) wrap Stage 2 in a validate-and-retry loop using `validateLevelRules`.

- [ ] **Step 8.1: Read current generation entry points**

Run:
```bash
grep -n "fetchRecentTopics\|buildStage1Prompt\|buildStage2Prompt\|generateContent\|runGeneration" src/lib/content-generation.ts
```

Note the exported function that orchestrates generation (likely `generateContent` or `runGeneration`). You will modify that function.

- [ ] **Step 8.2: Import helpers at the top of `content-generation.ts`**

Add imports:

```ts
import { pickAndClaimTopic, compensatePoolClaim, NoPoolTopicError, type ClaimedTopic } from "./topic-pool";
import { validateLevelRules } from "./level-validation";
```

- [ ] **Step 8.3: Add pool integration to the Stage 1 path**

Find where the current code checks for an `upcoming_topics` row. The current `Stage1Context.upcomingTopic` shape is `{ genre, keyPhrase, keyKo, hint? }`. Preserve that. In the code path where `upcomingTopic` is NOT set, inject a pool claim BEFORE calling the AI:

```ts
let poolClaim: ClaimedTopic | null = null;
let stage1Context: Stage1Context;

const upcomingRow = await prisma.upcomingTopic.findUnique({ where: { date: targetDate } });

if (upcomingRow) {
  stage1Context = {
    recentTopics: await fetchRecentTopics(targetDate),
    upcomingTopic: {
      genre: upcomingRow.genre,
      keyPhrase: upcomingRow.keyPhrase,
      keyKo: upcomingRow.keyKo,
      hint: upcomingRow.hint,
    },
  };
} else {
  poolClaim = await pickAndClaimTopic(targetDate);
  stage1Context = {
    recentTopics: await fetchRecentTopics(targetDate),
    upcomingTopic: {
      genre: poolClaim.category,
      keyPhrase: poolClaim.keyPhraseEn,
      keyKo: poolClaim.keyKo,
      hint: poolClaim.subtopicKo,  // gives the model Korean context for the subtopic
    },
  };
}
```

If the existing code has a different internal variable shape, preserve its pattern — the key requirement is: when there's no `upcoming_topics` row, call `pickAndClaimTopic(targetDate)` and use its values as if they were an upcoming override.

- [ ] **Step 8.4: Add validation + retry loop around Stage 2**

Find where `buildStage2Prompt` + `callAI` + `validateStage2` run for each level. Wrap it in a retry loop:

```ts
const MAX_STAGE2_RETRIES = 2;
let stage2: Stage2Result | null = null;
let lastValidationReasons: string[] = [];

for (let attempt = 0; attempt <= MAX_STAGE2_RETRIES; attempt++) {
  const { system, user } = buildStage2Prompt(stage1, level);
  const raw = await callAI(provider, apiKey, model, system, user, "generation_stage2");
  const parsed = parseJsonLoose(raw);
  const candidate = validateStage2(parsed, stage1.keyPhrase, level);

  const levelCheck = validateLevelRules(candidate.paragraphs, level);
  if (!levelCheck.hardFail) {
    stage2 = candidate;
    if (levelCheck.warnings.length) {
      console.warn(`[generation] ${level} warnings: ${levelCheck.warnings.join("; ")}`);
    }
    break;
  }
  lastValidationReasons = levelCheck.reasons;
  console.warn(`[generation] ${level} attempt ${attempt + 1} failed: ${levelCheck.reasons.join("; ")}`);
}

if (!stage2) {
  throw new Error(`Stage 2 (${level}) level-validation failed after retries: ${lastValidationReasons.join("; ")}`);
}
```

Apply the same loop for every level (`beginner`, `intermediate`, `advanced`). If the current code iterates levels in a loop, place the retry block inside that iteration.

- [ ] **Step 8.5: Compensate pool claim on any failure**

Wrap the generation body (Stage 1 + Stage 2 loops + DB insert) in try/catch so that any thrown error triggers compensation when a `poolClaim` is present:

```ts
try {
  // ...existing Stage 1 + Stage 2 + DB insert code...
} catch (err) {
  if (poolClaim) {
    try {
      await compensatePoolClaim(poolClaim);
    } catch (compErr) {
      console.error("[generation] compensation failed", compErr);
    }
  }
  throw err;
}
```

Do NOT compensate on `NoPoolTopicError` — in that case the claim never happened (error thrown before UPDATE).

- [ ] **Step 8.6: Typecheck + unit tests**

```bash
pnpm tsc --noEmit
pnpm test
```

Expected: typecheck clean; all existing tests plus new ones still pass.

- [ ] **Step 8.7: Commit**

```bash
git add src/lib/content-generation.ts
git commit -m "feat(gen): integrate topic-pool claim + level validation retry loop"
```

---

## Task 9: Admin API for topic_pool

**Files:**
- Create: `src/app/api/admin/topic-pool/route.ts`
- Create: `src/app/api/admin/topic-pool/[id]/route.ts`

Follow the pattern of `src/app/api/admin/topics/route.ts` and `src/app/api/admin/topics/[id]/route.ts`.

- [ ] **Step 9.1: Implement list + create endpoint**

Create `src/app/api/admin/topic-pool/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { isCategory } from "@/lib/categories";

interface PoolInput {
  category: string;
  subtopicKo: string;
  keyPhraseEn: string;
  keyKo: string;
  isActive: boolean;
  notes: string | null;
}

function validateInput(data: Record<string, unknown>): PoolInput | string {
  if (!isCategory(data.category)) return "category must be one of 웰빙, 교육, 자기개발, 환경, 일상";
  for (const k of ["subtopicKo", "keyPhraseEn", "keyKo"] as const) {
    const v = data[k];
    if (typeof v !== "string" || v.trim() === "") return `${k} is required and must be non-empty`;
  }
  const isActive = typeof data.isActive === "boolean" ? data.isActive : true;
  const notes =
    typeof data.notes === "string" && data.notes.trim() !== "" ? data.notes.trim() : null;
  return {
    category: data.category,
    subtopicKo: (data.subtopicKo as string).trim(),
    keyPhraseEn: (data.keyPhraseEn as string).trim(),
    keyKo: (data.keyKo as string).trim(),
    isActive,
    notes,
  };
}

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const where = category && isCategory(category) ? { category } : {};

  const rows = await prisma.topicPool.findMany({
    where,
    orderBy: [{ category: "asc" }, { lastUsedAt: { sort: "asc", nulls: "first" } }, { id: "asc" }],
  });
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json()) as Record<string, unknown>;
  const input = validateInput(body);
  if (typeof input === "string") {
    return NextResponse.json({ error: input }, { status: 400 });
  }

  try {
    const created = await prisma.topicPool.create({ data: input });
    return NextResponse.json(created, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("Unique constraint")) {
      return NextResponse.json(
        { error: "이미 같은 카테고리에 같은 세부주제가 존재합니다." },
        { status: 409 }
      );
    }
    throw err;
  }
}
```

- [ ] **Step 9.2: Implement PATCH + DELETE endpoint**

Create `src/app/api/admin/topic-pool/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { isCategory } from "@/lib/categories";

async function parseId(params: Promise<{ id: string }>): Promise<number | null> {
  const { id } = await params;
  const n = Number(id);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const id = await parseId(params);
  if (!id) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  const body = (await req.json()) as Record<string, unknown>;
  const data: Record<string, unknown> = {};

  if ("category" in body) {
    if (!isCategory(body.category)) return NextResponse.json({ error: "invalid category" }, { status: 400 });
    data.category = body.category;
  }
  for (const k of ["subtopicKo", "keyPhraseEn", "keyKo"] as const) {
    if (k in body) {
      const v = body[k];
      if (typeof v !== "string" || v.trim() === "") {
        return NextResponse.json({ error: `${k} must be non-empty` }, { status: 400 });
      }
      data[k] = v.trim();
    }
  }
  if ("isActive" in body) {
    if (typeof body.isActive !== "boolean") return NextResponse.json({ error: "isActive must be boolean" }, { status: 400 });
    data.isActive = body.isActive;
  }
  if ("notes" in body) {
    data.notes =
      typeof body.notes === "string" && body.notes.trim() !== "" ? body.notes.trim() : null;
  }

  try {
    const updated = await prisma.topicPool.update({ where: { id }, data });
    return NextResponse.json(updated);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("Unique constraint")) {
      return NextResponse.json(
        { error: "이미 같은 카테고리에 같은 세부주제가 존재합니다." },
        { status: 409 }
      );
    }
    if (msg.includes("Record to update not found")) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    throw err;
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const id = await parseId(params);
  if (!id) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  try {
    await prisma.topicPool.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("Record to delete does not exist")) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    throw err;
  }
}
```

- [ ] **Step 9.3: Typecheck**

```bash
pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 9.4: Manual smoke test**

Start the dev server (in a separate shell you'll leave running):
```bash
pnpm dev
```

Log into admin, then from the browser DevTools console or `curl`:
```bash
curl -s http://localhost:3000/api/admin/topic-pool?category=웰빙 \
  -H "cookie: <your admin session cookie>" | head -50
```

Expected: JSON array of 10 웰빙 pool rows, ordered by `last_used_at` NULLs first.

- [ ] **Step 9.5: Commit**

```bash
git add src/app/api/admin/topic-pool/
git commit -m "feat(api): admin topic-pool CRUD endpoints"
```

---

## Task 10: Admin UI — topic-pool page

**Files:**
- Create: `src/components/admin/topic-pool-form.tsx`
- Create: `src/components/admin/topic-pool-table.tsx`
- Create: `src/app/(admin)/admin/topic-pool/page.tsx`

Patterns come from `src/app/(admin)/admin/topics/page.tsx` + `src/components/admin/upcoming-topic-form.tsx`. Keep the visual language consistent.

- [ ] **Step 10.1: Create the form component**

Create `src/components/admin/topic-pool-form.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CATEGORIES } from "@/lib/categories";

export interface TopicPoolRow {
  id: number;
  category: string;
  subtopicKo: string;
  keyPhraseEn: string;
  keyKo: string;
  isActive: boolean;
  notes: string | null;
  lastUsedAt: string | null;
  useCount: number;
}

interface Props {
  initial?: TopicPoolRow | null;
  onSaved: () => void;
  onCancel: () => void;
}

export function TopicPoolForm({ initial, onSaved, onCancel }: Props) {
  const [category, setCategory] = useState(initial?.category ?? CATEGORIES[0]);
  const [subtopicKo, setSubtopicKo] = useState(initial?.subtopicKo ?? "");
  const [keyPhraseEn, setKeyPhraseEn] = useState(initial?.keyPhraseEn ?? "");
  const [keyKo, setKeyKo] = useState(initial?.keyKo ?? "");
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const method = initial ? "PATCH" : "POST";
    const url = initial ? `/api/admin/topic-pool/${initial.id}` : "/api/admin/topic-pool";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category,
        subtopicKo: subtopicKo.trim(),
        keyPhraseEn: keyPhraseEn.trim(),
        keyKo: keyKo.trim(),
        isActive,
        notes: notes.trim() || null,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || `요청 실패 (${res.status})`);
      return;
    }
    onSaved();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <label className="block">
          <span className="text-caption text-text-secondary block mb-1">카테고리</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full border border-border-default rounded-md px-3 py-2 text-body"
          >
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <Input label="세부 주제 (한국어)" value={subtopicKo} onChange={(e) => setSubtopicKo(e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input label="핵심 표현 (영)" value={keyPhraseEn} onChange={(e) => setKeyPhraseEn(e.target.value)} required />
        <Input label="핵심 표현 (한)" value={keyKo} onChange={(e) => setKeyKo(e.target.value)} required />
      </div>
      <label className="block">
        <span className="text-caption text-text-secondary block mb-1">메모 (선택)</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full border border-border-default rounded-md px-3 py-2 text-body min-h-[60px]"
        />
      </label>
      <label className="flex items-center gap-2 text-body text-text-primary cursor-pointer">
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="w-4 h-4" />
        활성 (회전에 포함)
      </label>
      {error && <div className="text-caption text-red-600">{error}</div>}
      <div className="flex gap-2">
        <Button type="submit" disabled={saving}>{saving ? "저장 중..." : initial ? "수정" : "추가"}</Button>
        <Button type="button" variant="ghost" onClick={onCancel}>취소</Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 10.2: Create the table component**

Create `src/components/admin/topic-pool-table.tsx`:

```tsx
"use client";

import type { TopicPoolRow } from "./topic-pool-form";

interface Props {
  rows: TopicPoolRow[];
  onEdit: (row: TopicPoolRow) => void;
  onDelete: (row: TopicPoolRow) => void;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return iso.split("T")[0];
}

export function TopicPoolTable({ rows, onEdit, onDelete }: Props) {
  if (rows.length === 0) {
    return <div className="text-body text-text-secondary py-6">등록된 주제가 없습니다.</div>;
  }
  return (
    <table className="w-full text-body">
      <thead className="border-b border-border-default text-caption text-text-secondary">
        <tr>
          <th className="text-left py-2 px-2">카테고리</th>
          <th className="text-left py-2 px-2">세부 주제</th>
          <th className="text-left py-2 px-2">Key Phrase</th>
          <th className="text-left py-2 px-2">Key (KO)</th>
          <th className="text-left py-2 px-2">마지막 사용</th>
          <th className="text-right py-2 px-2">사용 횟수</th>
          <th className="text-center py-2 px-2">활성</th>
          <th className="text-right py-2 px-2">작업</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id} className="border-b border-border-muted">
            <td className="py-2 px-2">{row.category}</td>
            <td className="py-2 px-2">{row.subtopicKo}</td>
            <td className="py-2 px-2 font-mono text-[13px]">{row.keyPhraseEn}</td>
            <td className="py-2 px-2">{row.keyKo}</td>
            <td className="py-2 px-2 text-text-secondary">{formatDate(row.lastUsedAt)}</td>
            <td className="py-2 px-2 text-right">{row.useCount}</td>
            <td className="py-2 px-2 text-center">{row.isActive ? "✓" : "—"}</td>
            <td className="py-2 px-2 text-right">
              <button className="text-brand-primary underline mr-3" onClick={() => onEdit(row)}>수정</button>
              <button className="text-red-600 underline" onClick={() => onDelete(row)}>삭제</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 10.3: Create the page**

Create `src/app/(admin)/admin/topic-pool/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { CATEGORIES } from "@/lib/categories";
import { TopicPoolForm, type TopicPoolRow } from "@/components/admin/topic-pool-form";
import { TopicPoolTable } from "@/components/admin/topic-pool-table";

export default function AdminTopicPoolPage() {
  const [rows, setRows] = useState<TopicPoolRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("전체");
  const [editing, setEditing] = useState<TopicPoolRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const url = filter === "전체" ? "/api/admin/topic-pool" : `/api/admin/topic-pool?category=${encodeURIComponent(filter)}`;
    fetch(url, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) return;
        setRows(await res.json());
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setLoading(false);
      });
    return () => controller.abort();
  }, [refreshToken, filter]);

  async function handleDelete(row: TopicPoolRow) {
    if (!confirm(`"${row.subtopicKo}" 삭제할까요?`)) return;
    const res = await fetch(`/api/admin/topic-pool/${row.id}`, { method: "DELETE" });
    if (!res.ok) {
      alert(`삭제 실패 (${res.status})`);
      return;
    }
    setRefreshToken((x) => x + 1);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-h2 font-semibold">주제 풀</h1>
      <div className="flex gap-2 items-center">
        <label className="text-caption text-text-secondary">카테고리 필터</label>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="border border-border-default rounded-md px-3 py-1 text-body"
        >
          <option value="전체">전체</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <div className="ml-auto">
          <Button onClick={() => { setCreating(true); setEditing(null); }}>주제 추가</Button>
        </div>
      </div>

      {(creating || editing) && (
        <div className="border border-border-default rounded-lg p-4 bg-bg-subtle">
          <h2 className="text-h3 mb-3">{editing ? "주제 수정" : "새 주제"}</h2>
          <TopicPoolForm
            initial={editing}
            onSaved={() => { setCreating(false); setEditing(null); setRefreshToken((x) => x + 1); }}
            onCancel={() => { setCreating(false); setEditing(null); }}
          />
        </div>
      )}

      {loading ? <div>불러오는 중...</div> : <TopicPoolTable rows={rows} onEdit={(r) => { setEditing(r); setCreating(false); }} onDelete={handleDelete} />}
    </div>
  );
}
```

- [ ] **Step 10.4: Typecheck + dev-server visual check**

```bash
pnpm tsc --noEmit
```

Expected: no errors.

With `pnpm dev` running, navigate to `http://localhost:3000/admin/topic-pool`. Verify: table with 50 rows, filter dropdown works, add/edit/delete round-trip against the API.

- [ ] **Step 10.5: Commit**

```bash
git add src/components/admin/topic-pool-form.tsx src/components/admin/topic-pool-table.tsx src/app/\(admin\)/admin/topic-pool/
git commit -m "feat(admin): topic-pool management UI"
```

---

## Task 11: Admin UI dropdowns + sidebar link

**Files:**
- Modify: `src/components/admin/content-topic-fields.tsx`
- Modify: `src/components/admin/upcoming-topic-form.tsx`
- Modify: `src/components/admin/sidebar.tsx`

- [ ] **Step 11.1: Replace genre input in `content-topic-fields.tsx`**

Open `src/components/admin/content-topic-fields.tsx`. Replace the `<Input label="장르" ... />` line with:

```tsx
<label className="block">
  <span className="text-caption text-text-secondary block mb-1">카테고리</span>
  <select
    value={state.genre}
    onChange={(e) => onChange("genre", e.target.value)}
    className="w-full border border-border-default rounded-md px-3 py-2 text-body"
    required
  >
    <option value="">선택하세요</option>
    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
  </select>
</label>
```

And add at the top of the file:
```ts
import { CATEGORIES } from "@/lib/categories";
```

- [ ] **Step 11.2: Replace genre input in `upcoming-topic-form.tsx`**

Open `src/components/admin/upcoming-topic-form.tsx`. Find the input that has `placeholder="Workplace"`. Replace it with the same `<select>` pattern from Step 11.1, bound to whatever state variable the form uses for genre. Add the `CATEGORIES` import.

- [ ] **Step 11.3: Add sidebar link**

Open `src/components/admin/sidebar.tsx`. In the `links` array, add a new entry after `"/admin/topics"`:

```ts
{ href: "/admin/topic-pool", label: "주제 풀" },
```

The resulting array should be:
```ts
const links = [
  { href: "/admin", label: "대시보드" },
  { href: "/admin/content", label: "콘텐츠" },
  { href: "/admin/topics", label: "주제 스케줄" },
  { href: "/admin/topic-pool", label: "주제 풀" },
  { href: "/admin/users", label: "회원" },
  { href: "/admin/usage", label: "API 사용량" },
  { href: "/admin/settings", label: "AI 설정" },
];
```

- [ ] **Step 11.4: Typecheck + visual verification**

```bash
pnpm tsc --noEmit
```

With `pnpm dev` running: confirm the sidebar shows "주제 풀" and both content-create and upcoming-topic forms now show a dropdown with exactly 5 Korean categories.

- [ ] **Step 11.5: Commit**

```bash
git add src/components/admin/content-topic-fields.tsx src/components/admin/upcoming-topic-form.tsx src/components/admin/sidebar.tsx
git commit -m "feat(admin): category dropdowns + sidebar link for 주제 풀"
```

---

## Task 12: Migration script for existing articles

**Files:**
- Create: `scripts/migrate-existing-articles.ts`

This script is one-time. It prints the planned deletions, asks for confirmation, and performs a date-scoped wipe followed by 6 `upcoming_topics` inserts that pin each date's category.

- [ ] **Step 12.1: Create the script**

Create `scripts/migrate-existing-articles.ts`:

```ts
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import * as readline from "node:readline";

const START = new Date("2026-04-20T00:00:00Z");
const END = new Date("2026-04-25T00:00:00Z");

const PINNED: Array<{ date: string; category: string; subtopicKo: string }> = [
  { date: "2026-04-20", category: "웰빙", subtopicKo: "아침 산책 습관" },
  { date: "2026-04-21", category: "교육", subtopicKo: "자녀와 소통" },
  { date: "2026-04-22", category: "자기개발", subtopicKo: "은퇴 준비" },
  { date: "2026-04-23", category: "환경", subtopicKo: "플라스틱 줄이기" },
  { date: "2026-04-24", category: "일상", subtopicKo: "부모님 안부 전화" },
  { date: "2026-04-25", category: "웰빙", subtopicKo: "깊은 숙면" },
];

async function confirm(question: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(`${question} (type YES to continue) `, (answer) => {
      rl.close();
      resolve(answer === "YES");
    });
  });
}

async function main() {
  console.log("=== Routines: existing-article migration ===");
  console.log(`Date range: ${START.toISOString().slice(0, 10)} .. ${END.toISOString().slice(0, 10)}`);

  const targets = await prisma.content.findMany({
    where: { publishedAt: { gte: START, lte: END } },
    select: { id: true, publishedAt: true, genre: true, title: true },
    orderBy: { publishedAt: "asc" },
  });

  console.log(`Found ${targets.length} contents in range:`);
  for (const t of targets) {
    const iso = t.publishedAt?.toISOString().slice(0, 10) ?? "null";
    console.log(`  id=${t.id} date=${iso} genre=${t.genre} title="${t.title}"`);
  }
  if (targets.length > 6) {
    console.error("Aborting: more than 6 rows matched. Investigate before proceeding.");
    process.exit(1);
  }
  if (targets.length === 0) {
    console.log("No existing content in range. Skipping delete; will still seed upcoming_topics.");
  }

  if (!(await confirm(`Delete these ${targets.length} contents and all dependent rows?`))) {
    console.log("Cancelled.");
    process.exit(0);
  }

  const ids = targets.map((t) => t.id);

  await prisma.$transaction(async (tx) => {
    if (ids.length > 0) {
      await tx.analyticsEvent.deleteMany({ where: { contentId: { in: ids } } });
      await tx.share.deleteMany({ where: { contentId: { in: ids } } });
      await tx.userProgress.deleteMany({ where: { contentId: { in: ids } } });
      await tx.interviewAnswer.deleteMany({ where: { contentId: { in: ids } } });
      await tx.recording.deleteMany({ where: { contentId: { in: ids } } });
      await tx.generationLog.updateMany({ where: { contentId: { in: ids } }, data: { contentId: null } });
      await tx.contentVariant.deleteMany({ where: { contentId: { in: ids } } });
      await tx.content.deleteMany({ where: { id: { in: ids } } });
    }
  });
  console.log(`Deleted ${ids.length} contents + dependent rows.`);

  console.log("\nSeeding upcoming_topics for the 6 dates…");
  for (const p of PINNED) {
    const pool = await prisma.topicPool.findFirst({
      where: { category: p.category, subtopicKo: p.subtopicKo },
    });
    if (!pool) {
      console.error(`Pool row missing for ${p.category} / ${p.subtopicKo}. Aborting.`);
      process.exit(1);
    }
    await prisma.upcomingTopic.upsert({
      where: { date: new Date(`${p.date}T00:00:00Z`) },
      create: {
        date: new Date(`${p.date}T00:00:00Z`),
        genre: p.category,
        keyPhrase: pool.keyPhraseEn,
        keyKo: pool.keyKo,
        hint: p.subtopicKo,
      },
      update: {
        genre: p.category,
        keyPhrase: pool.keyPhraseEn,
        keyKo: pool.keyKo,
        hint: p.subtopicKo,
      },
    });
    console.log(`  ${p.date}: ${p.category} / ${p.subtopicKo} / "${pool.keyPhraseEn}"`);
  }

  console.log("\nDone. Next step: trigger generation for each of the 6 dates via /admin/content.");
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
```

The table deletion order mirrors the spec's FK order. Recording file cleanup under `uploads/<id>/` is intentionally NOT done in this script — recordings can be huge and the cascade-safe option is a separate manual rm after verifying the DB delete succeeded.

- [ ] **Step 12.2: Typecheck**

```bash
pnpm tsc --noEmit
```

Expected: no errors. If `scripts/` is outside `tsconfig.json`'s `include`, add it: open `tsconfig.json` and ensure `"include"` contains `"scripts/**/*.ts"`. If you need to add it, note the change in the commit.

- [ ] **Step 12.3: Commit**

```bash
git add scripts/migrate-existing-articles.ts tsconfig.json
git commit -m "feat(scripts): one-time migration for pre-redesign articles"
```

---

## Task 13: Run DEV migration + regenerate articles

This task executes the plan against the live dev DB. DB dump is mandatory.

- [ ] **Step 13.1: Backup the DB**

```bash
mysqldump --defaults-extra-file=<(printf "[client]\nuser=SORITUNECOM_ROUTINES\npassword=fj6eNiUqlCa7k/dh3ZU+a1Yg\n") -h localhost SORITUNECOM_ROUTINES > /tmp/routines_backup_pre_category_redesign_$(date +%Y%m%d).sql
ls -l /tmp/routines_backup_pre_category_redesign_*.sql
```

Expected: a file of at least a few MB. If it's empty, STOP.

- [ ] **Step 13.2: Run the migration script**

```bash
cd /var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines
pnpm tsx scripts/migrate-existing-articles.ts
```

Review the printed list of targets carefully. Type `YES` to confirm. Expected: "Deleted N contents + dependent rows." then "Done."

- [ ] **Step 13.3: Trigger generation for the 6 pinned dates**

Either from `/admin/content` → "생성하기" per date, or via the existing generation API if one exists. For each of 2026-04-20 .. 2026-04-25, run the generation and wait for it to finish.

If rate-limited, pace them — one at a time is safer.

- [ ] **Step 13.4: Verify the regenerated content**

```bash
mysql --defaults-extra-file=<(printf "[client]\nuser=SORITUNECOM_ROUTINES\npassword=fj6eNiUqlCa7k/dh3ZU+a1Yg\n") -h localhost SORITUNECOM_ROUTINES -e "SELECT id, genre, title, published_at FROM contents WHERE published_at BETWEEN '2026-04-20' AND '2026-04-25' ORDER BY published_at;"
```

Expected: 6 rows with genres `[웰빙, 교육, 자기개발, 환경, 일상, 웰빙]` in that date order.

Then spot-check one article in the browser at `/today` and `/archive`: the paragraphs should read like a magazine column (not essay-like), and the 3 levels should feel clearly different.

- [ ] **Step 13.5: Remove stale recording files (if any)**

```bash
# Only run if the deleted IDs were known to have recordings. List first:
ls /var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines/uploads/ 2>/dev/null
```

If any directory matches an old deleted content id, remove it:
```bash
# example, adjust id
rm -rf uploads/21
```

---

## Task 14: Final verification + build

- [ ] **Step 14.1: Full typecheck + tests + build**

```bash
pnpm tsc --noEmit
pnpm test
pnpm build
```

Expected: all green. No TS errors, all vitest tests pass, `next build` succeeds.

- [ ] **Step 14.2: Restart PM2**

```bash
pm2 restart routines
pm2 logs routines --lines 30
```

Expected: no errors on boot.

- [ ] **Step 14.3: Verify success criteria**

Manually run through the spec's Success Criteria (§Success Criteria in `docs/superpowers/specs/2026-04-24-category-level-redesign-design.md`):

1. Generate an article for 2026-04-26 (no upcoming override in DB). Confirm its genre is `교육` (next in rotation after the 4/25 웰빙 article).
2. Reread the 6 regenerated articles — each should read like a magazine column.
3. For one beginner variant, run `src/lib/level-validation.ts` mentally against its sentences (5–10 words, mostly; ≤30% outliers). For advanced, scan for forbidden terms.
4. Re-seed (`pnpm prisma db seed`) → `SELECT COUNT(*) FROM topic_pool` must still be 50.
5. Through the admin UI, add a new 주제 풀 row, then confirm it appears in the filter.
6. Trigger a generation for a date that has an `upcoming_topics` override — it should use that override without advancing rotation or stamping `topic_pool.last_used_at`.

- [ ] **Step 14.4: Push**

```bash
git push origin main
```

Since routines has no dev/prod branch split, `main` is production. **Stop here and ask the user to verify on the live dev-ish domain** before moving on.

---

## Self-Review Checklist (run after plan is complete)

- [x] Spec coverage: every section has a corresponding task.
  - Categories, level spec, magazine tone → Task 2, 7
  - Data model → Task 1
  - Rotation logic with FOR UPDATE → Task 4, 5
  - Upcoming override path → Task 8 (Step 8.3)
  - Failure compensation → Task 5 (`compensatePoolClaim`) + Task 8 (Step 8.5)
  - Pool empty fallback (`NoPoolTopicError`) → Task 5
  - Existing content migration (date-based) → Task 12
  - Topic pool seed (idempotent) → Task 6
  - Admin UI (topic-pool + dropdowns + sidebar) → Task 10, 11
  - Level-rule validation (word count + forbidden) → Task 3, 8
  - All 9 Success Criteria covered in Task 14

- [x] No placeholders remaining in any step (all steps have exact code or exact commands).
- [x] Type consistency: `Category` type, `ClaimedTopic` fields, `ValidationResult` shape, `TopicPoolRow` interface — all used consistently across tasks.
- [x] Shares the same `"beginner" | "intermediate" | "advanced"` `Level` string union that already lives in `src/lib/generation-prompts.ts` (level-validation imports it from there, no duplicate type).

---

## Rollback (if things go sideways mid-migration)

```bash
mysql --defaults-extra-file=<(printf "[client]\nuser=SORITUNECOM_ROUTINES\npassword=fj6eNiUqlCa7k/dh3ZU+a1Yg\n") -h localhost SORITUNECOM_ROUTINES < /tmp/routines_backup_pre_category_redesign_YYYYMMDD.sql
git revert <commit-range>
pm2 restart routines
```

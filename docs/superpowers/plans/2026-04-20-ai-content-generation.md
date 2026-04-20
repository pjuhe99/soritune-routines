# AI Content Auto-Generation Implementation Plan (Plan 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every night at 21:00 KST, generate the next day's content (topic + 3 level variants) automatically using AI, with admin override via UpcomingTopic and a "run now" button. On failure, retry once then fall back by cloning the previous day's content into a new row.

**Architecture:** A new `content-generation` service runs 2-stage AI calls (topic common info first, then 3 levels in parallel) with strict server-side validation and `GenerationLog` instrumentation. A single API endpoint `/api/admin/generation/run` accepts either a Bearer-token (cron) or an admin session (UI). Fallback creates a new Content row via clone (not mutation) so archive history stays intact.

**Tech Stack:** Next.js 16 · NextAuth v5 (admin only) · Prisma 6 + MySQL · Anthropic + OpenAI SDK · pnpm · PM2 · server crontab.

**Source spec:** `/var/www/html/_______site_SORITUNECOM_ROUTINES/docs/superpowers/specs/2026-04-20-ai-content-generation-design.md` (commit `ddfa819`).

**Working directory:** `/var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines/`
**Repo root:** `/var/www/html/_______site_SORITUNECOM_ROUTINES/`
**Branch:** `main`
**Remote:** `origin` → `git@github-routines:pjuhe99/soritune-routines.git`

---

## Testing Approach

No test framework in the project (pattern established in Plan 1). Each task ends with `pnpm build` and, where applicable, manual curl / DB verification. Final task runs an end-to-end manual trigger in the deployed environment.

## File Structure

### Create
- `prisma/migrations/<ts>_add_generation_tables/migration.sql`
- `src/lib/generation-prompts.ts` — Stage 1 + Stage 2 prompt builders, TUNING NOTES
- `src/lib/content-generation.ts` — `generateContentForDate()` + validation + retry + clone fallback
- `src/app/api/admin/generation/run/route.ts` — Bearer OR admin auth, triggers service
- `src/app/api/admin/generation/log/route.ts` — admin-only, returns recent logs
- `src/app/api/admin/topics/route.ts` — GET all + POST
- `src/app/api/admin/topics/[id]/route.ts` — PUT + DELETE
- `src/app/(admin)/admin/topics/page.tsx` — scheduling UI + manual trigger
- `src/components/admin/upcoming-topic-form.tsx` — create/edit form
- `src/components/admin/generation-trigger.tsx` — "run now" block + last-run summary

### Modify
- `src/lib/date.ts` — export `todayKSTDate()` and `tomorrowKSTDate()`
- `src/app/api/content/today/route.ts` — drop inline helper, import from `@/lib/date`
- `prisma/schema.prisma` — UpcomingTopic, GenerationLog, GenerationStatus enum, `Content.reusedFromContentId` self-relation
- `src/components/admin/sidebar.tsx` — add "주제 스케줄" link

### Unchanged
- All user-facing pages
- `src/lib/ai-service.ts` (`getActiveProvider` is reused as-is)
- `src/lib/auth-helpers.ts` (`requireAdmin` is reused)

---

## Task 1: Date helpers — extract and share

Plan 1 added an inline `todayKSTDate()` in `/api/content/today/route.ts` to work around MySQL DATE/KST mismatch. Plan 2 needs the same plus tomorrow. Extract both to `src/lib/date.ts` as the single source of truth.

**Files:**
- Modify: `src/lib/date.ts`
- Modify: `src/app/api/content/today/route.ts`

### Step 1.1 — Add exports to `src/lib/date.ts`

- [ ] **Action:** Read current contents. Append two new exports while leaving the existing `nowKST`, `todayKST`, `yesterdayKST`, `isSameDateKST`, `formatDateKST` functions untouched. Final file content after edit:

```typescript
export function nowKST(): Date {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" })
  );
}

export function todayKST(): Date {
  const now = nowKST();
  now.setHours(0, 0, 0, 0);
  return now;
}

export function yesterdayKST(): Date {
  const d = todayKST();
  d.setDate(d.getDate() - 1);
  return d;
}

export function isSameDateKST(a: Date, b: Date): boolean {
  const aKST = new Date(a.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  const bKST = new Date(b.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  return (
    aKST.getFullYear() === bKST.getFullYear() &&
    aKST.getMonth() === bKST.getMonth() &&
    aKST.getDate() === bKST.getDate()
  );
}

export function formatDateKST(date: Date): string {
  return new Date(date.toLocaleString("en-US", { timeZone: "Asia/Seoul" }))
    .toISOString()
    .split("T")[0];
}

/**
 * Today's KST calendar date as UTC midnight. This is the correct form
 * for comparing against MySQL `@db.Date` columns because MySQL strips
 * the time component and only matches on date portion. Use this for
 * DB writes and equality comparisons on Content.publishedAt.
 *
 * Note the difference from `todayKST()`, which returns KST local
 * midnight (offset -9 from UTC). Streak code uses `todayKST()`; Content
 * date matching uses this.
 */
export function todayKSTDate(): Date {
  const kstDateStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
  return new Date(kstDateStr);
}

/**
 * Same form as `todayKSTDate()` but for tomorrow. Used by the
 * generation cron/endpoint as the default target date.
 */
export function tomorrowKSTDate(): Date {
  const d = todayKSTDate();
  d.setUTCDate(d.getUTCDate() + 1);
  return d;
}
```

### Step 1.2 — Update `src/app/api/content/today/route.ts`

- [ ] **Action:** Replace file contents with:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { todayKSTDate } from "@/lib/date";

type Level = "beginner" | "intermediate" | "advanced";
const LEVELS: readonly Level[] = ["beginner", "intermediate", "advanced"] as const;
const DEFAULT_LEVEL: Level = "intermediate";

function parseLevel(input: string | null): Level {
  if (input && (LEVELS as readonly string[]).includes(input)) return input as Level;
  return DEFAULT_LEVEL;
}

export async function GET(req: NextRequest) {
  const today = todayKSTDate();
  const level = parseLevel(req.nextUrl.searchParams.get("level"));

  const topic = await prisma.content.findFirst({
    where: { publishedAt: today, isActive: true },
    orderBy: { priority: "desc" },
    include: { variants: true },
  });

  if (!topic) {
    return NextResponse.json({ error: "No content for today" }, { status: 404 });
  }

  let variant = topic.variants.find((v) => v.level === level);
  if (!variant && level !== DEFAULT_LEVEL) {
    console.warn("variant missing — falling back to intermediate", {
      contentId: topic.id,
      requestedLevel: level,
    });
    variant = topic.variants.find((v) => v.level === DEFAULT_LEVEL);
  }
  if (!variant) {
    return NextResponse.json(
      { error: "No variant available for this content" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    id: topic.id,
    genre: topic.genre,
    title: topic.title,
    subtitle: topic.subtitle,
    keyPhrase: topic.keyPhrase,
    keyKo: topic.keyKo,
    publishedAt: topic.publishedAt,
    level: variant.level,
    paragraphs: variant.paragraphs,
    sentences: variant.sentences,
    expressions: variant.expressions,
    quiz: variant.quiz,
    interview: variant.interview,
    speakSentences: variant.speakSentences,
  });
}
```

The only change is that the inline `todayKSTDate` helper is gone; the route imports it from `@/lib/date`. The response shape and semantics are identical.

### Step 1.3 — Verify build

- [ ] **Action:**

```bash
cd /var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines
pnpm build 2>&1 | tail -10
```

Must succeed with no TS errors.

### Step 1.4 — Smoke test locally (optional but quick)

- [ ] **Action:** Reload PM2 so the new build is live, then curl:

```bash
pm2 reload ecosystem.config.js --update-env 2>&1 | tail -2
sleep 2
curl -s "http://localhost:3000/api/content/today?level=beginner" | head -c 200
echo
```

Expected: today's topic payload with `"level":"beginner"`. If 404 appears, the seed's publishedAt fell out of alignment — re-run seed (`pnpm prisma db seed`).

### Step 1.5 — Commit

- [ ] **Action:**

```bash
cd /var/www/html/_______site_SORITUNECOM_ROUTINES
git add public_html/routines/src/lib/date.ts
git add public_html/routines/src/app/api/content/today/route.ts
git status
git commit -m "$(cat <<'EOF'
refactor(date): export todayKSTDate/tomorrowKSTDate from lib/date

Plan 1 left an inline todayKSTDate helper in /api/content/today.
Extract it to src/lib/date.ts so Plan 2's generation service can
share the same convention (UTC midnight of today's KST calendar
date) for every DB write and comparison. Add tomorrowKSTDate for
the cron default target.

Leaves the existing todayKST() (KST local midnight) alone — streak
code depends on it and the two have different semantics. Comment
block on todayKSTDate clarifies when to pick which.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Do NOT push.

---

## Task 2: Schema changes — UpcomingTopic, GenerationLog, reusedFromContentId

This commit adds three new items to Prisma: `UpcomingTopic`, `GenerationLog` + `GenerationStatus` enum, and a self-relation on `Content` (`reusedFromContentId`). No code uses them yet — Task 3+ will. Migration is generated via `prisma migrate diff` because the DB user lacks CREATE DATABASE privilege for Prisma's shadow DB (same workaround Plan 1 used).

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<ts>_add_generation_tables/migration.sql`

### Step 2.1 — Update `prisma/schema.prisma`

- [ ] **Action:** Read the current schema. Make three edits.

**Edit A — Add `reusedFromContentId` field and self-relation to `Content` model.** Add these three lines **inside** the `Content` model block, after `updatedAt`, before the relations block:

```prisma
  reusedFromContentId Int? @map("reused_from_content_id")
```

Add the self-relation inside the relations section (where `variants`, `progress`, etc. already live):

```prisma
  reusedFrom          Content?  @relation("ContentReuse", fields: [reusedFromContentId], references: [id], onDelete: SetNull)
  reusedBy            Content[] @relation("ContentReuse")
```

After these edits the `Content` model's relations section should contain `variants`, `progress`, `analyticsEvents`, `shares`, `reusedFrom`, `reusedBy`.

**Edit B — Add `UpcomingTopic` model.** Insert anywhere after the `Content` model block:

```prisma
model UpcomingTopic {
  id         Int      @id @default(autoincrement())
  date       DateTime @unique @db.Date
  genre      String   @db.VarChar(50)
  keyPhrase  String   @map("key_phrase") @db.VarChar(255)
  keyKo      String   @map("key_ko") @db.VarChar(255)
  hint       String?  @db.Text
  createdAt  DateTime @default(now()) @map("created_at")
  updatedAt  DateTime @updatedAt @map("updated_at")

  @@map("upcoming_topics")
}
```

**Edit C — Add `GenerationLog` model + `GenerationStatus` enum.** Insert the model after `UpcomingTopic`:

```prisma
model GenerationLog {
  id           Int              @id @default(autoincrement())
  targetDate   DateTime         @map("target_date") @db.Date
  runAt        DateTime         @default(now()) @map("run_at")
  status       GenerationStatus
  provider     String?          @db.VarChar(20)
  model        String?          @db.VarChar(100)
  durationMs   Int?             @map("duration_ms")
  contentId    Int?             @map("content_id")
  errorMessage String?          @map("error_message") @db.Text
  attempt      Int              @default(1)

  @@index([runAt])
  @@map("generation_logs")
}
```

Add the enum alongside the other enums at the bottom of the file:

```prisma
enum GenerationStatus {
  running
  success
  failed
  fallback
}
```

### Step 2.2 — Generate migration file

- [ ] **Action:** The DB user lacks CREATE DATABASE for Prisma's shadow DB (Plan 1 established this). Use `prisma migrate diff` to produce the SQL directly against the live DB state.

```bash
cd /var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines
TS=$(date -u +%Y%m%d%H%M%S)
mkdir -p "prisma/migrations/${TS}_add_generation_tables"
pnpm prisma migrate diff \
  --from-url "$(grep '^DATABASE_URL=' .env.local | cut -d= -f2- | tr -d '"')" \
  --to-schema-datamodel prisma/schema.prisma \
  --script > "prisma/migrations/${TS}_add_generation_tables/migration.sql"
```

Inspect the generated `migration.sql` and confirm it contains:
- `ALTER TABLE contents ADD COLUMN reused_from_content_id INT NULL` with a FK constraint `ADD CONSTRAINT ... FOREIGN KEY (reused_from_content_id) REFERENCES contents(id) ON DELETE SET NULL ON UPDATE CASCADE`
- `CREATE TABLE upcoming_topics` with id, date (unique), genre, key_phrase, key_ko, hint, timestamps
- `CREATE TABLE generation_logs` with id, target_date, run_at, status (ENUM running/success/failed/fallback), provider, model, duration_ms, content_id, error_message, attempt, and an index on run_at

If the SQL is wrong or missing any of these, report BLOCKED with details. Otherwise proceed.

### Step 2.3 — Regenerate Prisma client types

- [ ] **Action:**

```bash
pnpm prisma generate 2>&1 | tail -5
```

Expected: `Generated Prisma Client ...`. TypeScript now knows about `UpcomingTopic`, `GenerationLog`, `GenerationStatus`, and `Content.reusedFromContentId`.

### Step 2.4 — Verify build

- [ ] **Action:**

```bash
pnpm build 2>&1 | tail -10
```

Must succeed. New types are exposed but unused — no runtime change yet.

### Step 2.5 — Commit

- [ ] **Action:**

```bash
cd /var/www/html/_______site_SORITUNECOM_ROUTINES
git add public_html/routines/prisma/schema.prisma
git add public_html/routines/prisma/migrations/
git status
git commit -m "$(cat <<'EOF'
feat(schema): add UpcomingTopic, GenerationLog, Content.reusedFromContentId

- UpcomingTopic: admin-scheduled topic override with keyKo required
  so AI-generated Korean translation can't drift from fixed keyPhrase.
- GenerationLog: per-attempt run history with GenerationStatus enum
  (running / success / failed / fallback). Indexed on run_at.
- Content gains self-relation (reusedFrom / reusedBy) via nullable
  reusedFromContentId so the fallback path can clone the previous
  day's content without mutating the original row. SetNull on delete
  to avoid orphans blocking content deletion.

Migration generated via prisma migrate diff (shadow DB unavailable).
Applied later in the deploy task.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Do NOT push.

---

## Task 3: Generation prompts

Centralize prompt construction in `src/lib/generation-prompts.ts`. Includes initial versions + TUNING NOTES. Service in Task 4 imports these builders.

**Files:**
- Create: `src/lib/generation-prompts.ts`

### Step 3.1 — Create `src/lib/generation-prompts.ts`

- [ ] **Action:** Write the full file:

```typescript
// Prompt builders for the AI content generation service.
//
// Stage 1 produces the shared topic info (title/subtitle/genre/keyPhrase/keyKo).
// Stage 2 produces a single level's learning payload (paragraphs/sentences/...).
//
// TUNING NOTES:
// - If models (esp. non-Claude) return markdown-wrapped JSON, tighten the
//   "Respond ONLY with valid JSON" language or switch to the provider's
//   structured-output mode.
// - If the quiz.answer frequently fails "answer ∈ options" validation,
//   reinforce "answer MUST be exactly one of the options" in Stage 2.
// - If beginner paragraphs drift too complex or advanced paragraphs drift
//   too simple, quote examples in the level spec.
// - KeyPhrase-in-paragraph validation sometimes fails because the model
//   uses a morphological variant. Consider relaxing to stem-match or
//   strengthen the prompt to require the exact surface form.

export type Level = "beginner" | "intermediate" | "advanced";

export interface RecentTopicRef {
  genre: string;
  title: string;
  keyPhrase: string;
}

export interface Stage1Context {
  recentTopics: RecentTopicRef[];
  upcomingTopic?: {
    genre: string;
    keyPhrase: string;
    keyKo: string;
    hint?: string | null;
  };
}

export interface Stage1Result {
  title: string;
  subtitle: string;
  genre: string;
  keyPhrase: string;
  keyKo: string;
}

export function buildStage1Prompt(ctx: Stage1Context): { system: string; user: string } {
  const system = `You are an English learning content designer for Korean learners. Generate a daily topic that is distinct from the recent topics provided. Output strict JSON with fields: title, subtitle, genre, keyPhrase, keyKo.

Rules:
- title: 5-10 English words, concrete and inviting.
- subtitle: 1 short English sentence, 6-14 words.
- genre: one of: Daily Life, Workplace, Travel, Relationships, Technology, Health, Culture, Education, Entertainment, Environment.
- keyPhrase: 1-4 English words that will be taught and must appear naturally in every paragraph at all levels.
- keyKo: a concise Korean translation of keyPhrase (1-6 Korean characters).

Respond ONLY with valid JSON. No markdown, no code blocks, just the JSON object.`;

  const recentList = ctx.recentTopics.length
    ? ctx.recentTopics.map((t) => `- ${t.genre}: "${t.title}" [${t.keyPhrase}]`).join("\n")
    : "- (none)";

  const override = ctx.upcomingTopic
    ? `\n\nUse these fixed values (do NOT change them; only generate title/subtitle consistent with these):
- genre: ${ctx.upcomingTopic.genre}
- keyPhrase: ${ctx.upcomingTopic.keyPhrase}
- keyKo: ${ctx.upcomingTopic.keyKo}
${ctx.upcomingTopic.hint ? `- hint: ${ctx.upcomingTopic.hint}` : ""}`
    : "";

  const user = `Recent topics (avoid duplicating genre or keyPhrase):
${recentList}${override}

Respond ONLY with valid JSON: { "title": "...", "subtitle": "...", "genre": "...", "keyPhrase": "...", "keyKo": "..." }`;

  return { system, user };
}

const LEVEL_SPEC: Record<Level, string> = {
  beginner:
    "beginner: Short simple sentences (8-15 words), elementary vocabulary, present tense preferred. Explanations inside expressions should reference simple synonyms.",
  intermediate:
    "intermediate: Natural conversational English (12-22 words per sentence), idiomatic but accessible phrasal verbs, mix of tenses.",
  advanced:
    "advanced: Native speaker register with sophisticated vocabulary, nuanced connotation, varied syntax (18-30 words per sentence ok).",
};

export function buildStage2Prompt(
  stage1: Stage1Result,
  level: Level
): { system: string; user: string } {
  const system = `You are writing English learning material for Korean learners at ${level} level.

Level spec:
${LEVEL_SPEC[level]}

Output strict JSON with exactly these fields:
- paragraphs: 2 to 5 English paragraphs. The keyPhrase "${stage1.keyPhrase}" MUST appear at least once across the paragraphs (surface form preferred).
- sentences: 4 to 10 short English sentences suitable for listening practice.
- expressions: 3 to 6 objects with { "expression": "...", "meaning": "...", "example": "..." }. "meaning" should be 1 English sentence. "example" is an English example sentence.
- quiz: 3 to 6 multiple-choice items with { "question": "...", "answer": "...", "options": ["...", ...] }. options has 3-4 entries. answer MUST be exactly equal to one of the options. Typically fill-in-the-blank style.
- interview: 3 to 6 open-ended English interview questions the student could answer conversationally.
- speakSentences: 3 to 6 English sentences that practice the keyPhrase or topic vocabulary.

Every string must be non-empty after trimming.

Respond ONLY with valid JSON. No markdown, no code blocks.`;

  const user = `Topic metadata:
- title: ${stage1.title}
- subtitle: ${stage1.subtitle}
- genre: ${stage1.genre}
- keyPhrase: ${stage1.keyPhrase} (${stage1.keyKo})

Write the full ${level}-level learning material. Respond ONLY with JSON matching the schema.`;

  return { system, user };
}
```

### Step 3.2 — Verify build

- [ ] **Action:**

```bash
cd /var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines
pnpm build 2>&1 | tail -5
```

Must succeed (the module is orphan but must type-check).

### Step 3.3 — Commit

- [ ] **Action:**

```bash
cd /var/www/html/_______site_SORITUNECOM_ROUTINES
git add public_html/routines/src/lib/generation-prompts.ts
git status
git commit -m "$(cat <<'EOF'
feat(generation): prompt builders for 2-stage content generation

Stage 1 builds one prompt for shared topic info (title/subtitle/genre/
keyPhrase/keyKo). When UpcomingTopic provides fixed genre/keyPhrase/
keyKo, the prompt surfaces them so the model produces title/subtitle
consistent with the admin's intent — server still overwrites those
three fields post-parse to guarantee no drift.

Stage 2 builds one prompt per level (beginner/intermediate/advanced).
Level spec inlined for prompt discoverability. Quiz spec explicitly
requires answer ∈ options and paragraph spec explicitly requires
keyPhrase to appear — mirrors server validation in the service.

TUNING NOTES block at top captures expected iteration vectors so the
next time we edit prompts we know why.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Do NOT push.

---

## Task 4: Generation service — `generateContentForDate`

Core service with stale-TTL handling, 2-stage AI calls, strict validation, one retry, and clone-based fallback.

**Files:**
- Create: `src/lib/content-generation.ts`

### Step 4.1 — Create `src/lib/content-generation.ts`

- [ ] **Action:** Write the full file:

```typescript
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { prisma } from "@/lib/prisma";
import { getActiveProvider } from "@/lib/ai-service";
import {
  buildStage1Prompt,
  buildStage2Prompt,
  Level,
  RecentTopicRef,
  Stage1Context,
  Stage1Result,
} from "@/lib/generation-prompts";
import { ContentVariant, GenerationStatus, Prisma } from "@prisma/client";

const LEVELS: readonly Level[] = ["beginner", "intermediate", "advanced"] as const;
const STALE_RUNNING_MINUTES = 30;
const RECENT_TOPICS_DAYS = 14;

export type GenerationResult = {
  status: "success" | "fallback" | "failed";
  contentId: number | null;
  logId: number;
};

export class GenerationConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GenerationConflictError";
  }
}

interface Stage2Result {
  paragraphs: string[];
  sentences: string[];
  expressions: { expression: string; meaning: string; example: string }[];
  quiz: { question: string; answer: string; options: string[] }[];
  interview: string[];
  speakSentences: string[];
}

async function callAI(
  provider: "claude" | "openai",
  apiKey: string,
  model: string,
  system: string,
  user: string
): Promise<string> {
  if (provider === "claude") {
    const client = new Anthropic({ apiKey });
    const resp = await client.messages.create({
      model,
      max_tokens: 4096,
      system,
      messages: [{ role: "user", content: user }],
    });
    const block = resp.content[0];
    if (block.type !== "text") throw new Error("Claude returned non-text block");
    return block.text;
  }
  const client = new OpenAI({ apiKey });
  const resp = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  const text = resp.choices[0]?.message?.content;
  if (!text) throw new Error("OpenAI returned empty content");
  return text;
}

function parseJsonLoose(raw: string): unknown {
  // Some models still wrap JSON in ```json blocks despite instructions. Strip if present.
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  const body = fenced ? fenced[1] : trimmed;
  return JSON.parse(body);
}

function validateStage1(raw: unknown): Stage1Result {
  if (typeof raw !== "object" || raw === null) throw new Error("Stage 1: not an object");
  const o = raw as Record<string, unknown>;
  for (const k of ["title", "subtitle", "genre", "keyPhrase", "keyKo"] as const) {
    if (typeof o[k] !== "string" || (o[k] as string).trim() === "") {
      throw new Error(`Stage 1: ${k} missing or empty`);
    }
  }
  return {
    title: (o.title as string).trim(),
    subtitle: (o.subtitle as string).trim(),
    genre: (o.genre as string).trim(),
    keyPhrase: (o.keyPhrase as string).trim(),
    keyKo: (o.keyKo as string).trim(),
  };
}

function assertNonEmptyStringArray(arr: unknown, field: string, min: number, max: number): string[] {
  if (!Array.isArray(arr)) throw new Error(`${field}: not an array`);
  if (arr.length < min || arr.length > max) {
    throw new Error(`${field}: length ${arr.length} outside [${min}, ${max}]`);
  }
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i];
    if (typeof v !== "string" || v.trim() === "") {
      throw new Error(`${field}[${i}]: not a non-empty string`);
    }
  }
  return arr.map((s) => (s as string).trim());
}

function validateStage2(raw: unknown, keyPhrase: string, level: Level): Stage2Result {
  if (typeof raw !== "object" || raw === null) throw new Error(`Stage 2 (${level}): not an object`);
  const o = raw as Record<string, unknown>;

  const paragraphs = assertNonEmptyStringArray(o.paragraphs, `Stage 2 (${level}) paragraphs`, 2, 5);
  const sentences = assertNonEmptyStringArray(o.sentences, `Stage 2 (${level}) sentences`, 4, 10);
  const interview = assertNonEmptyStringArray(o.interview, `Stage 2 (${level}) interview`, 3, 6);
  const speakSentences = assertNonEmptyStringArray(
    o.speakSentences,
    `Stage 2 (${level}) speakSentences`,
    3,
    6
  );

  if (!Array.isArray(o.expressions)) throw new Error(`Stage 2 (${level}) expressions: not an array`);
  if (o.expressions.length < 3 || o.expressions.length > 6) {
    throw new Error(`Stage 2 (${level}) expressions: length ${o.expressions.length} outside [3, 6]`);
  }
  const expressions = o.expressions.map((e, i) => {
    if (typeof e !== "object" || e === null) throw new Error(`expressions[${i}]: not an object`);
    const x = e as Record<string, unknown>;
    for (const k of ["expression", "meaning", "example"] as const) {
      if (typeof x[k] !== "string" || (x[k] as string).trim() === "") {
        throw new Error(`expressions[${i}].${k}: not a non-empty string`);
      }
    }
    return {
      expression: (x.expression as string).trim(),
      meaning: (x.meaning as string).trim(),
      example: (x.example as string).trim(),
    };
  });

  if (!Array.isArray(o.quiz)) throw new Error(`Stage 2 (${level}) quiz: not an array`);
  if (o.quiz.length < 3 || o.quiz.length > 6) {
    throw new Error(`Stage 2 (${level}) quiz: length ${o.quiz.length} outside [3, 6]`);
  }
  const quiz = o.quiz.map((q, i) => {
    if (typeof q !== "object" || q === null) throw new Error(`quiz[${i}]: not an object`);
    const x = q as Record<string, unknown>;
    for (const k of ["question", "answer"] as const) {
      if (typeof x[k] !== "string" || (x[k] as string).trim() === "") {
        throw new Error(`quiz[${i}].${k}: not a non-empty string`);
      }
    }
    const options = assertNonEmptyStringArray(x.options, `quiz[${i}].options`, 2, 5);
    const answer = (x.answer as string).trim();
    if (!options.includes(answer)) {
      throw new Error(`quiz[${i}].answer "${answer}" not in options [${options.join(", ")}]`);
    }
    return { question: (x.question as string).trim(), answer, options };
  });

  // KeyPhrase must appear case-insensitively somewhere in paragraphs.
  const haystack = paragraphs.join(" ").toLowerCase();
  if (!haystack.includes(keyPhrase.toLowerCase())) {
    throw new Error(
      `Stage 2 (${level}): keyPhrase "${keyPhrase}" not found in paragraphs`
    );
  }

  return { paragraphs, sentences, expressions, quiz, interview, speakSentences };
}

async function markStaleRunning(targetDate: Date): Promise<void> {
  const cutoff = new Date(Date.now() - STALE_RUNNING_MINUTES * 60 * 1000);
  await prisma.generationLog.updateMany({
    where: {
      targetDate,
      status: GenerationStatus.running,
      runAt: { lt: cutoff },
    },
    data: { status: GenerationStatus.failed, errorMessage: "stale running TTL" },
  });
}

async function assertNoRunning(targetDate: Date): Promise<void> {
  const existing = await prisma.generationLog.findFirst({
    where: { targetDate, status: GenerationStatus.running },
  });
  if (existing) {
    throw new GenerationConflictError(
      `Another generation for ${targetDate.toISOString().split("T")[0]} is already running`
    );
  }
}

async function handleOverwrite(targetDate: Date, overwrite: boolean): Promise<void> {
  const existing = await prisma.content.findFirst({
    where: { publishedAt: targetDate },
    select: { id: true },
  });
  if (!existing) return;
  if (!overwrite) {
    throw new GenerationConflictError(
      `Content already exists for ${targetDate.toISOString().split("T")[0]} (set overwrite=true to replace)`
    );
  }
  await prisma.content.delete({ where: { id: existing.id } }); // cascades variants
}

async function fetchRecentTopics(targetDate: Date): Promise<RecentTopicRef[]> {
  const cutoff = new Date(targetDate);
  cutoff.setUTCDate(cutoff.getUTCDate() - RECENT_TOPICS_DAYS);
  const rows = await prisma.content.findMany({
    where: {
      publishedAt: { lt: targetDate, gte: cutoff },
      isActive: true,
    },
    select: { genre: true, title: true, keyPhrase: true },
    orderBy: { publishedAt: "desc" },
  });
  return rows.map((r) => ({ genre: r.genre, title: r.title, keyPhrase: r.keyPhrase }));
}

async function runAttempt(
  targetDate: Date,
  attempt: number,
  providerInfo: { provider: "claude" | "openai"; apiKey: string; model: string }
): Promise<{ contentId: number; logId: number }> {
  const startedAt = Date.now();
  const log = await prisma.generationLog.create({
    data: {
      targetDate,
      status: GenerationStatus.running,
      provider: providerInfo.provider,
      model: providerInfo.model,
      attempt,
    },
  });

  try {
    const upcoming = await prisma.upcomingTopic.findUnique({
      where: { date: targetDate },
    });
    const recent = await fetchRecentTopics(targetDate);

    const stage1Ctx: Stage1Context = {
      recentTopics: recent,
      upcomingTopic: upcoming
        ? {
            genre: upcoming.genre,
            keyPhrase: upcoming.keyPhrase,
            keyKo: upcoming.keyKo,
            hint: upcoming.hint ?? null,
          }
        : undefined,
    };

    const s1Prompt = buildStage1Prompt(stage1Ctx);
    const s1Raw = await callAI(
      providerInfo.provider,
      providerInfo.apiKey,
      providerInfo.model,
      s1Prompt.system,
      s1Prompt.user
    );
    let stage1 = validateStage1(parseJsonLoose(s1Raw));

    // Override mode: server-wins on genre/keyPhrase/keyKo
    if (upcoming) {
      stage1 = {
        ...stage1,
        genre: upcoming.genre,
        keyPhrase: upcoming.keyPhrase,
        keyKo: upcoming.keyKo,
      };
    }

    const variantResults = await Promise.all(
      LEVELS.map(async (level) => {
        const p = buildStage2Prompt(stage1, level);
        const raw = await callAI(
          providerInfo.provider,
          providerInfo.apiKey,
          providerInfo.model,
          p.system,
          p.user
        );
        return { level, payload: validateStage2(parseJsonLoose(raw), stage1.keyPhrase, level) };
      })
    );

    const content = await prisma.$transaction(async (tx) => {
      const topic = await tx.content.create({
        data: {
          genre: stage1.genre,
          title: stage1.title,
          subtitle: stage1.subtitle,
          keyPhrase: stage1.keyPhrase,
          keyKo: stage1.keyKo,
          publishedAt: targetDate,
          priority: 0,
          isActive: true,
        },
      });
      for (const v of variantResults) {
        await tx.contentVariant.create({
          data: {
            contentId: topic.id,
            level: v.level,
            paragraphs: v.payload.paragraphs as unknown as Prisma.InputJsonValue,
            sentences: v.payload.sentences as unknown as Prisma.InputJsonValue,
            expressions: v.payload.expressions as unknown as Prisma.InputJsonValue,
            quiz: v.payload.quiz as unknown as Prisma.InputJsonValue,
            interview: v.payload.interview as unknown as Prisma.InputJsonValue,
            speakSentences: v.payload.speakSentences as unknown as Prisma.InputJsonValue,
          },
        });
      }
      return topic;
    });

    await prisma.generationLog.update({
      where: { id: log.id },
      data: {
        status: GenerationStatus.success,
        durationMs: Date.now() - startedAt,
        contentId: content.id,
      },
    });

    return { contentId: content.id, logId: log.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.generationLog.update({
      where: { id: log.id },
      data: {
        status: GenerationStatus.failed,
        durationMs: Date.now() - startedAt,
        errorMessage: message.slice(0, 2000),
      },
    });
    throw err;
  }
}

async function runFallback(
  targetDate: Date,
  providerInfo: { provider: "claude" | "openai"; apiKey: string; model: string }
): Promise<{ contentId: number | null; logId: number }> {
  const startedAt = Date.now();
  const log = await prisma.generationLog.create({
    data: {
      targetDate,
      status: GenerationStatus.running,
      provider: providerInfo.provider,
      model: providerInfo.model,
      attempt: 3, // sentinel: fallback pass
    },
  });

  const prev = await prisma.content.findFirst({
    where: { publishedAt: { lt: targetDate }, isActive: true },
    orderBy: { publishedAt: "desc" },
    include: { variants: true },
  });

  if (!prev) {
    await prisma.generationLog.update({
      where: { id: log.id },
      data: {
        status: GenerationStatus.failed,
        durationMs: Date.now() - startedAt,
        errorMessage: "fallback impossible: no previous content",
      },
    });
    return { contentId: null, logId: log.id };
  }

  const clone = await prisma.$transaction(async (tx) => {
    const c = await tx.content.create({
      data: {
        genre: prev.genre,
        title: prev.title,
        subtitle: prev.subtitle,
        keyPhrase: prev.keyPhrase,
        keyKo: prev.keyKo,
        publishedAt: targetDate,
        priority: 0,
        isActive: true,
        reusedFromContentId: prev.id,
      },
    });
    for (const v of prev.variants as ContentVariant[]) {
      await tx.contentVariant.create({
        data: {
          contentId: c.id,
          level: v.level,
          paragraphs: v.paragraphs as Prisma.InputJsonValue,
          sentences: v.sentences as Prisma.InputJsonValue,
          expressions: v.expressions as Prisma.InputJsonValue,
          quiz: v.quiz as Prisma.InputJsonValue,
          interview: v.interview as Prisma.InputJsonValue,
          speakSentences: v.speakSentences as Prisma.InputJsonValue,
        },
      });
    }
    return c;
  });

  await prisma.generationLog.update({
    where: { id: log.id },
    data: {
      status: GenerationStatus.fallback,
      durationMs: Date.now() - startedAt,
      contentId: clone.id,
    },
  });

  return { contentId: clone.id, logId: log.id };
}

export async function generateContentForDate(
  targetDate: Date,
  options?: { overwrite?: boolean }
): Promise<GenerationResult> {
  const overwrite = options?.overwrite ?? false;

  await markStaleRunning(targetDate);
  await assertNoRunning(targetDate);
  await handleOverwrite(targetDate, overwrite);

  const providerInfo = await getActiveProvider();

  try {
    const r1 = await runAttempt(targetDate, 1, providerInfo);
    return { status: "success", contentId: r1.contentId, logId: r1.logId };
  } catch {
    // First attempt failed, retry once
  }

  try {
    const r2 = await runAttempt(targetDate, 2, providerInfo);
    return { status: "success", contentId: r2.contentId, logId: r2.logId };
  } catch {
    // Second attempt failed, fall back
  }

  const fb = await runFallback(targetDate, providerInfo);
  if (fb.contentId === null) {
    return { status: "failed", contentId: null, logId: fb.logId };
  }
  return { status: "fallback", contentId: fb.contentId, logId: fb.logId };
}
```

### Step 4.2 — Verify build

- [ ] **Action:**

```bash
cd /var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines
pnpm build 2>&1 | tail -10
```

Must succeed. `@prisma/client` now exports `GenerationStatus` enum and `UpcomingTopic` model type.

### Step 4.3 — Commit

- [ ] **Action:**

```bash
cd /var/www/html/_______site_SORITUNECOM_ROUTINES
git add public_html/routines/src/lib/content-generation.ts
git status
git commit -m "$(cat <<'EOF'
feat(generation): generateContentForDate with retry + clone fallback

Implements the 2-stage AI generation pipeline defined in the spec.

Pre-flight: marks any running log older than 30 min as stale/failed
(auto-recovery for crashed runs), then refuses if a live running
row exists for the same targetDate (concurrency guard).

Stage 1 builds the shared topic info. When UpcomingTopic exists for
the target date, server overrides the AI's genre/keyPhrase/keyKo
with the admin-fixed values after Stage 1 parsing, so Stage 2
receives the authoritative topic info.

Stage 2 runs the 3 level prompts in parallel. Strict validation:
per-field types, array length bounds (paragraphs 2-5, sentences
4-10, expressions 3-6 with full object shape check, quiz 3-6 with
answer ∈ options enforced, interview/speakSentences 3-6), every
string non-empty after trim, keyPhrase case-insensitive substring
in paragraphs.

Failure path: one retry (attempt=2). If that also fails, runFallback
clones the most recent previous Content + its variants into a new
row with reusedFromContentId set and publishedAt=targetDate — never
mutates the origin.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Do NOT push.

---

## Task 5: Generation trigger + log API endpoints

Two new admin API routes. `generation/run` accepts either a Bearer token (cron) or an admin session (UI). `generation/log` returns recent entries for the admin UI.

**Files:**
- Create: `src/app/api/admin/generation/run/route.ts`
- Create: `src/app/api/admin/generation/log/route.ts`

### Step 5.1 — Create `src/app/api/admin/generation/run/route.ts`

- [ ] **Action:** Write the full file:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { tomorrowKSTDate } from "@/lib/date";
import {
  generateContentForDate,
  GenerationConflictError,
} from "@/lib/content-generation";

function parseDate(raw: unknown): Date | null {
  if (typeof raw !== "string") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

async function authorize(req: NextRequest): Promise<"cron" | "admin" | null> {
  const bearer = req.headers.get("authorization");
  const secret = process.env.GENERATION_CRON_SECRET;
  if (secret && bearer === `Bearer ${secret}`) return "cron";

  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (session?.user && role === "admin") return "admin";

  return null;
}

export async function POST(req: NextRequest) {
  const auth = await authorize(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown> = {};
  try {
    const text = await req.text();
    if (text.trim()) body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const targetDate = body.date !== undefined ? parseDate(body.date) : tomorrowKSTDate();
  if (!targetDate) {
    return NextResponse.json(
      { error: "date must be YYYY-MM-DD" },
      { status: 400 }
    );
  }

  const overwrite = body.overwrite === true;

  try {
    const result = await generateContentForDate(targetDate, { overwrite });
    const httpStatus = result.status === "failed" ? 500 : 200;
    return NextResponse.json(result, { status: httpStatus });
  } catch (err) {
    if (err instanceof GenerationConflictError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("generation/run unexpected error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

### Step 5.2 — Create `src/app/api/admin/generation/log/route.ts`

- [ ] **Action:** Write the full file:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";

export async function GET(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const limitParam = req.nextUrl.searchParams.get("limit");
  let limit = 10;
  if (limitParam !== null) {
    const n = parseInt(limitParam, 10);
    if (Number.isFinite(n) && n > 0 && n <= 100) limit = n;
  }

  const logs = await prisma.generationLog.findMany({
    orderBy: { runAt: "desc" },
    take: limit,
    select: {
      id: true,
      targetDate: true,
      runAt: true,
      status: true,
      provider: true,
      model: true,
      durationMs: true,
      contentId: true,
      errorMessage: true,
      attempt: true,
    },
  });

  return NextResponse.json(logs);
}
```

### Step 5.3 — Verify build

- [ ] **Action:**

```bash
cd /var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines
pnpm build 2>&1 | tail -10
```

Must succeed. Route table should include `/api/admin/generation/run` and `/api/admin/generation/log`.

### Step 5.4 — Commit

- [ ] **Action:**

```bash
cd /var/www/html/_______site_SORITUNECOM_ROUTINES
git add public_html/routines/src/app/api/admin/generation/
git status
git commit -m "$(cat <<'EOF'
feat(generation): /api/admin/generation/run + log endpoints

/run accepts either Authorization: Bearer <GENERATION_CRON_SECRET>
(for the 21:00 KST crontab) or an admin session cookie (for the
"run now" button). Body is optional; date defaults to
tomorrowKSTDate() so cron with empty body generates tomorrow's
content. overwrite=true deletes any existing content for the date
first. GenerationConflictError surfaces as 409; unexpected errors
as 500 with the message for admin visibility.

/log is admin-session only and returns the most recent N logs
(default 10, max 100) ordered by runAt desc, so the admin UI can
display the last-run summary and a short history.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Do NOT push.

---

## Task 6: UpcomingTopic CRUD API

Four endpoints behind `requireAdmin`.

**Files:**
- Create: `src/app/api/admin/topics/route.ts`
- Create: `src/app/api/admin/topics/[id]/route.ts`

### Step 6.1 — Create `src/app/api/admin/topics/route.ts`

- [ ] **Action:** Write the full file:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";

function parseDateString(raw: unknown): Date | null {
  if (typeof raw !== "string") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

interface TopicInput {
  date: Date;
  genre: string;
  keyPhrase: string;
  keyKo: string;
  hint: string | null;
}

function validateInput(data: Record<string, unknown>): TopicInput | string {
  const date = parseDateString(data.date);
  if (!date) return "date must be YYYY-MM-DD";
  for (const k of ["genre", "keyPhrase", "keyKo"] as const) {
    const v = data[k];
    if (typeof v !== "string" || v.trim() === "") {
      return `${k} is required and must be a non-empty string`;
    }
  }
  const hint =
    typeof data.hint === "string" && data.hint.trim() !== "" ? data.hint.trim() : null;
  return {
    date,
    genre: (data.genre as string).trim(),
    keyPhrase: (data.keyPhrase as string).trim(),
    keyKo: (data.keyKo as string).trim(),
    hint,
  };
}

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const topics = await prisma.upcomingTopic.findMany({
    orderBy: { date: "asc" },
  });
  return NextResponse.json(topics);
}

export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await req.json();
  const parsed = validateInput(body);
  if (typeof parsed === "string") {
    return NextResponse.json({ error: parsed }, { status: 400 });
  }

  try {
    const created = await prisma.upcomingTopic.create({
      data: parsed,
    });
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "A topic for this date already exists" },
        { status: 409 }
      );
    }
    throw err;
  }
}
```

### Step 6.2 — Create `src/app/api/admin/topics/[id]/route.ts`

- [ ] **Action:** Write the full file:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";

function parseDateString(raw: unknown): Date | null {
  if (typeof raw !== "string") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const idNum = parseInt(id, 10);
  if (!Number.isFinite(idNum)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const body = await req.json();
  const date = parseDateString(body.date);
  if (!date) return NextResponse.json({ error: "date must be YYYY-MM-DD" }, { status: 400 });
  for (const k of ["genre", "keyPhrase", "keyKo"] as const) {
    const v = body[k];
    if (typeof v !== "string" || v.trim() === "") {
      return NextResponse.json(
        { error: `${k} is required and must be a non-empty string` },
        { status: 400 }
      );
    }
  }
  const hint =
    typeof body.hint === "string" && body.hint.trim() !== "" ? body.hint.trim() : null;

  try {
    const updated = await prisma.upcomingTopic.update({
      where: { id: idNum },
      data: {
        date,
        genre: (body.genre as string).trim(),
        keyPhrase: (body.keyPhrase as string).trim(),
        keyKo: (body.keyKo as string).trim(),
        hint,
      },
    });
    return NextResponse.json(updated);
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Another topic for this date already exists" },
        { status: 409 }
      );
    }
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: string }).code === "P2025"
    ) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    throw err;
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const idNum = parseInt(id, 10);
  if (!Number.isFinite(idNum)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    await prisma.upcomingTopic.delete({ where: { id: idNum } });
    return NextResponse.json({ success: true });
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: string }).code === "P2025"
    ) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    throw err;
  }
}
```

### Step 6.3 — Verify build

- [ ] **Action:**

```bash
cd /var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines
pnpm build 2>&1 | tail -10
```

Must succeed.

### Step 6.4 — Commit

- [ ] **Action:**

```bash
cd /var/www/html/_______site_SORITUNECOM_ROUTINES
git add public_html/routines/src/app/api/admin/topics/
git status
git commit -m "$(cat <<'EOF'
feat(generation): UpcomingTopic CRUD API (admin only)

GET list (date asc), POST to schedule a topic override. PUT/DELETE
by id. Server validates YYYY-MM-DD date format, requires genre/
keyPhrase/keyKo as non-empty strings, optional hint. Prisma P2002
unique-conflict on date surfaces as 409, P2025 as 404.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Do NOT push.

---

## Task 7: Admin UI — /admin/topics page + components + sidebar link

**Files:**
- Create: `src/components/admin/generation-trigger.tsx`
- Create: `src/components/admin/upcoming-topic-form.tsx`
- Create: `src/app/(admin)/admin/topics/page.tsx`
- Modify: `src/components/admin/sidebar.tsx`

### Step 7.1 — Create `src/components/admin/generation-trigger.tsx`

- [ ] **Action:** Write the full file:

```typescript
"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface GenerationLogEntry {
  id: number;
  targetDate: string;
  runAt: string;
  status: "running" | "success" | "failed" | "fallback";
  provider: string | null;
  model: string | null;
  durationMs: number | null;
  contentId: number | null;
  errorMessage: string | null;
  attempt: number;
}

function tomorrowISO(): string {
  const d = new Date(
    new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" })
  );
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().split("T")[0];
}

export function GenerationTrigger() {
  const [date, setDate] = useState<string>(tomorrowISO);
  const [overwrite, setOverwrite] = useState(false);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [lastLog, setLastLog] = useState<GenerationLogEntry | null>(null);

  const loadLastLog = useCallback(async () => {
    const res = await fetch("/api/admin/generation/log?limit=1");
    if (!res.ok) return;
    const rows = (await res.json()) as GenerationLogEntry[];
    setLastLog(rows[0] ?? null);
  }, []);

  useEffect(() => {
    loadLastLog();
  }, [loadLastLog]);

  async function handleRun() {
    setRunning(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/generation/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, overwrite }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({
          type: "ok",
          text: `${data.status === "success" ? "생성 완료" : data.status === "fallback" ? "폴백 복제" : "실패"} · Content #${data.contentId ?? "-"}`,
        });
      } else {
        setMessage({ type: "err", text: data.error ?? "실행 실패" });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "네트워크 오류";
      setMessage({ type: "err", text: msg });
    }
    setRunning(false);
    loadLastLog();
  }

  return (
    <section className="bg-near-black rounded-xl p-6 border border-white/5 mb-8">
      <h2 className="text-[18px] font-semibold text-white mb-4">수동 생성</h2>

      <div className="flex items-end gap-4 flex-wrap">
        <div className="min-w-[180px]">
          <Input
            label="날짜"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <label className="flex items-center gap-2 text-[14px] text-white cursor-pointer pb-2">
          <input
            type="checkbox"
            checked={overwrite}
            onChange={(e) => setOverwrite(e.target.checked)}
            className="w-4 h-4"
          />
          덮어쓰기
        </label>
        <Button onClick={handleRun} disabled={running}>
          {running ? "생성 중..." : "지금 실행"}
        </Button>
      </div>

      {message && (
        <p
          className={`mt-4 text-[13px] ${message.type === "ok" ? "text-framer-blue" : "text-red-400"}`}
        >
          {message.text}
        </p>
      )}

      {lastLog && (
        <div className="mt-6 pt-4 border-t border-white/5 text-[13px] text-muted-silver">
          <span className="text-white/70">마지막 실행: </span>
          {new Date(lastLog.runAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}
          {" · "}
          <span
            className={
              lastLog.status === "success"
                ? "text-green-400"
                : lastLog.status === "fallback"
                  ? "text-yellow-400"
                  : lastLog.status === "failed"
                    ? "text-red-400"
                    : "text-white/70"
            }
          >
            {lastLog.status}
          </span>
          {lastLog.contentId !== null && <> · Content #{lastLog.contentId}</>}
          {lastLog.durationMs !== null && <> · {(lastLog.durationMs / 1000).toFixed(1)}s</>}
          {lastLog.errorMessage && (
            <div className="mt-1 text-red-400/80 text-[12px]">{lastLog.errorMessage}</div>
          )}
        </div>
      )}
    </section>
  );
}
```

### Step 7.2 — Create `src/components/admin/upcoming-topic-form.tsx`

- [ ] **Action:** Write the full file:

```typescript
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface UpcomingTopicRow {
  id: number;
  date: string;
  genre: string;
  keyPhrase: string;
  keyKo: string;
  hint: string | null;
}

interface Props {
  initial?: UpcomingTopicRow;
  onSaved: () => void;
  onCancel: () => void;
}

export function UpcomingTopicForm({ initial, onSaved, onCancel }: Props) {
  const isEdit = !!initial;
  const [date, setDate] = useState(initial?.date.split("T")[0] ?? "");
  const [genre, setGenre] = useState(initial?.genre ?? "");
  const [keyPhrase, setKeyPhrase] = useState(initial?.keyPhrase ?? "");
  const [keyKo, setKeyKo] = useState(initial?.keyKo ?? "");
  const [hint, setHint] = useState(initial?.hint ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);

    const body = {
      date,
      genre: genre.trim(),
      keyPhrase: keyPhrase.trim(),
      keyKo: keyKo.trim(),
      hint: hint.trim() || undefined,
    };

    const url = isEdit ? `/api/admin/topics/${initial!.id}` : "/api/admin/topics";
    const method = isEdit ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "저장 실패");
      return;
    }

    onSaved();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-near-black rounded-xl p-6 border border-white/5">
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="날짜"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />
        <Input
          label="장르"
          value={genre}
          onChange={(e) => setGenre(e.target.value)}
          placeholder="Workplace"
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="핵심 표현 (영)"
          value={keyPhrase}
          onChange={(e) => setKeyPhrase(e.target.value)}
          placeholder="burn out"
          required
        />
        <Input
          label="핵심 표현 (한)"
          value={keyKo}
          onChange={(e) => setKeyKo(e.target.value)}
          placeholder="번아웃 되다"
          required
        />
      </div>
      <div>
        <label className="text-[13px] font-medium text-muted-silver block mb-2">
          힌트 (선택)
        </label>
        <textarea
          value={hint}
          onChange={(e) => setHint(e.target.value)}
          placeholder="AI 에게 추가 컨텍스트를 줄 수 있는 한 두 문장"
          className="w-full bg-void-black border border-white/10 rounded-xl px-4 py-3 text-[13px] text-white leading-[1.6] placeholder:text-white/40 focus:border-framer-blue focus:outline-none min-h-[80px] resize-y"
        />
      </div>

      {error && <p className="text-red-400 text-[13px]">{error}</p>}

      <div className="flex gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? "저장 중..." : isEdit ? "수정" : "추가"}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          취소
        </Button>
      </div>
    </form>
  );
}
```

### Step 7.3 — Create `src/app/(admin)/admin/topics/page.tsx`

- [ ] **Action:** Write the full file:

```typescript
"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { GenerationTrigger } from "@/components/admin/generation-trigger";
import {
  UpcomingTopicForm,
  UpcomingTopicRow,
} from "@/components/admin/upcoming-topic-form";

function formatDate(iso: string): string {
  return iso.split("T")[0];
}

function todayKSTDateStr(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
}

export default function AdminTopicsPage() {
  const [topics, setTopics] = useState<UpcomingTopicRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<UpcomingTopicRow | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/topics");
    if (res.ok) setTopics(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDelete(id: number) {
    if (!confirm("이 예약을 삭제하시겠습니까?")) return;
    await fetch(`/api/admin/topics/${id}`, { method: "DELETE" });
    load();
  }

  const today = todayKSTDateStr();

  return (
    <div className="max-w-[960px]">
      <h1 className="text-[24px] font-semibold tracking-[-0.01px] mb-6">주제 스케줄</h1>

      <GenerationTrigger />

      <section className="bg-near-black rounded-xl p-6 border border-white/5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[18px] font-semibold text-white">예약된 주제</h2>
          {!creating && !editing && (
            <Button onClick={() => setCreating(true)}>+ 새 주제 예약</Button>
          )}
        </div>

        {(creating || editing) && (
          <div className="mb-6">
            <UpcomingTopicForm
              initial={editing ?? undefined}
              onSaved={() => {
                setCreating(false);
                setEditing(null);
                load();
              }}
              onCancel={() => {
                setCreating(false);
                setEditing(null);
              }}
            />
          </div>
        )}

        {loading ? (
          <p className="text-muted-silver text-[14px]">로딩 중...</p>
        ) : topics.length === 0 ? (
          <p className="text-muted-silver text-[14px]">예약된 주제가 없습니다.</p>
        ) : (
          <table className="w-full text-[14px]">
            <thead>
              <tr className="text-left text-muted-silver border-b border-white/5">
                <th className="py-2">날짜</th>
                <th className="py-2">장르</th>
                <th className="py-2">핵심 표현</th>
                <th className="py-2">힌트</th>
                <th className="py-2 w-[120px]">액션</th>
              </tr>
            </thead>
            <tbody>
              {topics.map((t) => {
                const past = formatDate(t.date) < today;
                return (
                  <tr
                    key={t.id}
                    className={`border-b border-white/5 ${past ? "opacity-50" : ""}`}
                  >
                    <td className="py-3 text-white">{formatDate(t.date)}</td>
                    <td className="py-3 text-white/80">{t.genre}</td>
                    <td className="py-3 text-white/80">
                      <div>{t.keyPhrase}</div>
                      <div className="text-[12px] text-muted-silver">{t.keyKo}</div>
                    </td>
                    <td className="py-3 text-white/60 text-[12px] max-w-[240px] truncate">
                      {t.hint ?? "-"}
                    </td>
                    <td className="py-3">
                      <div className="flex gap-2">
                        <Button variant="ghost" onClick={() => setEditing(t)}>
                          수정
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => handleDelete(t.id)}
                        >
                          삭제
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
```

### Step 7.4 — Modify `src/components/admin/sidebar.tsx`

- [ ] **Action:** Add the new link. Change the `links` array (lines 6-11) to include a new entry before AI 설정:

```typescript
const links = [
  { href: "/admin", label: "대시보드" },
  { href: "/admin/content", label: "콘텐츠" },
  { href: "/admin/topics", label: "주제 스케줄" },
  { href: "/admin/users", label: "회원" },
  { href: "/admin/settings", label: "AI 설정" },
];
```

Everything else in the file stays identical.

### Step 7.5 — Verify build

- [ ] **Action:**

```bash
cd /var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines
pnpm build 2>&1 | tail -15
```

Must succeed. Route table should include `/admin/topics` under the admin group.

### Step 7.6 — Commit

- [ ] **Action:**

```bash
cd /var/www/html/_______site_SORITUNECOM_ROUTINES
git add public_html/routines/src/components/admin/generation-trigger.tsx
git add public_html/routines/src/components/admin/upcoming-topic-form.tsx
git add public_html/routines/src/app/\(admin\)/admin/topics/page.tsx
git add public_html/routines/src/components/admin/sidebar.tsx
git status
git commit -m "$(cat <<'EOF'
feat(admin): /admin/topics page with scheduler + run-now button

GenerationTrigger renders the manual trigger block (date picker
defaulting to tomorrow KST, overwrite toggle, last-run summary).
UpcomingTopicForm handles both create and edit by checking initial
prop. The page composes both components + a list table of topics
ordered by date; rows whose date is in the past are dimmed.

Sidebar gains "주제 스케줄" between 콘텐츠 and 회원.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Do NOT push.

---

## Task 8: Deploy + cron setup + end-to-end verify + push

### Step 8.1 — Generate `GENERATION_CRON_SECRET`

- [ ] **Action:**

```bash
openssl rand -hex 32
```

Copy the 64-hex output. This is the shared secret between `.env.local` and `/root/.routines-cron-env`.

### Step 8.2 — Append secret to `.env.local`

- [ ] **Action:** Append the line. Do NOT overwrite the file.

```bash
cd /var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines
echo "" >> .env.local
echo "# Generation cron shared secret" >> .env.local
echo "GENERATION_CRON_SECRET=<PASTE THE HEX HERE>" >> .env.local
```

Verify no duplicate:

```bash
grep -c GENERATION_CRON_SECRET .env.local
```

Expected: `1`.

### Step 8.3 — Apply migration to production DB

- [ ] **Action:**

```bash
cd /var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines
pnpm prisma migrate deploy 2>&1 | tail -10
```

Expected: `The following migration(s) have been applied: <ts>_add_generation_tables`. No reset warnings.

### Step 8.4 — Rebuild + PM2 reload

- [ ] **Action:**

```bash
pnpm build 2>&1 | tail -8
pm2 reload ecosystem.config.js --update-env 2>&1 | tail -3
sleep 2
pm2 logs routines --lines 5 --nostream 2>&1 | tail -8
```

Expected: build success, PM2 `✓`, logs show `Ready in …`.

### Step 8.5 — Verify AISetting exists

- [ ] **Action:**

```bash
node -e '
import("./node_modules/@prisma/client/index.js").then(async ({PrismaClient}) => {
  const p = new PrismaClient();
  const a = await p.aISetting.findFirst({ where: { isActive: true } });
  console.log(a ? `active: ${a.provider} / ${a.model}` : "no active AISetting — register via /admin/settings");
  await p.$disconnect();
});
' 2>&1 | tail -3
```

If no active AISetting, log into `/admin/login` → `/admin/settings` and add one (Claude or OpenAI, valid key, model like `claude-sonnet-4-5` or `gpt-4o-mini`). **This is required before any generation will work.**

### Step 8.6 — End-to-end manual trigger (from the server)

- [ ] **Action:** First, check what tomorrow's KST date is:

```bash
node -e 'const d = new Date(new Date().toLocaleDateString("en-CA",{timeZone:"Asia/Seoul"})); d.setUTCDate(d.getUTCDate()+1); console.log(d.toISOString().split("T")[0]);'
```

Use that date below. Run a Bearer-auth call (simulates cron) with overwrite=false first. If a Content already exists for that date (e.g. from earlier test), either use overwrite or a different date:

```bash
SECRET=$(grep '^GENERATION_CRON_SECRET=' /var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines/.env.local | cut -d= -f2-)
curl -sS -X POST \
  -H "Authorization: Bearer $SECRET" \
  -H "Content-Type: application/json" \
  -d '{}' \
  http://localhost:3000/api/admin/generation/run
echo
```

Expected: JSON `{ "status": "success", "contentId": <int>, "logId": <int> }` (or 409 if content exists — rerun with `-d '{"overwrite":true}'` if so).

If the response is `{"status":"failed"}` check `/admin/generation/log?limit=3` (via cookie-auth or `SELECT * FROM generation_logs ORDER BY run_at DESC LIMIT 3;`). Common failure causes:
- No active AISetting (Step 8.5 was skipped)
- Stage 2 validation failure (model output doesn't match schema — iterate prompts or try a different model)
- Provider API key invalid / quota exceeded

### Step 8.7 — Verify DB shape

- [ ] **Action:** Inspect via Node:

```bash
cd /var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines
node -e '
import("./node_modules/@prisma/client/index.js").then(async ({PrismaClient}) => {
  const p = new PrismaClient();
  const log = await p.generationLog.findFirst({ orderBy: { runAt: "desc" } });
  console.log("log:", log);
  if (log?.contentId) {
    const c = await p.content.findUnique({ where: { id: log.contentId }, include: { variants: true } });
    console.log("content:", {
      id: c.id, title: c.title, publishedAt: c.publishedAt,
      levelsPresent: c.variants.map(v => v.level),
    });
  }
  await p.$disconnect();
});
' 2>&1 | tail -20
```

Expected: recent log `status=success`, content row has all 3 variant levels.

### Step 8.8 — Install the cron

- [ ] **Action:** Create the env file for cron (root-owned, 600 perms):

```bash
cat > /root/.routines-cron-env <<EOF
export GENERATION_CRON_SECRET=$(grep '^GENERATION_CRON_SECRET=' /var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines/.env.local | cut -d= -f2-)
EOF
chmod 600 /root/.routines-cron-env
cat /root/.routines-cron-env
```

Expected: file shows `export GENERATION_CRON_SECRET=<hex>`.

Install the crontab entry. Use root's crontab (which is where the system services live). Run `crontab -e` or append programmatically:

```bash
( crontab -l 2>/dev/null | grep -v routines-cron; echo 'SHELL=/bin/bash'; echo 'PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'; echo '0 21 * * * . /root/.routines-cron-env && /usr/bin/curl -sS -X POST -H "Authorization: Bearer ${GENERATION_CRON_SECRET}" -H "Content-Type: application/json" -d "{}" http://localhost:3000/api/admin/generation/run >> /var/log/routines-cron.log 2>&1' ) | crontab -
crontab -l
```

Expected: listing shows the SHELL, PATH, and the 21:00 entry. Create/touch the log file:

```bash
touch /var/log/routines-cron.log
chmod 644 /var/log/routines-cron.log
```

### Step 8.9 — Browser smoke test

- [ ] **Action (human):** Open a browser and log in at `https://routines.soritune.com/admin/login`. Go to `/admin/topics`:

1. "수동 생성" 블록이 보임. 날짜 입력 기본값 = 내일.
2. 새 주제 예약 클릭 → 내일+1 날짜로 topic 추가 (예: genre=Workplace, keyPhrase=take on, keyKo=맡다, hint=새 역할을 맡는 상황).
3. 수동 생성 블록에서 날짜를 내일+1 로 바꾸고 "지금 실행" 클릭 (overwrite off).
4. `마지막 실행` 섹션이 success 로 갱신.
5. `/admin/content` 이동 → 새 Content 가 등록되어 있음. 편집 → 3탭 전부 채워져 있음 + keyPhrase "take on" 이 paragraphs 에 포함.
6. 이번엔 `/admin/topics` 로 돌아와 같은 날짜로 다시 "지금 실행" (overwrite on) → 기존 Content 삭제 + 새 생성 (Content id 증가). 로그는 2건 이상.
7. 덮어쓰기 없이 같은 날짜 재실행 → 409 에러 메시지 표시.
8. 사용자 시크릿 창으로 `/today` 접근 → 레벨 선택 → 오늘의 콘텐츠 여전히 정상 (내일 자 콘텐츠는 아직 노출되지 않음).

### Step 8.10 — Push

- [ ] **Action:**

```bash
cd /var/www/html/_______site_SORITUNECOM_ROUTINES
git log --oneline origin/main..HEAD
git push origin main 2>&1 | tail -6
```

Expected: 7 commits pushed (Task 1 through Task 7). Task 8 has no source commits.

---

## Completion Checklist

- [ ] `todayKSTDate` / `tomorrowKSTDate` live in `src/lib/date.ts`; `/api/content/today` uses them
- [ ] `UpcomingTopic` table exists in DB; `GenerationLog` table exists; `Content.reused_from_content_id` column added
- [ ] `prisma/migrations/<ts>_add_generation_tables/` is tracked by git
- [ ] `src/lib/generation-prompts.ts` exports `buildStage1Prompt`, `buildStage2Prompt`, `Level`, `Stage1Context`, `Stage1Result`, `RecentTopicRef`
- [ ] `src/lib/content-generation.ts` exports `generateContentForDate`, `GenerationConflictError`, `GenerationResult`
- [ ] `POST /api/admin/generation/run` accepts Bearer + admin session; returns 401/400/409/200/500 as specified
- [ ] `GET /api/admin/generation/log?limit=` returns logs in `runAt desc` order
- [ ] `/api/admin/topics` CRUD is admin-only, validates required fields, returns 409 on date conflict
- [ ] `/admin/topics` page renders with both components, sidebar shows the link
- [ ] `GENERATION_CRON_SECRET` is in `.env.local` and `/root/.routines-cron-env`; the two values match
- [ ] crontab -l shows the 21:00 entry and `/var/log/routines-cron.log` exists
- [ ] First manual trigger succeeded end-to-end and the resulting Content has all 3 variants with keyPhrase present
- [ ] `git push origin main` succeeded

# Category & Level Redesign — Design Spec

**Date:** 2026-04-24
**Status:** Approved (awaiting implementation plan)
**Scope:** routines.soritune.com

## Goal

Retarget Routines for Korean learners in their 40s–50s by:
1. Rewriting article difficulty levels to match Korean elementary / middle-high / adult reading ability.
2. Replacing free-form English genres with 5 Korean lifestyle categories, driven by a curated subtopic pool.
3. Regenerating the existing 6 test articles under the new rules.

Tone shifts from "neutral learning material" toward **short lifestyle magazine column**: hook → concrete detail → takeaway.

## Non-goals

- Schema rename (`genre` → `category`). Columns stay named `genre`; only the value domain changes (app-level constraint, no DB enum). Revisit after pilot settles.
- Complex per-user level selection logic changes (existing `Level` storage key stays as-is).
- UI visual redesign — reuses the magazine-tone UI from 2026-04-23 redesign.

## Categories

Exactly 5 categories, stored as Korean strings in `contents.genre` and `upcoming_topics.genre`:

| Category | Scope |
|---|---|
| 웰빙 | 건강, 수면, 운동, 스트레스, 식단, 갱년기, 혈압, 명상 |
| 교육 | 자녀교육, 학습 동기, 진로, 청소년 심리, 부모-자녀 소통 |
| 자기개발 | 은퇴 준비, 재테크, 커리어 전환, 평생 학습, 시간 관리 |
| 환경 | 플라스틱 줄이기, 재활용, 에너지, 기후, 지속가능성 |
| 일상 | 가족 식사, 이웃, 산책, 부모 돌봄, 주말 취미 |

## Level Spec

Replaces the `LEVEL_SPEC` object in `src/lib/generation-prompts.ts`.

### Common style rules (added to all levels)

```
Style: short lifestyle magazine column — NOT a personal essay, NOT a textbook.
Structure: 2-3 short paragraphs. Hook (observation or trend)
  → concrete detail (fact, data, or example)
  → takeaway or gentle recommendation.
Use "I" or "we" when natural; avoid meandering reflection.
Concrete > abstract. Specific numbers/examples are welcome.
End with a line that gives the reader something to try or remember.
Target reader: Korean adult in their 40s-50s.
```

### beginner

- Audience: Korean elementary school student reading level (CEFR A1).
- Sentence length: **5–9 words**.
- Vocabulary: basic everyday words only (go, eat, take, walk, home, friend, morning, mood).
- Grammar: present simple by default; past simple only when unavoidable.
- Forbidden: idioms, phrasal verbs, passive voice, relative clauses.
- Paragraph: 4–6 sentences.

### intermediate

- Audience: Korean middle/high school student level (CEFR A2–B1).
- Sentence length: **10–16 words**.
- Vocabulary: common phrasal verbs and accessible idioms (run into, head to, have trouble, keep up).
- Grammar: mix of tenses; some compound sentences; avoid heavy subordination.

### advanced

- Audience: educated Korean adult who has studied English (CEFR B1–B2). **Not native register.**
- Sentence length: **14–22 words**.
- Vocabulary: abstract vocabulary and common collocations are fine.
- Forbidden at this level: obscure/literary vocabulary (e.g., "seismic", "relentless", "the landscape of X"), dense subordinate clauses, academic register.
- Keep prose warm and readable. "Polished but not literary."

## Reference Samples (approved 2026-04-24)

### Sample A — 아침 산책 (웰빙 / `take a walk`)

**beginner**
> These days, more people take a walk in the morning.
> It is easy and free. Anyone can do it.
> Walking makes your body strong. It also makes your mood better.
> I take a walk every morning before work.
> My body feels better. My mind feels better too.

**intermediate**
> Doctors say a short morning walk is one of the easiest ways to start the day right.
> Even 15 minutes outside can lower your stress and help you focus at work.
> I started to take a walk every morning after breakfast, and the change was clear.
> I slept better at night, and I felt less tired during the day.
> If you're not into exercise, taking a walk is the easiest place to start.

**advanced**
> It may sound too simple, but a short morning walk might be one of the smartest health habits we have.
> Studies suggest that just 20 minutes of walking a day can lower blood pressure, improve sleep, and reduce stress.
> The best part is that it costs nothing and fits into almost any schedule.
> I've made it a habit to take a walk before starting work, and the difference is hard to describe.
> My head feels clearer, my mood is steadier, and small worries seem less heavy.
> If you're looking for one thing to change this year, a daily walk is a good place to begin.

### Sample B — 부모님 안부 전화 (일상 / `check in on`)

**beginner**
> Many adults forget to call their parents often.
> Life is busy. Work takes a lot of time.
> But a short phone call is very special.
> I call my mom and dad every Sunday.
> I just want to check in on them.
> They are always happy to hear my voice.

**intermediate**
> Many of us talk to friends every day but forget to call our parents for weeks.
> A weekly phone call takes only 10 minutes, but it means a lot to them.
> I started to check in on my parents every Sunday evening after dinner.
> My mom talks about her week, and my dad shares small news from home.
> These short calls keep our family close, even when we live far apart.

**advanced**
> Experts often talk about family bonds, but they rarely mention something simple: the weekly phone call.
> Many adults say they are too busy to call their parents, but a quick 10-minute call can mean more than any gift.
> I make a point to check in on my parents every Sunday, even when I'm tired.
> My mother shares news from the neighborhood, and my father updates me on his garden.
> These quiet conversations remind me that being a good son or daughter doesn't require much — just showing up.
> As our parents grow older, these calls may turn out to be the most important routine we ever build.

## Expression Level Comparison — Reference

For the key phrase `take a walk`, Korean `meaning` and `explanation` should differ by level like this:

| Level | meaning (Korean, 1 sentence) | explanation (Korean, 2–3 sentences) |
|---|---|---|
| beginner | 산책하다. 잠깐 밖에서 걷다. | 잠깐 걸으며 바깥 공기를 쐬는 거예요. 'take a walk'은 짧게 걷는 거예요. 매일 하면 기분이 좋아져요. |
| intermediate | 산책하다. 기분 전환을 위해 잠깐 밖에 나가 걷다. | 짧고 가벼운 산책을 의미한다. 운동보다는 기분 전환·휴식 용도로 쓴다. 비슷한 'go for a walk'과 바꿔 쓸 수 있지만 'take'가 더 일상적이다. |
| advanced | 짧은 산책을 나가다. 일상에서 잠시 벗어나 호흡을 고르다. | 주로 짧고 목적 없이 하는 걷기를 가리킨다. 자주 쓰이는 연어는 'take a walk in the park', 'take a walk around the block'이다. 참고로 구어에서 "Take a walk!"은 맥락에 따라 "꺼져/그 얘기 그만"이라는 속어로도 쓰인다. |

## Data Model

### New table: `topic_pool`

```sql
CREATE TABLE topic_pool (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  category        VARCHAR(20)  NOT NULL,   -- "웰빙"|"교육"|"자기개발"|"환경"|"일상"
  subtopic_ko     VARCHAR(255) NOT NULL,
  key_phrase_en   VARCHAR(255) NOT NULL,
  key_ko          VARCHAR(255) NOT NULL,
  last_used_at    DATE         NULL,
  use_count       INT          NOT NULL DEFAULT 0,
  is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
  notes           TEXT         NULL,
  created_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                               ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX idx_category_last_used (category, last_used_at)
);
```

Prisma model:
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

  @@index([category, lastUsedAt])
  @@map("topic_pool")
}
```

### New table: `category_rotation_state`

Singleton row (id always = 1).

```sql
CREATE TABLE category_rotation_state (
  id             INT PRIMARY KEY,
  last_category  VARCHAR(20) NULL,
  last_used_at   DATE        NULL,
  updated_at     DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                             ON UPDATE CURRENT_TIMESTAMP(3)
);
INSERT INTO category_rotation_state (id) VALUES (1);
```

Prisma model:
```prisma
model CategoryRotationState {
  id           Int       @id
  lastCategory String?   @map("last_category") @db.VarChar(20)
  lastUsedAt   DateTime? @map("last_used_at") @db.Date
  updatedAt    DateTime  @updatedAt @map("updated_at")

  @@map("category_rotation_state")
}
```

## Category Rotation Logic

Order: `[웰빙, 교육, 자기개발, 환경, 일상]`. Wraps after 5.

Daily generation:

```
1. If upcoming_topics has a row for today's date:
     use its (category, keyPhrase, keyKo) — existing behavior, highest priority.

2. Otherwise:
   a. category := next in rotation after rotation_state.last_category
      (if last_category is NULL, start at "웰빙")
   b. topic := topic_pool row with
        category = category AND is_active = TRUE
      ordered by (last_used_at ASC NULLS FIRST, use_count ASC, id ASC)
      LIMIT 1
   c. If no topic available for that category, fall back to next category in rotation.
      (Should not happen with a properly seeded pool; log an error.)
   d. On successful content generation:
        UPDATE topic_pool SET last_used_at = <today>, use_count = use_count + 1
          WHERE id = topic.id;
        UPDATE category_rotation_state SET last_category = <category>, last_used_at = <today>
          WHERE id = 1;
```

## Prompt Changes

### `src/lib/generation-prompts.ts`

1. `buildStage1Prompt`:
   - Genre enum in system prompt changes to exactly: `웰빙, 교육, 자기개발, 환경, 일상`.
   - Add a line: when an `upcoming_topic` (or `topic_pool` pick) is provided, the Stage 1 model MUST use the given category + keyPhrase + keyKo verbatim and only generate `title` / `subtitle`.

2. `LEVEL_SPEC` for all three levels: replace with new spec from "Level Spec" section above.

3. Add the **common style rules** block (magazine column structure) to every Stage 2 system prompt, appearing above the per-level spec.

### Stage 2 example comparison

The existing example in the prompt (using "make a good impression") is retained — it still illustrates the Korean-explanation differential across levels. No change needed.

## Existing Content Migration

All 6 existing articles (id 21–26, 2026-04-20 through 2026-04-25) are deleted and regenerated under the new rules.

### Delete order (FK dependencies)

```
1. analytics_events WHERE content_id IN (21,22,23,24,25,26)
2. shares           WHERE content_id IN (...)
3. user_progress    WHERE content_id IN (...)
4. interview_answers WHERE content_id IN (...)
5. recordings       WHERE content_id IN (...)
   (also delete the actual audio files under uploads/<content_id>/)
6. generation_logs  WHERE content_id IN (...)      -- SetNull in schema; clean up anyway
7. content_variants WHERE content_id IN (...)
8. contents         WHERE id IN (21..26)
```

Pre-delete: `mysqldump SORITUNECOM_ROUTINES > /tmp/routines_backup_pre_category_redesign.sql`.

### Regenerate

Schedule: 5-day rotation starting from 2026-04-20.

| Date | Category | Pool subtopic (pre-selected) |
|---|---|---|
| 2026-04-20 | 웰빙 | 아침 산책 습관 |
| 2026-04-21 | 교육 | 자녀와 소통 |
| 2026-04-22 | 자기개발 | 은퇴 준비 |
| 2026-04-23 | 환경 | 플라스틱 줄이기 |
| 2026-04-24 | 일상 | 부모님 안부 전화 |
| 2026-04-25 | 웰빙 | 깊은 숙면 |

Regeneration mechanism: insert 6 rows into `upcoming_topics` with these fixed values, then trigger the normal generation path for each date. After all 6 succeed, `upcoming_topics` rows may remain (they only apply to their date).

## Admin UI

### Modified

- `src/components/admin/content-topic-fields.tsx` : `genre` free-text input → `<select>` with 5 options (`웰빙`, `교육`, `자기개발`, `환경`, `일상`).
- `src/components/admin/upcoming-topic-form.tsx` : same dropdown.

### New: `/admin/topic-pool`

- List view: table grouped or filtered by category.
- Columns: `subtopic_ko | key_phrase_en | key_ko | last_used_at | use_count | is_active | [edit] [delete]`.
- Add-new form (inline or modal) with the same fields.
- API endpoints:
  - `GET  /api/admin/topic-pool`         — list (optional `?category=...`)
  - `POST /api/admin/topic-pool`         — create
  - `PATCH /api/admin/topic-pool/[id]`   — update (including toggle `is_active`)
  - `DELETE /api/admin/topic-pool/[id]`  — delete
- Nav link added to admin sidebar: **주제 풀**.

All admin endpoints require `requireAdmin()`.

## Initial Topic Pool Seed

10 subtopics per category × 5 categories = **50 seed rows**. Insert via Prisma seed script (`prisma/seed.ts` addition) or SQL migration file. All seed rows: `is_active = TRUE`, `last_used_at = NULL`, `use_count = 0`.

### 웰빙 (10)

| subtopic_ko | key_phrase_en | key_ko |
|---|---|---|
| 아침 산책 습관 | take a walk | 산책하다 |
| 깊은 숙면 | get a good night's sleep | 숙면을 취하다 |
| 스트레스 관리 | keep stress in check | 스트레스 관리 |
| 건강한 식단 유지 | stick to a healthy diet | 건강식 유지 |
| 갱년기 증상 다루기 | deal with | 잘 다루다 |
| 명상 루틴 | clear your mind | 머리를 비우다 |
| 혈압 관리 | keep an eye on | 주시하다 |
| 수분 섭취 | stay hydrated | 수분 유지 |
| 무리 없는 운동 | work out | 운동하다 |
| 체중 관리 | keep the weight off | 살이 찌지 않게 유지하다 |

### 교육 (10)

| subtopic_ko | key_phrase_en | key_ko |
|---|---|---|
| 자녀와 소통 | open up to | 마음을 열다 |
| 학습 동기 부여 | be motivated | 동기부여되다 |
| 진로 고민 함께하기 | figure out | 알아내다 |
| 대학 입시 스트레스 | under pressure | 압박을 받다 |
| 자녀 사춘기 이해 | go through | 겪다 |
| 잔소리 줄이기 | back off | 물러서다 |
| 독서 습관 들이기 | make a habit of | 습관이 되다 |
| 스마트폰 사용 규칙 | set boundaries | 한계를 정하다 |
| 자존감 키우기 | believe in yourself | 자신을 믿다 |
| 실패에서 배우기 | learn from mistakes | 실수에서 배우다 |

### 자기개발 (10)

| subtopic_ko | key_phrase_en | key_ko |
|---|---|---|
| 은퇴 준비 | plan ahead | 미리 계획하다 |
| 새로운 기술 배우기 | pick up | 익히다 |
| 재테크 기초 | set aside | 따로 떼어두다 |
| 평생 독서 습관 | keep up with | 뒤처지지 않다 |
| 시간 효율 관리 | make the most of | 최대한 활용하다 |
| 인생 2막 커리어 | start over | 다시 시작하다 |
| 부업/사이드잡 | on the side | 부업으로 |
| 네트워킹 | stay in touch | 연락을 유지하다 |
| 외국어 학습 | get the hang of | 감을 잡다 |
| 목표 설정 | set your mind on | 결심하다 |

### 환경 (10)

| subtopic_ko | key_phrase_en | key_ko |
|---|---|---|
| 플라스틱 줄이기 | cut down on | 줄이다 |
| 재활용 분리배출 | sort out | 분류하다 |
| 전기 절약 | turn off | 끄다 |
| 친환경 장보기 | go green | 친환경적이다 |
| 음식물 쓰레기 줄이기 | throw away | 버리다 |
| 중고 구매와 재사용 | second-hand | 중고의 |
| 대중교통 이용 | get around | 돌아다니다 |
| 에너지 효율 가전 | save energy | 에너지 절약 |
| 지속가능한 소비 | think twice | 재고하다 |
| 작은 실천의 힘 | make a difference | 차이를 만들다 |

### 일상 (10)

| subtopic_ko | key_phrase_en | key_ko |
|---|---|---|
| 가족 저녁 식사 | sit down together | 함께 앉다 |
| 이웃과 인사 | wave hello | 손 흔들어 인사 |
| 주말 집 정리 | clean up | 치우다 |
| 부모님 안부 전화 | check in on | 안부를 확인하다 |
| 동네 카페 발견 | drop by | 들르다 |
| 계절 반찬 만들기 | put together | 만들다 |
| 오래된 친구 만나기 | catch up with | 근황을 나누다 |
| 빨래 루틴 | get done | 끝내다 |
| 아침 커피 한잔 | kick off | 시작하다 |
| 잠자리 정리 | make the bed | 침대 정리하다 |

## Files Affected (Preview)

New:
- `prisma/migrations/<ts>_add_topic_pool_and_rotation/migration.sql`
- `prisma/seed-topic-pool.ts` (or addition to existing `seed.ts`)
- `src/lib/topic-pool.ts` — rotation + topic-pick helpers
- `src/app/api/admin/topic-pool/route.ts`
- `src/app/api/admin/topic-pool/[id]/route.ts`
- `src/app/(admin)/admin/topic-pool/page.tsx`
- `src/components/admin/topic-pool-table.tsx`
- `src/components/admin/topic-pool-form.tsx`
- `scripts/regenerate-seed-articles.ts` (or equivalent)

Modified:
- `prisma/schema.prisma` — add 2 new models
- `src/lib/generation-prompts.ts` — new `LEVEL_SPEC`, new genre list, magazine-column style rules
- `src/lib/content-generation.ts` — call topic-pool picker when no upcoming topic; update pool/rotation on success
- `src/components/admin/content-topic-fields.tsx` — dropdown
- `src/components/admin/upcoming-topic-form.tsx` — dropdown
- Admin sidebar component — add "주제 풀" link

## Success Criteria

1. Fresh daily generation (no upcoming override) produces a 2026-04-26 article in **교육** category, using the next unused 교육 topic from the pool.
2. The 6 regenerated seed articles (4/20–4/25) have the expected categories and their `paragraphs` read like a magazine column, not a reflective essay.
3. beginner variants use only A1 vocabulary, sentences 5–9 words.
4. advanced variants avoid "native register" drift — no `seismic`, `relentless`, `landscape of`, etc. Sentences 14–22 words.
5. Admin can create a new 주제 풀 row and it is eligible for selection on the next generation cycle.
6. `upcoming_topics` override still works — admin-specified date bypasses pool selection.

## Open Questions

None at this time.

## Out-of-Scope (Follow-up Candidates)

- Post-pilot: rename `genre` → `category` at DB/code level.
- UI: show the category on archive cards using the new Korean labels (may already work since `genre` is displayed as-is).
- Analytics: dashboard for pool usage/exhaustion warnings.

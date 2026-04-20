# routines.soritune.com — AI 콘텐츠 자동 생성 (Plan 2)

**날짜**: 2026-04-20
**대상 프로젝트**: `/var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines/`
**스택**: Next.js (App Router) + NextAuth (admin 전용) + Prisma + MySQL + PM2
**의존**: Plan 1 (`2026-04-20-content-levels-design.md`) 의 Content + ContentVariant 스키마 위에서 동작

## 배경 & 목표

Plan 1 에서 `Content` (주제) + `ContentVariant` (레벨별 학습 데이터 3행) 구조가 완성되어 admin 이 수동으로 매일 3레벨 콘텐츠를 작성할 수 있다. 본 Plan 은 **AI 가 매일 자동으로 내일자 콘텐츠를 생성**하여 admin 의 매일 작성 부담을 제거한다.

기본 동작은 **AI 자율** (최근 14일 주제를 피해 새 주제 + 3레벨 자동 생성), 원할 때만 admin 이 UpcomingTopic 으로 주제를 미리 지정 (override).

## 결정 요약 (브레인스토밍 합의)

| 항목 | 결정 |
|------|------|
| 주제 소스 | 기본 AI 자율. Admin 이 UpcomingTopic 에 `date` 지정 시 그 정보로 override |
| 발행 방식 | 21:00 KST cron 이 내일자 draft 생성 → `publishedAt=내일` 로 저장. 별도 발행 cron 없음 (DATE 가 맞는 순간 자동 노출) |
| 생성 전략 | 2단계: Stage 1 공통 정보 (title/subtitle/genre/keyPhrase/keyKo) → Stage 2 레벨 3개 병렬 (paragraphs 등) |
| 실패 대응 | 1회 재시도 후 실패 시 직전 Content 를 **새 Content + 3 variants 로 복제**해서 `publishedAt=내일` 로 저장. 원본 row 는 그대로 보존. 복제본에 `reusedFromContentId` 로 원본 참조 |
| Cron 구조 | 서버 crontab → Next.js API (`/api/admin/generation/run`) Bearer 인증 |
| AI provider | 기존 AISetting 재사용. **주의**: AISetting 변경 시 인터뷰 피드백과 생성이 같이 영향받음 (배포 노트에 명시) |
| 프롬프트 관리 | JSON 스키마는 플랜에 못박음, 문구는 별도 `generation-prompts.ts` 에 초기 버전 + TUNING NOTES |
| Admin UI 범위 | UpcomingTopic CRUD + "지금 실행" 버튼. 생성 이력 UI 는 범위 외 (PM2 로그 + DB 조회로 확인) |
| 로그 | `GenerationLog` 테이블 (운영 관측 분리). running 상태 30분 TTL 로 자동 stale 처리 |
| UpcomingTopic shape | `date + genre + keyPhrase + keyKo + hint` (keyKo 포함 — override 시 한국어 번역 불일치 방지) |
| 날짜 처리 기준 | `src/lib/date.ts` 에 `todayKSTDate()` / `tomorrowKSTDate()` 익스포트. 모든 DB 저장/비교가 이 함수 사용. Plan 1 의 `/api/content/today` 내 inline helper 도 여기로 이관 |

## 스키마 변경

### 신규 테이블 & enum

```prisma
model UpcomingTopic {
  id         Int      @id @default(autoincrement())
  date       DateTime @unique @db.Date
  genre      String   @db.VarChar(50)
  keyPhrase  String   @db.VarChar(255)
  keyKo      String   @map("key_ko") @db.VarChar(255)
  hint       String?  @db.Text
  createdAt  DateTime @default(now()) @map("created_at")
  updatedAt  DateTime @updatedAt @map("updated_at")

  @@map("upcoming_topics")
}

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

enum GenerationStatus {
  running
  success
  failed
  fallback
}
```

### Content 에 reusedFromContentId 추가

Fallback 이 과거 row 를 훼손하지 않도록 `Content` 모델에 **자기 참조 컬럼** 추가:

```prisma
model Content {
  // ... (기존 필드 그대로) ...
  reusedFromContentId Int?  @map("reused_from_content_id")
  reusedFrom          Content?  @relation("ContentReuse", fields: [reusedFromContentId], references: [id], onDelete: SetNull)
  reusedBy            Content[] @relation("ContentReuse")
  // ...
}
```

- Nullable. 일반 생성된 Content 는 null.
- Fallback 으로 복제된 Content 는 원본 id 를 참조.
- `onDelete: SetNull` — 원본 Content 가 삭제돼도 복제본은 살아남되 참조는 null.
- Admin UI 에서 복제본 구분 표시는 본 Plan 범위 외 (raw 필드 존재만 보장). Plan 3 에서 가시화 검토.

### 연관

- `GenerationLog.contentId` 는 FK 로 묶지 않음 (Content 가 삭제되어도 로그는 남아야 함). 앱 레벨에서 조회 시 `contentId` 로 Content 존재 확인.
- `UpcomingTopic.date` unique 로 하루 1개 강제.
- `Content.reusedFromContentId` 신설 (위 참고).
- 기존 `ContentVariant`, `AISetting`, 다른 사용자 테이블 건드리지 않음.

## 날짜 처리 기준 (선행 작업)

본 Plan 의 첫 단계로 `src/lib/date.ts` 에 공용 헬퍼를 export 추가하고, Plan 1 의 인라인 헬퍼를 이관한다. 이 함수들을 Plan 2 전 구간에서 사용 — DB 저장, 비교, cron 기본값, admin 폼 값 전부 동일 규약.

```typescript
// src/lib/date.ts — 추가 export
export function todayKSTDate(): Date {
  const kstDateStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
  return new Date(kstDateStr); // UTC midnight of today's KST calendar date
}

export function tomorrowKSTDate(): Date {
  const d = todayKSTDate();
  d.setUTCDate(d.getUTCDate() + 1);
  return d;
}
```

- 기존 `src/app/api/content/today/route.ts` 의 인라인 `todayKSTDate()` 는 삭제하고 `@/lib/date` 에서 import 로 교체 (Plan 2 첫 커밋에 포함).
- 기존 `todayKST()` (KST local midnight, timezone-biased timestamp) 는 streak 관련 코드가 쓰고 있으므로 그대로 둠 — 의미가 다름 ("KST 자정의 UTC 표현" vs "KST 달력 날짜의 UTC 자정"). 두 함수 차이는 주석으로 명시.
- 검증: Plan 1 의 `/api/content/today` 가 이관 후에도 정상 동작하는지 curl 테스트.

## 생성 서비스 (`src/lib/content-generation.ts`)

**공개 인터페이스**:

```typescript
export type GenerationResult = {
  status: "success" | "fallback" | "failed";
  contentId: number | null;
  logId: number;
};

export async function generateContentForDate(
  targetDate: Date,         // tomorrowKSTDate() 또는 todayKSTDate()+N 과 동일 shape
  options?: { overwrite?: boolean }
): Promise<GenerationResult>;
```

**실행 흐름**:

1. **Stale running 정리**: `GenerationLog` 에 `status=running && targetDate=<targetDate> && runAt < now - 30min` 인 row 를 `status=failed, errorMessage="stale running TTL"` 로 UPDATE. 프로세스 크래시로 stuck 된 row 는 30분 뒤 자동 복구됨.
2. **동시 실행 차단**: 위 정리 후에도 `status=running && targetDate=<targetDate>` 가 남아있으면 에러 throw (HTTP 409). 즉 30분 내의 정상 running 만 차단.
3. **덮어쓰기 처리**: Content 가 이미 targetDate 로 존재하고 `overwrite=false` 면 에러 throw (HTTP 409). `overwrite=true` 면 해당 Content 삭제 (cascade 로 variants 동반 삭제).
4. **attempt=1 로그 insert** (status=running).
5. **UpcomingTopic 조회** (`date === targetDate`). 존재 시 `{ genre, keyPhrase, keyKo, hint }` 확보. 없으면 AI 자율 모드.
6. **최근 14일 Content 메타 조회** (`publishedAt < targetDate && publishedAt >= targetDate - 14일`). `[{genre, title, keyPhrase}]` 리스트로 프롬프트에 중복 회피 컨텍스트 제공.
7. **Stage 1**: `getActiveProvider()` 로 provider 확보. `buildStage1Prompt(context)` 호출. AI 응답 JSON 파싱:
   ```json
   {
     "title": "string",
     "subtitle": "string",
     "genre": "string",
     "keyPhrase": "string",
     "keyKo": "string"
   }
   ```
   **UpcomingTopic override 동작**: 존재 시 최종 Stage 1 결과는 `{ title, subtitle } = AI 출력` + `{ genre, keyPhrase, keyKo } = UpcomingTopic 값 (override)`. AI 의 `genre/keyPhrase/keyKo` 는 사용하지 않음 — 한국어 번역 불일치 방지.
8. **Stage 2 병렬**: `Promise.all` 로 3개 레벨 호출 (beginner, intermediate, advanced). Stage 1 의 최종 값 (override 반영 후) 을 각 프롬프트에 전달. 각 호출 JSON 요청:
   ```json
   {
     "paragraphs": ["string", ...],
     "sentences": ["string", ...],
     "expressions": [{"expression","meaning","example"}, ...],
     "quiz": [{"question","answer","options":["...","..."]}, ...],
     "interview": ["string", ...],
     "speakSentences": ["string", ...]
   }
   ```
9. **검증** (전수, 하나라도 실패하면 이 attempt 실패 처리):

   **공통**:
   - 모든 최상위 필드 타입 일치 (배열/객체).
   - 배열 내 모든 문자열 원소: `typeof === "string" && trimmed.length > 0` (빈 문자열 배제).

   **배열 길이 제약**:
   - `paragraphs`: 2 ≤ n ≤ 5
   - `sentences`: 4 ≤ n ≤ 10
   - `expressions`: 3 ≤ n ≤ 6
   - `quiz`: 3 ≤ n ≤ 6
   - `interview`: 3 ≤ n ≤ 6
   - `speakSentences`: 3 ≤ n ≤ 6

   **Expression 객체**: `expression`, `meaning`, `example` 모두 non-empty string.

   **Quiz 객체**:
   - `question`, `answer` non-empty string.
   - `options` 배열, 길이 2~5, 모든 원소 non-empty string.
   - **`answer` 가 `options` 중 하나와 정확히 일치** (strict equality). 불일치 시 fail.

   **KeyPhrase 포함**: 최종 keyPhrase 가 각 variant 의 `paragraphs.join(" ")` 안에 **case-insensitive 로 최소 1회** 등장. 3레벨 모두 통과해야 함.

10. **트랜잭션 insert**: Content + 3 ContentVariant 한꺼번에. `publishedAt=targetDate`, `priority=0`, `isActive=true`, `reusedFromContentId=null`.
11. **GenerationLog 업데이트**: status=success, contentId, durationMs, provider, model.

**재시도 로직**:

- Stage 1/2 중 예외 또는 검증 실패 → attempt=1 GenerationLog status=failed 로 마킹 (`errorMessage` 에 원인).
- 즉시 재호출 (동일 함수를 attempt=2 새 row 로). 재시도는 **한 번만**.
- 재시도도 실패 → fallback 로직 진입:

**Fallback: 복제 방식 (원본 불변)**

아카이브 무결성 보존을 위해 기존 Content 의 publishedAt 을 변경하지 **않음**. 대신 원본을 복사해 새 Content + 3 variants 를 추가한다.

1. 직전 Content 조회: `where: { publishedAt: { lt: targetDate }, isActive: true }`, `orderBy: { publishedAt: desc }`, `include: { variants: true }`. 1건.
2. 존재 시 트랜잭션으로:
   ```typescript
   const clone = await tx.content.create({
     data: {
       genre: prev.genre,
       title: prev.title,
       subtitle: prev.subtitle,
       keyPhrase: prev.keyPhrase,
       keyKo: prev.keyKo,
       publishedAt: targetDate,          // 내일로
       priority: 0,
       isActive: true,
       reusedFromContentId: prev.id,      // 원본 참조
     },
   });
   for (const v of prev.variants) {
     await tx.contentVariant.create({
       data: {
         contentId: clone.id,
         level: v.level,
         paragraphs: v.paragraphs,
         sentences: v.sentences,
         expressions: v.expressions,
         quiz: v.quiz,
         interview: v.interview,
         speakSentences: v.speakSentences,
       },
     });
   }
   ```
3. GenerationLog attempt=2 row `status=fallback, contentId=clone.id` 로 UPDATE.
4. 원본 Content 와 variants 는 그대로 유지. 아카이브 순서/히스토리 불변.
5. Fallback 대상도 없으면 (DB 에 이전 Content 없음) attempt=2 status=failed 그대로. 사용자는 /today 에서 "콘텐츠 없음" 메시지.

**복제본 누적 주의**: 매일 fallback 이 반복되면 동일 Content 가 여러 번 복제됨. 운영 모니터링 대상 — GenerationLog 에서 fallback 빈도 확인. 2일 이상 연속 fallback 은 admin 조사 필요 (Plan 2 범위 외 — 실패 알림은 Plan 3).

**반환값**:
- `success` 시 `{ status: "success", contentId, logId }`.
- `fallback` 시 `{ status: "fallback", contentId: <prev>, logId }`.
- 최종 실패 시 `{ status: "failed", contentId: null, logId }`.

## 프롬프트 파일 (`src/lib/generation-prompts.ts`)

- `buildStage1Prompt(context): { system, user }` — 공통 정보 생성.
- `buildStage2Prompt(stage1, level): { system, user }` — 레벨별 학습 데이터 생성.
- 각 함수 위에 `// TUNING NOTES:` 주석 블록으로 향후 튜닝 방향 메모.
- 출력은 항상 JSON only (markdown/code block 없이). 프롬프트 끝에 `Respond ONLY with valid JSON. No markdown, no code blocks.` 명시 (기존 `ai-service.ts` 의 인터뷰 프롬프트 패턴과 동일).

**초기 Stage 1 prompt 개요**:

```
System:
You are an English learning content designer for Korean learners. Generate a daily topic that is
distinct from the recent topics provided. Output strict JSON with fields: title, subtitle, genre,
keyPhrase, keyKo.

User:
Recent topics (avoid duplication in both genre and keyPhrase):
- {genre1}: "{title1}" [{keyPhrase1}]
- ...
{{#if upcomingTopic}}
Use these fixed values (do NOT change them; only generate title/subtitle consistent with these):
- genre: {genre}
- keyPhrase: {keyPhrase}
- keyKo: {keyKo}
- hint: {hint}
{{/if}}

Respond ONLY with valid JSON: { "title": ..., "subtitle": ..., "genre": ..., "keyPhrase": ..., "keyKo": ... }

Note: server overrides genre/keyPhrase/keyKo with UpcomingTopic values when present; only title and subtitle from AI output are used in override mode.
```

**초기 Stage 2 prompt 개요**:

```
System:
You are writing English learning material for Korean learners at level {level}. Level spec:
- beginner: Simple vocabulary, short sentences, include occasional Korean annotations.
- intermediate: Natural English, moderate complexity, idiomatic but accessible.
- advanced: Native speaker register, nuanced vocabulary, sophisticated syntax.

Always include the keyPhrase "{keyPhrase}" at least once in the paragraphs. All quiz answers must
be exactly one of the provided options. Output strict JSON with fields: paragraphs, sentences,
expressions, quiz, interview, speakSentences.

User:
Topic: {title}
Subtitle: {subtitle}
Genre: {genre}
Key Phrase: {keyPhrase} ({keyKo})

Write the learning material at {level} level. Respond ONLY with valid JSON matching this schema:
{ "paragraphs": string[], "sentences": string[], "expressions": [{...}], "quiz": [{...}], "interview": string[], "speakSentences": string[] }
```

## Cron 트리거 & Admin 수동 실행

### 엔드포인트: `POST /api/admin/generation/run`

**요청**:

```
POST /api/admin/generation/run
Headers:
  Authorization: Bearer <GENERATION_CRON_SECRET>        # cron 경로
  또는 (admin 세션 쿠키)                                   # UI 경로
  Content-Type: application/json
Body (optional):
  { "date"?: "YYYY-MM-DD", "overwrite"?: boolean }
```

**날짜 해석**:
- `date` 누락 → 기본값 = 내일 (KST 달력 기준). `new Date(new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" })); setDate(+1)` 패턴.
- `date` 주어지면 `YYYY-MM-DD` 파싱 → UTC 자정 Date 로 변환 (Plan 1 의 `todayKSTDate` 와 동일 컨벤션).

**인증 분기**:
```typescript
async function authorize(req: NextRequest): Promise<"admin" | "cron" | null> {
  const bearer = req.headers.get("authorization");
  if (bearer && bearer === `Bearer ${process.env.GENERATION_CRON_SECRET}`) return "cron";
  const session = await auth();
  if (session?.user && session.user.role === "admin") return "admin";
  return null;
}
```
- 둘 다 실패 → 401.

**응답**:
- 200 `{ status: "success" | "fallback", contentId, logId }`
- 409 if 기존 Content 존재 & overwrite=false, 또는 동일 targetDate 에 running 인 GenerationLog 존재
- 401 if 인증 실패
- 500 if 재시도까지 실패하고 fallback 도 실패 (`status: "failed"`)

### Cron 설정

**서버 crontab** (`crontab -e` 로 루트 또는 apache 유저):

```cron
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
0 21 * * * . /root/.routines-cron-env && /usr/bin/curl -sS -X POST -H "Authorization: Bearer ${GENERATION_CRON_SECRET}" -H "Content-Type: application/json" -d '{}' http://localhost:3000/api/admin/generation/run >> /var/log/routines-cron.log 2>&1
```

**환경 파일** `/root/.routines-cron-env`:

```bash
export GENERATION_CRON_SECRET=<64-hex random>
```

권한 `chmod 600`. Git 추적 대상 아님.

**Next.js 측 `.env.local`**:
```
GENERATION_CRON_SECRET=<동일 값>
```

**로그**: `/var/log/routines-cron.log` 에 HTTP 응답 누적. `logrotate` 는 본 Plan 범위 외 (필요 시 별도 설정).

### 동시 실행 방지 + Stale TTL

- 서비스 함수 시작 시 2단계 처리:
  1. **Stale 정리**: `GenerationLog` 에서 `status=running && targetDate=<targetDate> && runAt < now - 30min` 인 row 전부 `status=failed, errorMessage="stale running TTL"` 로 UPDATE.
  2. **Live 차단**: 그 후 `status=running && targetDate=<targetDate>` 가 있으면 409 throw.
- 정상 종료/예외 시 반드시 status 를 terminal 상태(success/failed/fallback) 로 전이.
- TTL 30분은 stage 1+2 병렬 호출의 최장 실행 시간(약 2~5분)에 충분한 마진을 준 값. 필요 시 환경변수로 조정 가능.
- 프로세스가 중간에 죽으면 30분 뒤 다음 실행이 자동으로 stale 로 마킹 → 수동 개입 불필요.

## Admin UI: `/admin/topics`

### 페이지 구조

**상단 — "지금 실행" 블록**:

```
┌ 수동 생성 ─────────────────────────────────────┐
│ 날짜: [2026-04-21 ▾]   덮어쓰기: ☐              │
│                                   [ 지금 실행 ] │
│                                                 │
│ 마지막 실행: 2026-04-20 21:00 · success · #3 · 12.4s │
└─────────────────────────────────────────────────┘
```

- 날짜 input type="date" 기본값 = 내일 (KST).
- 덮어쓰기 checkbox.
- "지금 실행" 버튼 → `POST /api/admin/generation/run` (session 기반 인증).
- 버튼 클릭 중 spinner, 완료 시 toast (success 건 Content ID 링크 / fallback 안내 / error 메시지).
- "마지막 실행" 은 `GET /api/admin/generation/log?limit=1` (별도 API) 또는 `GenerationLog` row 1건 read. 페이지 mount + 실행 직후 refetch.

**중단 — UpcomingTopic 목록**:

```
┌ 예약된 주제 ───────────────────────────────────────────────┐
│ 날짜         장르       핵심 표현   힌트           액션   │
│ 2026-04-22   Workplace  burn out    번아웃 대처   ✏ 🗑   │
│ 2026-04-25   Daily      ...         ...           ✏ 🗑   │
│                                                            │
│                                   [ + 새 주제 예약 ]       │
└────────────────────────────────────────────────────────────┘
```

- 테이블. 오늘 이전 date 는 회색 처리 또는 숨김 (이미 소비됨).
- "새 주제 예약" → `UpcomingTopicForm` 모달/인라인 폼 (date / genre / keyPhrase / keyKo / hint).
- keyKo 는 required — AI 가 다른 번역을 만들어 넣는 것을 방지하기 위해 admin 이 명시.
- 수정 아이콘 → 동일 폼 prefilled.
- 삭제 아이콘 → 확인 후 `DELETE /api/admin/topics/[id]`.

### API 엔드포인트

**UpcomingTopic CRUD** (모두 `requireAdmin`):

- `GET /api/admin/topics` — 전체 목록. 응답: `[{ id, date, genre, keyPhrase, keyKo, hint, createdAt, updatedAt }]` (date asc)
- `POST /api/admin/topics` — body `{ date, genre, keyPhrase, keyKo, hint? }`. date 포맷 + 필수 필드 검증 + unique 충돌 시 409.
- `PUT /api/admin/topics/[id]` — body 동일 shape. 수정.
- `DELETE /api/admin/topics/[id]` — 삭제.

**GenerationLog 조회**:

- `GET /api/admin/generation/log?limit=1` — `requireAdmin`. 최근 N건 조회. `[{ id, targetDate, runAt, status, durationMs, contentId, errorMessage, attempt, provider, model }]`. 기본 limit=10.

### 관리자 사이드바 (`AdminSidebar`)

기존 메뉴: 대시보드 / 콘텐츠 / 사용자 / AI 설정. 신규 추가: **"주제 스케줄"** (icon 선택 자유). `/admin/topics` 링크.

## 변경 파일 목록

### Create

- `prisma/migrations/<ts>_add_generation_tables/migration.sql`
- `src/lib/content-generation.ts` — 2단계 생성 + 재시도 + fallback
- `src/lib/generation-prompts.ts` — Stage 1/2 prompt builders
- `src/app/api/admin/generation/run/route.ts` — Bearer + admin 인증 트리거
- `src/app/api/admin/generation/log/route.ts` — 최근 로그 조회
- `src/app/api/admin/topics/route.ts` — GET/POST
- `src/app/api/admin/topics/[id]/route.ts` — PUT/DELETE
- `src/app/(admin)/admin/topics/page.tsx` — 관리 UI
- `src/components/admin/upcoming-topic-form.tsx` — 폼 (신규/수정 공용)
- `src/components/admin/generation-trigger.tsx` — "지금 실행" 블록

### Modify

- `prisma/schema.prisma` — UpcomingTopic, GenerationLog, GenerationStatus
- `src/components/admin/sidebar.tsx` — "주제 스케줄" 링크

### Unchanged

- 모든 사용자 페이지 (Plan 1 이 처리)
- `src/lib/ai-service.ts` (getActiveProvider 재사용)
- 기존 AISetting / Content / ContentVariant / UserProgress / Streak 모델

## 배포 체크리스트

1. **로컬**: `pnpm prisma migrate dev --create-only --name add_generation_tables` 로 migration 파일 생성 + 커밋. (routines 는 dev/prod DB 분리 없음 — shadow DB 불가 시 `prisma migrate diff` 우회, Plan 1 패턴 동일.)
2. **운영 배포**:
   - `.env.local` 에 `GENERATION_CRON_SECRET=<새 값>` 추가 (openssl rand -hex 32)
   - `pnpm prisma migrate deploy`
   - `pnpm build` + `pm2 reload`
3. **Cron 설정**:
   - `/root/.routines-cron-env` 작성 (600 퍼미션, 동일 secret)
   - `crontab -e` 로 21:00 job 추가
   - `crontab -l` 로 확인
4. **AI 설정 확인**: `/admin/settings` 에 isActive=true 인 AISetting row 존재 확인. 없으면 먼저 등록.
   - **중요**: AISetting 은 현재 인터뷰 피드백과 본 생성 기능이 **공유**한다. `isActive` 를 다른 provider/model 로 바꾸면 인터뷰 품질도 같이 변한다. 용도 분리는 향후 Plan 에서 다룸 (`AISetting.purpose` 컬럼 또는 별도 `GenerationSetting` 테이블). 운영 중 AISetting 변경 시 두 기능 모두 영향을 받는 점을 변경 작업 체크리스트에 포함.
5. **1회 수동 테스트**: `/admin/topics` 에서 내일 날짜로 "지금 실행". Content 1행 + variants 3행 생성 확인.
6. **크론 동작 관찰**: 다음 날 21:00 에 `/var/log/routines-cron.log` + GenerationLog 테이블 확인.

## 검증 시나리오

### 정상 생성 (AI 자율)
1. UpcomingTopic 없는 상태로 `/admin/topics` → "지금 실행" (내일 날짜, 덮어쓰기 off)
2. Content 1행 + 3 ContentVariant 생성 확인
3. 최근 14일 중 같은 genre+keyPhrase 조합 없는지 확인
4. GenerationLog status=success, attempt=1

### 정상 생성 (UpcomingTopic override)
1. `/admin/topics` 에서 주제 예약 (date=내일, genre=Workplace, keyPhrase="burn out", keyKo="번아웃 되다", hint="번아웃 대처법")
2. "지금 실행" → 생성 완료 → 생성된 Content.genre === "Workplace" && Content.keyPhrase === "burn out" && Content.keyKo === "번아웃 되다" 확인
3. 3 ContentVariant 의 paragraphs 안에 "burn out" 포함 확인

### 덮어쓰기
1. 위 실행 직후 같은 날짜로 다시 "지금 실행" (덮어쓰기 off) → 409 에러 + UI 메시지
2. 덮어쓰기 on 으로 다시 실행 → 기존 Content 삭제 + 새 Content 생성 (id 증가). GenerationLog 2건.

### 재시도 + fallback (복제)
1. AISetting 의 apiKey 를 일부러 잘못된 값으로 수정 (dev DB 시뮬레이션)
2. "지금 실행" → attempt=1 실패 → attempt=2 실패 → fallback 발동
3. **원본 Content 의 publishedAt 은 그대로**, 새 Content row 가 `publishedAt=targetDate, reusedFromContentId=<원본id>` 로 생성됨
4. 새 Content 의 3 ContentVariant 가 원본과 동일한 데이터 (paragraphs/sentences/…) 로 복사됨
5. `/archive` 에서 원본 날짜 / 복제본 날짜 둘 다 노출됨 (순서 무결성 유지)
6. GenerationLog 2건 (attempt=1 running→failed, attempt=2 running→fallback)
7. apiKey 복원

### Stale running TTL
1. DB 에 직접 `INSERT INTO generation_logs (target_date, run_at, status, attempt) VALUES (<내일>, NOW() - INTERVAL 1 HOUR, 'running', 1);`
2. "지금 실행" → 정상 실행 (stale row 가 자동 failed 로 UPDATE 됨)
3. GenerationLog 조회 → stale row status=failed, errorMessage="stale running TTL"

### 동시 실행 차단
1. 수동 `/api/admin/generation/run` 를 2번 빠르게 연속 호출
2. 두 번째 호출 409 반환 (running 충돌)

### 인증
1. Bearer 없이 POST → 401
2. 잘못된 Bearer → 401
3. 로그인 admin 세션으로 → 200
4. 올바른 Bearer → 200

### Cron 실제 실행
1. 임시로 crontab 을 `* * * * *` 로 바꾸고 1분 기다림
2. `/var/log/routines-cron.log` 에 200 응답 기록 확인
3. GenerationLog row 추가 확인
4. crontab 을 21:00 으로 복구

## 배포 후 Cron 동작 전에 수동 검증 필수

첫 배포 직후 admin 이 한 번 "지금 실행" 으로 end-to-end 검증 후 cron 활성화 권장. AI 응답 형식/검증 실패 같은 문제가 있을 경우 cron 이 묵묵히 fallback 만 쌓는 상황을 방지.

## 본 Plan 에서 하지 않는 것

- 생성 이력 UI (`/admin/generation`) — 초기엔 DB 직접 조회로 충분
- 실패 알림(이메일/Slack) — PM2 로그 + cron 로그 + GenerationLog 로 충분
- 비용 모니터링 대시보드 — AISetting 용도 분리와 함께 추후
- **AISetting `purpose` 분리 (인터뷰 vs 생성)** — 현재 공유. 변경 시 양쪽 영향. 배포 체크리스트에 명시됨.
- Admin UI 에서 `reusedFromContentId` 복제본 표시 (배지/필터) — 스키마는 본 Plan 에 추가, UI 는 Plan 3 에서 가시화 검토
- 콘텐츠 품질 자동 평가 / A/B 테스트
- 프롬프트 버전 관리 (초기엔 Git history 로 충분)
- fallback 복제가 2일 연속 발생한 상황의 자동 대응 (현재는 운영자 관찰)

## 롤백 / 비활성화 전략

AI 생성에 문제 발생 시:
1. `crontab -e` 에서 21:00 job 주석 처리 → cron 중단
2. Admin 이 수동으로 매일 3레벨 콘텐츠 작성 (Plan 1 의 UI) 로 전환
3. 문제 파악/수정 후 다시 cron 활성화

코드 롤백이 필요하면 본 Plan 의 5개 커밋을 `git revert` 로 되돌림. 스키마 변경(UpcomingTopic/GenerationLog) 은 `prisma migrate` 로 별도 migration 생성하여 table drop.

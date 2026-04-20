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
| 실패 대응 | 1회 재시도 후 실패 시 직전 Content 의 publishedAt 을 내일로 UPDATE (fallback) |
| Cron 구조 | 서버 crontab → Next.js API (`/api/admin/generation/run`) Bearer 인증 |
| AI provider | 기존 AISetting 재사용 (인터뷰 피드백과 동일) |
| 프롬프트 관리 | JSON 스키마는 플랜에 못박음, 문구는 별도 `generation-prompts.ts` 에 초기 버전 + TUNING NOTES |
| Admin UI 범위 | UpcomingTopic CRUD + "지금 실행" 버튼. 생성 이력 UI 는 범위 외 (PM2 로그 + DB 조회로 확인) |
| 로그 | `GenerationLog` 테이블 (운영 관측 분리) |
| UpcomingTopic shape | `date + genre + keyPhrase + hint` (Q3 B안) |

## 스키마 변경

### 신규 테이블 & enum

```prisma
model UpcomingTopic {
  id         Int      @id @default(autoincrement())
  date       DateTime @unique @db.Date
  genre      String   @db.VarChar(50)
  keyPhrase  String   @db.VarChar(255)
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

### 연관

- `GenerationLog.contentId` 는 FK 로 묶지 않음 (Content 가 삭제되어도 로그는 남아야 함). 앱 레벨에서 조회 시 `contentId` 로 Content 존재 확인.
- `UpcomingTopic.date` unique 로 하루 1개 강제.
- 기존 `Content`, `ContentVariant`, `AISetting` 건드리지 않음.

## 생성 서비스 (`src/lib/content-generation.ts`)

**공개 인터페이스**:

```typescript
export type GenerationResult = {
  status: "success" | "fallback" | "failed";
  contentId: number | null;
  logId: number;
};

export async function generateContentForDate(
  targetDate: Date,         // UTC midnight of target KST date
  options?: { overwrite?: boolean }
): Promise<GenerationResult>;
```

**실행 흐름**:

1. **동시 실행 차단**: `GenerationLog` 에 `status=running && targetDate=<targetDate>` 가 이미 있으면 에러 throw (HTTP 409).
2. **덮어쓰기 처리**: Content 가 이미 targetDate 로 존재하고 `overwrite=false` 면 에러 throw (HTTP 409). `overwrite=true` 면 해당 Content 삭제 (cascade 로 variants 동반 삭제).
3. **attempt=1 로그 insert** (status=running).
4. **UpcomingTopic 조회** (`date === targetDate`). 존재 시 `{ genre, keyPhrase, hint }` 확보. 없으면 AI 자율 모드.
5. **최근 14일 Content 메타 조회** (`publishedAt < targetDate && publishedAt >= targetDate - 14일`). `[{genre, title, keyPhrase}]` 리스트로 프롬프트에 중복 회피 컨텍스트 제공.
6. **Stage 1**: `getActiveProvider()` 로 provider 확보. `buildStage1Prompt(context)` 호출. AI 응답 JSON 파싱:
   ```json
   {
     "title": "string",
     "subtitle": "string",
     "genre": "string",
     "keyPhrase": "string",
     "keyKo": "string"
   }
   ```
   UpcomingTopic 있으면 `genre` 와 `keyPhrase` 는 그 값으로 덮어씀 (AI 제안은 `title/subtitle/keyKo` 만 사용).
7. **Stage 2 병렬**: `Promise.all` 로 3개 레벨 호출. 각 호출 Stage 2 프롬프트로 JSON 요청:
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
8. **검증**:
   - 모든 variant 의 6개 필드가 비어있지 않음
   - Expressions 최소 3개, quiz 최소 3개, interview 최소 3개 (배열 길이 확인)
   - keyPhrase 가 각 variant 의 `paragraphs` 문자열 안에 최소 1회 등장 (대소문자 구분 없이) — 핵심 표현이 본문에 녹아있는지 확인
9. **트랜잭션 insert**: Content + 3 ContentVariant 한꺼번에. `publishedAt=targetDate`, `priority=0`, `isActive=true`.
10. **GenerationLog 업데이트**: status=success, contentId, durationMs, provider, model.

**재시도 로직**:

- Stage 1/2 중 예외 또는 검증 실패 → attempt=1 GenerationLog status=failed 로 마킹.
- 즉시 재호출 (동일 함수를 attempt=2 새 row 로). 재시도는 **한 번만**.
- 재시도도 실패 → fallback 로직 진입:
  - 직전 Content 조회: `publishedAt < targetDate && isActive=true` 중 가장 최근 1건.
  - 존재 시: `UPDATE contents SET publishedAt = <targetDate> WHERE id = <prevId>`.
  - GenerationLog attempt=2 row status=fallback + contentId=<prevId> 로 업데이트.
  - Fallback 대상도 없으면 attempt=2 status=failed 그대로. 사용자는 /today 에서 "콘텐츠 없음" 메시지.

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
Use these fixed values:
- genre: {genre}
- keyPhrase: {keyPhrase}
- hint: {hint}
{{/if}}

Respond ONLY with valid JSON: { "title": ..., "subtitle": ..., "genre": ..., "keyPhrase": ..., "keyKo": ... }
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

### 동시 실행 방지

- 서비스 함수 시작 시 `GenerationLog.findFirst({ targetDate, status: "running" })` 조회 → 있으면 409 throw.
- 정상 종료/예외 시 반드시 status 를 terminal 상태(success/failed/fallback) 로 전이.
- 프로세스 크래시로 running 이 stuck 되면 admin 이 DB 에서 수동 UPDATE (문서화).

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
- "새 주제 예약" → `UpcomingTopicForm` 모달/인라인 폼 (date / genre / keyPhrase / hint).
- 수정 아이콘 → 동일 폼 prefilled.
- 삭제 아이콘 → 확인 후 `DELETE /api/admin/topics/[id]`.

### API 엔드포인트

**UpcomingTopic CRUD** (모두 `requireAdmin`):

- `GET /api/admin/topics` — 전체 목록. 응답: `[{ id, date, genre, keyPhrase, hint, createdAt, updatedAt }]` (date asc)
- `POST /api/admin/topics` — body `{ date, genre, keyPhrase, hint? }`. date 포맷 검증 + unique 충돌 시 409.
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
5. **1회 수동 테스트**: `/admin/topics` 에서 내일 날짜로 "지금 실행". Content 1행 + variants 3행 생성 확인.
6. **크론 동작 관찰**: 다음 날 21:00 에 `/var/log/routines-cron.log` + GenerationLog 테이블 확인.

## 검증 시나리오

### 정상 생성 (AI 자율)
1. UpcomingTopic 없는 상태로 `/admin/topics` → "지금 실행" (내일 날짜, 덮어쓰기 off)
2. Content 1행 + 3 ContentVariant 생성 확인
3. 최근 14일 중 같은 genre+keyPhrase 조합 없는지 확인
4. GenerationLog status=success, attempt=1

### 정상 생성 (UpcomingTopic override)
1. `/admin/topics` 에서 주제 예약 (date=내일, genre=Workplace, keyPhrase="burn out", hint="번아웃 대처법")
2. "지금 실행" → 생성 완료 → 생성된 Content.genre === "Workplace" && Content.keyPhrase === "burn out" 확인
3. 3 ContentVariant 의 paragraphs 안에 "burn out" 포함 확인

### 덮어쓰기
1. 위 실행 직후 같은 날짜로 다시 "지금 실행" (덮어쓰기 off) → 409 에러 + UI 메시지
2. 덮어쓰기 on 으로 다시 실행 → 기존 Content 삭제 + 새 Content 생성 (id 증가). GenerationLog 2건.

### 재시도 + fallback
1. AISetting 의 apiKey 를 일부러 잘못된 값으로 수정 (dev DB 시뮬레이션)
2. "지금 실행" → attempt=1 실패 → attempt=2 실패 → fallback 시 직전 Content 의 publishedAt 이 내일로 UPDATE 되었는지 확인
3. GenerationLog 3건 (running→failed, running→failed, fallback)
4. apiKey 복원

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
- AISetting `purpose` 분리 (인터뷰 vs 생성)
- 콘텐츠 품질 자동 평가 / A/B 테스트
- 프롬프트 버전 관리 (초기엔 Git history 로 충분)

## 롤백 / 비활성화 전략

AI 생성에 문제 발생 시:
1. `crontab -e` 에서 21:00 job 주석 처리 → cron 중단
2. Admin 이 수동으로 매일 3레벨 콘텐츠 작성 (Plan 1 의 UI) 로 전환
3. 문제 파악/수정 후 다시 cron 활성화

코드 롤백이 필요하면 본 Plan 의 5개 커밋을 `git revert` 로 되돌림. 스키마 변경(UpcomingTopic/GenerationLog) 은 `prisma migrate` 로 별도 migration 생성하여 table drop.

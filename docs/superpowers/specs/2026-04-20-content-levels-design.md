# routines.soritune.com — 콘텐츠 난이도 레벨 (초/중/고) 설계

**날짜**: 2026-04-20
**대상 프로젝트**: `/var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines/`
**스택**: Next.js (App Router) + NextAuth (admin 전용) + Prisma + MySQL
**관련**: 이 스펙은 **Plan 1** 에 해당. 후속 스펙 "2026-04-20-ai-content-generation-design.md" (Plan 2, AI 자동 생성) 가 이 스키마 위에 쌓일 예정.

## 배경 & 목표

routines.soritune.com 은 매일 하나의 영어 학습 주제를 제공한다. 사용자마다 영어 실력이 다르므로, **같은 주제를 초급/중급/고급 3개 레벨 버전으로** 제공하여 각자 자기 수준에 맞는 학습 경험을 얻게 한다.

이번 스펙은 **스키마, 사용자 UX, admin UX** 의 기반을 구축한다. 실제 콘텐츠는 admin 이 직접 3레벨 작성하거나 (후속 Plan 2 에서) AI 가 자동 생성한다. 본 Plan 은 AI 생성 로직을 포함하지 않는다.

## 결정 요약

| 항목 | 결정 |
|------|------|
| 레벨 간 공통 vs 분리 | 주제 정보(genre/title/subtitle/keyPhrase/keyKo)만 공통. 6 학습 단계(paragraphs/sentences/expressions/quiz/interview/speakSentences) 전부 레벨별 분리 |
| 스키마 | `Content` (주제) + `ContentVariant` (레벨별 학습 데이터 3행) 분리. `contentId × level` unique |
| 레벨 선택 persistence | localStorage (비로그인 파일럿). 추후 로그인 도입 시 User 테이블로 이관 |
| 최초 진입 UX | **강제 모달**: localStorage 가 비어 있으면 레벨 선택 모달 노출, 선택 전엔 콘텐츠 접근 불가 |
| 레벨 변경 | 전역 nav 에 상시 노출된 드롭다운 토글 |
| 전역 상태 | `LevelProvider` (React Context) + `useLevel()` 훅. localStorage 는 단지 영속 저장소, 페이지는 context 구독 |
| API fallback 기본값 | `intermediate` — **방어적 기본값만** (query param 누락/malformed 시). UX 상 모달은 사전 선택 없음 |
| Admin UI | 한 페이지 주제 입력 + 하단 3개 레벨 탭. **저장 시 3레벨 전부 강제** — 부분 상태 불허 |
| 기존 Content 마이그레이션 | 1건뿐이므로 **삭제 후 admin 이 새 UI 로 재작성** |
| Archive 페이지 | 주제 목록만 표시 (레벨 배지 없음). 클릭 시 현재 선택 레벨로 학습 진입 |
| 레벨 지표 | `AnalyticsEvent.metadata.level` 에 view/share/complete 이벤트마다 기록 (스키마 변경 없음) |

## 스키마

### 변경 전
```prisma
model Content {
  id             Int      @id @default(autoincrement())
  genre          String   @db.VarChar(50)
  title          String   @db.VarChar(255)
  subtitle       String?  @db.VarChar(255)
  keyPhrase      String   @map("key_phrase") @db.VarChar(255)
  keyKo          String   @map("key_ko") @db.VarChar(255)
  paragraphs     Json
  sentences      Json
  expressions    Json
  quiz           Json
  interview      Json
  speakSentences Json     @map("speak_sentences")
  publishedAt    DateTime? @map("published_at") @db.Date
  priority       Int      @default(0)
  isActive       Boolean  @default(true) @map("is_active")
  createdAt      DateTime @default(now()) @map("created_at")
  updatedAt      DateTime @updatedAt @map("updated_at")
  // relations...
}
```

### 변경 후
```prisma
model Content {
  id          Int       @id @default(autoincrement())
  genre       String    @db.VarChar(50)
  title       String    @db.VarChar(255)
  subtitle    String?   @db.VarChar(255)
  keyPhrase   String    @map("key_phrase") @db.VarChar(255)
  keyKo       String    @map("key_ko") @db.VarChar(255)
  publishedAt DateTime? @map("published_at") @db.Date
  priority    Int       @default(0)
  isActive    Boolean   @default(true) @map("is_active")
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")

  variants        ContentVariant[]
  progress        UserProgress[]
  analyticsEvents AnalyticsEvent[]
  shares          Share[]

  @@index([publishedAt, isActive, priority])
  @@map("contents")
}

model ContentVariant {
  id             Int          @id @default(autoincrement())
  contentId      Int          @map("content_id")
  level          ContentLevel
  paragraphs     Json
  sentences      Json
  expressions    Json
  quiz           Json
  interview      Json
  speakSentences Json         @map("speak_sentences")
  createdAt      DateTime     @default(now()) @map("created_at")
  updatedAt      DateTime     @updatedAt @map("updated_at")

  content Content @relation(fields: [contentId], references: [id], onDelete: Cascade)

  @@unique([contentId, level])
  @@map("content_variants")
}

enum ContentLevel {
  beginner
  intermediate
  advanced
}
```

**연관 모델**
- `UserProgress`, `AnalyticsEvent`, `Share` 는 `contentId` 참조 그대로 유지 (주제 단위 기록).
- 레벨별 진도/통계가 필요해지면 후속 작업에서 `level` 컬럼 추가 (본 Plan 범위 외).

## 마이그레이션

routines 프로젝트는 단일 `main` 브랜치 + 단일 DB 구조이지만, **Prisma 명령은 환경별로 분리**한다. `migrate dev` 는 개발자의 로컬 전용이고 운영 DB 에 실행하면 스키마 히스토리 드리프트/우발적 reset 위험이 있다.

### 로컬 (개발자 머신)
1. **Seed 업데이트**: `prisma/seed.ts` 에 예시 주제 + 3레벨 variant 데이터. `publishedAt=오늘` 로 테스트용.
2. **마이그레이션 파일 생성**: `pnpm prisma migrate dev --name add_content_variants` — Content 필드 drop, ContentVariant 테이블 생성, enum 추가. **생성된 `prisma/migrations/<timestamp>_add_content_variants/` 디렉토리를 git 에 커밋**.
3. 로컬 DB 에서 seed/동작 확인.

### 운영 (배포 시)
현재 routines 는 개발자 로컬 DB 와 운영 DB 가 동일 인스턴스인 파일럿 환경일 수 있다. 그래도 명령은 **운영 용도로 분리**:

1. **고지 후 기존 데이터 삭제**: `contents` 테이블 row 삭제 (현재 1건, `DELETE FROM contents WHERE id=1;`). 마이그레이션 직전에 실행.
2. **마이그레이션 적용**: `pnpm prisma migrate deploy` — 커밋된 migration 파일을 순서대로 적용. 새 migration 생성은 하지 않음. reset 위험 없음.
3. **Seed 실행**: `pnpm prisma db seed` — 예시 콘텐츠 1건 투입.
4. `pnpm build` + PM2 reload.

`prisma migrate dev` 를 운영에 **절대 사용하지 않는다**. 배포 문서/체크리스트에도 이 규칙을 명시.

## 사용자 UX

### 전역 상태: `LevelProvider` + `useLevel()`

레벨 변경을 모든 페이지가 감지하려면 공유 클라이언트 상태가 필요하다. localStorage 만 업데이트하면 이미 mount 된 페이지가 갱신되지 않는다 (`/today` 등은 현재 mount 시 한 번만 fetch).

**신설 파일**: `src/contexts/level-context.tsx`

```typescript
// Shape (요약)
type Level = "beginner" | "intermediate" | "advanced";
interface LevelContextValue {
  level: Level | null;       // null = 미선택 (첫 방문)
  setLevel: (l: Level) => void;
  ready: boolean;            // localStorage 읽기 완료 플래그 (SSR hydration 대응)
}
```

- `LevelProvider` 는 mount 시 localStorage 읽어 state 초기화 → `ready=true`.
- `setLevel` 호출 시 localStorage 업데이트 + state 업데이트 → consumer 페이지가 자동 re-render.
- 배치 위치: `(main)/layout.tsx` 에서 wrap (admin 영역은 자연스레 제외).

### LevelGate (최초 방문 강제 선택)

**신설 파일**: `src/components/level-gate.tsx` (client component)

- `(main)/layout.tsx` 에서 `<LevelProvider>` 하위에 `<LevelGate>` 배치.
- `useLevel()` 로 `{ level, ready }` 구독.
- `ready=false` 동안 스켈레톤/빈 화면 (hydration flash 방지).
- `ready=true && level===null` 이면 모달 렌더, children 숨김:
  ```
  영어 레벨을 선택해주세요

  [초급]  쉬운 단어, 많은 주석
  [중급]  자연스러운 영어
  [고급]  원어민 수준

  * 언제든 상단에서 변경할 수 있습니다
  ```
- **사전 선택 없음** — 사용자가 명시적으로 선택해야 진행. 기본값/하이라이트 중급 같은 시각적 유도도 없음.
- 버튼 클릭 시 `setLevel(selected)` 호출 → provider 갱신 → 모달 사라짐 + children 렌더.
- `ready=true && level!==null` 이면 children 즉시 렌더.

**admin 영역**: `(admin)/admin/layout.tsx` 는 별도이므로 `<LevelGate>` 와 무관. 경로 판별 로직 불필요.

### 상단 nav 의 레벨 토글

**신설 파일**: `src/components/level-toggle.tsx`

- `useLevel()` 로 `{ level, setLevel }` 구독.
- 드롭다운: 현재 level 표시 (`초급 ▾` / `중급 ▾` / `고급 ▾`).
- 열면 3개 옵션 버튼 → 클릭 시 `setLevel(new)` 호출.
- provider 가 localStorage 업데이트 + 모든 consumer 재렌더를 담당하므로 토글 자체는 로직이 단순.
- 배치: `src/components/nav.tsx` 의 데스크톱 링크 줄 우측 + 모바일 햄버거 메뉴 내 2개 링크 아래.
- **Admin nav (`AdminSidebar`) 에는 배치하지 않음**.

### 학습 페이지 refetch 패턴

`/today`, `/learn/[contentId]/{reading,listening,expressions,quiz,interview,speaking}` 각 페이지:

```typescript
const { level, ready } = useLevel();

useEffect(() => {
  if (!ready || !level) return;      // gate 가 통과되기 전엔 fetch 안 함
  let cancelled = false;
  fetch(`/api/content/today?level=${level}`)
    .then(r => r.ok ? r.json() : null)
    .then(data => { if (!cancelled) setContent(data); });
  return () => { cancelled = true; };
}, [level, ready]);
```

- `level` 의존성으로 사용자가 토글 클릭해 level 바꾸면 즉시 재호출 → variant 교체.
- AbortController 까진 가지 않고 `cancelled` 플래그로 stale response 무시 (Next.js 프로젝트 기존 패턴 따름).

### 아카이브 페이지

- `/api/content` 응답 shape 유지 (주제 메타데이터 배열, level 무관).
- 카드 UI 변경 없음 (레벨 배지 없음).
- 클릭 시 `/learn/[id]/reading` 이동 → `useLevel()` 통해 현재 레벨 variant 로드.

### 공유 / 이벤트 (레벨 지표 포함)

레벨별 소비 측정을 위해 **본 Plan 범위 안에** 이벤트에 level 을 기록. 스키마 변경 없음 — `AnalyticsEvent.metadata` 는 이미 JSON.

- `/today` 페이지의 view 이벤트:
  ```json
  { "type": "view", "contentId": 123, "metadata": { "level": "beginner" } }
  ```
- `/learn/.../complete` 에서 share 호출 시:
  ```json
  { "contentId": 123, "channel": "copy", "metadata": { "level": "beginner" } }
  ```
- `/api/events` 와 `/api/share` 는 기존 optional-auth 그대로. `metadata` 필드 파싱 없이 그대로 DB 에 저장 (`metadata: metadata ?? null` 이미 처리됨).
- Plan 2 (AI 생성) 가 "어느 레벨이 많이 쓰이는가" 를 분석할 수 있도록 함.

## Admin UX

### `/admin/content/new` & `/admin/content/[id]/edit`

**페이지 구조**
1. 상단 공통 섹션: genre, title, subtitle, keyPhrase, keyKo, publishedAt, priority, isActive.
2. 하단 레벨 탭: `[초급]` `[중급]` `[고급]` — 활성 탭만 입력 필드 표시.
3. 각 탭 내부: paragraphs, sentences, expressions, quiz, interview, speakSentences (JSON 텍스트영역).
4. 하단 저장 버튼: 저장 시도 시 클라이언트 사이드 검증 — 3레벨 전부 6개 필드 유효한 JSON 이어야 함. 하나라도 실패하면 해당 탭 강조 + 에러 메시지.

**컴포넌트 분할**
- 현재 `src/components/admin/content-form.tsx` 는 100+ 라인. 3탭 추가하면 더 커짐.
- 리팩터: `ContentTopicFields` (공통 상단), `ContentVariantFields` (레벨 1개당 6필드), `ContentForm` (조합 + 저장 로직).

**서버 API (`POST/PATCH /api/admin/content`, `PATCH /api/admin/content/[id]`)**
- Request body shape:
  ```json
  {
    "genre": "...", "title": "...", "subtitle": "...",
    "keyPhrase": "...", "keyKo": "...",
    "publishedAt": "2026-04-20", "priority": 0, "isActive": true,
    "variants": [
      { "level": "beginner",     "paragraphs": [...], "sentences": [...], ... },
      { "level": "intermediate", "paragraphs": [...], "sentences": [...], ... },
      { "level": "advanced",     "paragraphs": [...], "sentences": [...], ... }
    ]
  }
  ```
- 서버 검증: `variants` 배열이 정확히 3개, 3개 level 값이 모두 존재, 각 variant 의 6개 필드 존재.
- 트랜잭션으로 `Content` + 3 `ContentVariant` 생성 (new) 또는 upsert (edit).

### `/admin/content` 목록

- 기존과 동일 (Content 주제 row 목록).
- Variant 개수 뱃지 **없음** — 저장 시 3/3 강제이므로 2/3 상태는 정상 경로에서 발생 불가.
- (DB 직접 손상 같은 비정상 상태 복구는 본 Plan 범위 외 — `prisma studio` 등 관리 도구로 해결.)

### Admin 영역 격리
- `<LevelGate>` / `<LevelProvider>` 는 `(main)/layout.tsx` 안에만 존재. `(admin)/admin/layout.tsx` 는 별도 라우트 그룹 레이아웃이므로 자연스레 격리.
- `/admin/login` 에도 모달 없음 (미인증 admin 진입 지점).

## API 변경 요약

| 엔드포인트 | 변경 |
|-----------|------|
| `GET /api/content/today?level=<level>` | level 파라미터 수용. `Content` + 해당 level 의 `ContentVariant` join 반환. **level 누락/invalid 시 fallback `intermediate`** (방어). variant 가 DB 에 없으면 서버 로그 경고 + intermediate variant 반환. |
| `GET /api/content/[id]?level=<level>` | 동일한 fallback 규칙. |
| `GET /api/content` | 변경 없음 (주제 메타만 반환) |
| `GET /api/admin/content` | variants 포함해서 반환 (admin 편집 UI 용) |
| `GET /api/admin/content/[id]` | 동일 |
| `POST /api/admin/content` | request body shape 변경 (variants 배열 3개 강제). 3개 아니면 400. |
| `PATCH /api/admin/content/[id]` | 동일 shape. 트랜잭션 upsert |
| `POST /api/events` | body 변경 없음. 클라이언트가 `metadata.level` 포함해서 전송 (서버는 이미 그대로 저장). |
| `POST /api/share` | body 변경 없음. 위와 동일. |

**Variant 누락 fallback 철학**
- 정상 경로: admin 이 항상 3/3 저장하므로 존재.
- 비정상 경로 (DB 직접 수정, 마이그레이션 중간 상태 등): 사용자에게 404 대신 intermediate variant 로 **graceful degrade**. 서버 로그에 `console.warn("variant missing", { contentId, requestedLevel })` 로 기록해 운영 이슈 포착.

**응답 shape (사용자용)**
```typescript
// /api/content/today?level=beginner 응답 예
{
  id: number,
  genre: string, title: string, subtitle: string,
  keyPhrase: string, keyKo: string,
  publishedAt: string,
  level: "beginner",
  paragraphs: [...], sentences: [...], expressions: [...],
  quiz: [...], interview: [...], speakSentences: [...]
}
```

(현재 API 응답 shape 와 동일한 필드 평탄화 — 프론트엔드 학습 페이지 수정 최소화. `level` 필드는 디버깅/공유용 optional.)

## 변경 파일 예상 목록

### Modify
- `prisma/schema.prisma` — Content 분리, ContentVariant 추가, enum
- `prisma/seed.ts` — 3레벨 seed 데이터
- `src/app/api/content/today/route.ts` — level 파라미터 + variant join
- `src/app/api/content/[id]/route.ts` — 동일
- `src/app/api/admin/content/route.ts` — variants 배열 body 처리
- `src/app/api/admin/content/[id]/route.ts` — 동일
- `src/app/(main)/layout.tsx` — `<LevelProvider>` + `<LevelGate>` 래핑 (루트 `app/layout.tsx` 는 변경 없음)
- `src/components/nav.tsx` — `<LevelToggle>` 삽입
- `src/components/admin/content-form.tsx` — 3탭 UI 로 분할/재구성
- `src/app/(main)/today/page.tsx` — `useLevel()` 사용 + view 이벤트에 metadata.level
- `src/app/(main)/learn/[contentId]/{reading,listening,expressions,quiz,interview,speaking}/page.tsx` — 6 페이지 `useLevel()` 사용
- `src/app/(main)/learn/[contentId]/complete/page.tsx` — share 호출에 metadata.level
- `src/app/(admin)/admin/content/new/page.tsx`, `[id]/edit/page.tsx` — 3탭 폼 호출

### Create
- `src/contexts/level-context.tsx` — `LevelProvider` + `useLevel()` 훅
- `src/components/level-gate.tsx` — 최초 방문 모달
- `src/components/level-toggle.tsx` — nav 드롭다운 (mobile/desktop 공용)
- `src/components/admin/content-topic-fields.tsx` — 공통 필드 입력 (Content 분할)
- `src/components/admin/content-variant-fields.tsx` — 레벨 1개용 6필드 입력
- `src/lib/level.ts` — level 상수/유효성 유틸 + fallback 기본값 상수 `DEFAULT_LEVEL = "intermediate"`

### Delete
- 없음 (이 Plan 에서는)

## 검증 시나리오

### 비로그인 사용자
1. 시크릿 창 / localStorage 비어 있는 상태로 `/today` 진입 → **레벨 선택 모달 뜸** (사전 선택 없음). 콘텐츠 접근 불가.
2. "중급" 선택 → 모달 닫힘, `/today` 정상 렌더. `analytics_events` 에 `{type:view, level:intermediate}` 기록됨.
3. localStorage 확인 → `routines_level=intermediate`.
4. `/today` 에서 nav 토글 "고급" 선택 → useLevel context 변경 → **페이지 자동 refetch**, 고급 variant 표시. 새 view 이벤트 level=advanced 로 기록.
5. `/archive` 진입 → 주제 목록 정상 (레벨 뱃지 없음). 항목 클릭 → `/learn/[id]/reading` 에서 현재 레벨(고급) variant 표시.
6. 6단계 학습 완주 → `/complete` 에서 "Share Result" 클릭 → `/api/share` 에 `metadata.level=advanced` 전달. DB 확인.
7. `/` 랜딩 페이지 진입 시도 → `(main)` 레이아웃이 아니므로 gate 없음. "오늘 학습 시작하기" 클릭 → `/today` 이동 시 gate 작동.
8. `/admin/login` 진입 → 모달 **안 뜸** (admin 영역 격리 확인).
9. 브라우저 localStorage 전체 삭제 → 다음 방문 시 `/today` 에서 다시 모달 뜸.

### Admin
1. `/admin/login` → 로그인 (모달 안 뜸).
2. `/admin/content/new` → 상단 공통 필드 + 3탭 입력 UI.
3. 초급 탭만 채우고 저장 시도 → 검증 에러 (중급/고급 필수).
4. 3탭 모두 JSON 유효하게 채움 → 저장 성공. DB 에 `Content` 1행 + `ContentVariant` 3행 생성 확인.
5. `/admin/content` 목록에 새 행이 나타남 (variant 뱃지 없음).
6. 생성한 Content 편집 → 초급 탭의 quiz JSON 수정 → 저장 → 해당 variant 갱신.
7. 생성한 Content 삭제 → cascade 로 ContentVariant 3행 함께 삭제 (DB 확인).

### 마이그레이션 (로컬)
1. `pnpm prisma migrate dev --name add_content_variants` → 성공, migration 파일 생성됨.
2. `pnpm prisma db seed` (로컬) → 테스트 데이터 확인.
3. Migration 파일 `prisma/migrations/<timestamp>_add_content_variants/` git 커밋.

### 마이그레이션 (운영)
1. 배포 전 `DELETE FROM contents WHERE id=1;` (admin 고지 후).
2. `pnpm prisma migrate deploy` → 커밋된 migration 파일 적용. 새 마이그레이션 생성 안 함.
3. `pnpm prisma db seed` → 예시 콘텐츠 1건 투입.
4. `pnpm build` + `pm2 reload ecosystem.config.js --update-env` → `/today` 정상 표시.

### Fallback 동작
1. 수동으로 DB 에서 특정 variant 1개 삭제 → `/today?level=<deleted>` 요청 → 서버 로그에 `variant missing` 경고 + intermediate variant 로 응답. 사용자는 콘텐츠 볼 수 있음.

## 배포

- 기능별 6개 커밋으로 분할 (revert 쉽게):
  1. Prisma 스키마 변경 + migration 파일 (로컬에서 `migrate dev` 생성) + seed 업데이트
  2. `LevelProvider` context + `LevelGate` + `LevelToggle` 컴포넌트 신설
  3. 사용자 API (`/api/content/today`, `/api/content/[id]`) 레벨 지원 + fallback
  4. Admin API (`/api/admin/content/*`) variants 배열 처리 + 3/3 강제
  5. Admin 폼 (3탭 UI) 재구성 — ContentForm 분할
  6. 사용자 학습 페이지 (today + 6 학습 스텝 + complete) `useLevel()` 사용 + 이벤트 metadata.level + `(main)/layout.tsx` 에 Provider/Gate 래핑 + nav 토글 삽입

- 각 커밋 후 `pnpm build` 로 타입/빌드 확인.
- 마지막 커밋 후 로컬에서 수동 검증 (검증 시나리오 실행).
- 운영 DB 에 `DELETE FROM contents WHERE id=1` → `pnpm prisma migrate deploy` → `pnpm prisma db seed` → `pm2 reload` 순서로 배포.
- GitHub push.

## Plan 2 (후속) 에서 다룰 사항

본 Plan 범위 외, 후속 스펙에서 정의:
- `UpcomingTopic` 테이블 (admin 이 미리 지정하는 주제 스케줄)
- AI 2단계 생성 서비스 (공통 정보 → 3레벨 병렬)
- Cron (21:00 KST 매일, `publishedAt=내일` draft 생성)
- 생성 실패 fallback (어제 콘텐츠 유지)
- Admin 생성 이력/draft 검토 UI

## 본 Plan 에서 하지 않는 것

- AI 자동 생성
- 레벨별 진도 추적 (UserProgress.level)
- 레벨별 아카이브 필터
- 구독 로직 (이미 이전 Plan 에서 제거됨)

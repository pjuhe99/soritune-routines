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
| 기본값 | `intermediate` (중급) |
| Admin UI | 한 페이지 주제 입력 + 하단 3개 레벨 탭. 3레벨 모두 채워야 저장 가능 |
| 기존 Content 마이그레이션 | 1건뿐이므로 **삭제 후 admin 이 새 UI 로 재작성** |
| Archive 페이지 | 주제 목록만 표시 (레벨 배지 없음). 클릭 시 현재 선택 레벨로 학습 진입 |

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

1. **고지 후 기존 데이터 삭제**: 프로덕션 DB `contents` 테이블 row 삭제 (현재 1건, `DELETE FROM contents WHERE id=1;`).
2. **Prisma migration**: `pnpm prisma migrate dev --name add_content_variants` — Content 필드 drop, ContentVariant 테이블 생성, enum 추가.
3. **Seed 업데이트**: `prisma/seed.ts` 에 Morning Routines (또는 다른 예시) 주제 + 3레벨 variant 완비 데이터로 갱신. `publishedAt=오늘` 로 설정.
4. **Seed 실행**: `pnpm prisma db seed` 로 테스트 데이터 투입.

## 사용자 UX

### 최초 방문 모달 (강제 선택)

- 루트 레이아웃에 `<LevelGate>` 클라이언트 컴포넌트 포함.
- 마운트 시 `localStorage.getItem("routines_level")` 확인.
- 값 없으면 모달 표시:
  ```
  영어 레벨을 선택해주세요

  [초급]  쉬운 단어, 많은 주석
  [중급]  자연스러운 영어
  [고급]  원어민 수준

  * 언제든 상단에서 변경할 수 있습니다
  ```
- 선택 시 `localStorage.setItem("routines_level", <value>)` 후 모달 닫힘.
- 값 있으면 모달 스킵, children 즉시 렌더.
- Admin 영역(`/admin/**`)은 모달 대상에서 제외 (admin 은 콘텐츠 관리자이므로 개인 레벨 개념이 필요 없음).

### 상단 nav 의 레벨 토글

- 기존 nav 데스크톱 메뉴 ("오늘의 학습 / 아카이브") 옆에 드롭다운: `초급 ▾` / `중급 ▾` / `고급 ▾` (현재 선택 표시).
- 드롭다운 열면 3개 옵션 → 클릭 시:
  1. `localStorage.setItem("routines_level", newLevel)`
  2. 현재 페이지 상태 갱신 (router refresh 또는 학습 페이지의 경우 variant re-fetch)
- 모바일에서는 햄버거 메뉴 안에 배치 (기존 2개 링크 아래).

### 학습 페이지

- `/today`, `/learn/[contentId]/{reading,listening,expressions,quiz,interview,speaking}`:
  - 마운트 시 localStorage 레벨 읽어 상태 저장.
  - API 호출: `/api/content/today?level=<selectedLevel>`, `/api/content/${id}?level=<selectedLevel>`.
  - 레벨 변경 이벤트 발생 시 (토글 클릭) 해당 variant 를 즉시 re-fetch.

### 아카이브 페이지

- `/api/content` 응답 shape 유지 (주제 메타데이터 배열).
- 카드 UI 변경 없음 (레벨 배지 없음).
- 클릭 시 `/learn/[id]/reading` 이동 → 해당 페이지에서 현재 레벨 variant 로드.

### 공유 / 이벤트
- `/api/share`, `/api/events` 현재 구조 유지.
- `metadata.level` 추가는 본 Plan 범위 외 (후속 관찰 지표 추가 시 검토).

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
- 각 행에 뱃지: "3/3 variants" (완비) 또는 "2/3" (색 다르게) 등 — variant 개수 표시.

### Admin 영역의 레벨 모달 제외
- `/admin/**` 에 진입 시 `<LevelGate>` 로직은 작동하지 않도록 배제 (Admin 은 콘텐츠 관리자 관점이지 학습자가 아님).
- `/admin/login` 에도 모달 없음 (미인증 상태).

## API 변경 요약

| 엔드포인트 | 변경 |
|-----------|------|
| `GET /api/content/today?level=<level>` | level 파라미터 수용. `Content` + 해당 level 의 `ContentVariant` join 반환. level 누락 시 기본값 `intermediate`. |
| `GET /api/content/[id]?level=<level>` | 동일. 존재하지 않는 level variant 이면 `404 { error: "Variant not found for this level" }` |
| `GET /api/content` | 변경 없음 (주제 메타만 반환) |
| `GET /api/admin/content` | variants 포함해서 반환 (admin 편집 UI 용) |
| `GET /api/admin/content/[id]` | 동일 |
| `POST /api/admin/content` | request body shape 변경 (variants 배열 3개) |
| `PATCH /api/admin/content/[id]` | 동일 shape. 트랜잭션 upsert |

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
- `src/app/api/content/today/route.ts`
- `src/app/api/content/[id]/route.ts`
- `src/app/api/admin/content/route.ts`
- `src/app/api/admin/content/[id]/route.ts`
- `src/app/layout.tsx` — `<LevelGate>` 포함
- `src/components/nav.tsx` — 레벨 토글 추가
- `src/components/admin/content-form.tsx` — 3탭 UI 로 재구성 (또는 분할)
- `src/app/(main)/today/page.tsx` — level 파라미터 사용
- `src/app/(main)/learn/[contentId]/{reading,listening,expressions,quiz,interview,speaking}/page.tsx` — 6 페이지 전부 level 파라미터 사용
- `src/app/(admin)/admin/content/page.tsx` — variant 뱃지
- `src/app/(admin)/admin/content/new/page.tsx`, `[id]/edit/page.tsx` — 3탭 폼 호출

### Create
- `src/components/level-gate.tsx` — 모달 + localStorage 가드
- `src/components/level-toggle.tsx` — nav 드롭다운 (mobile/desktop 공용 또는 분리)
- `src/components/admin/content-topic-fields.tsx` — 공통 필드 입력
- `src/components/admin/content-variant-fields.tsx` — 레벨 1개용 필드 입력
- `src/lib/level.ts` (옵션) — level 상수/유효성 유틸

### Delete
- 없음 (이 Plan 에서는)

## 검증 시나리오

### 비로그인 사용자
1. 시크릿 창 / localStorage 비어 있는 상태로 `/` 진입 → **레벨 선택 모달 뜸**. 콘텐츠 접근 불가.
2. "중급" 선택 → 모달 닫힘, `/today` 정상 렌더.
3. localStorage 확인 → `routines_level=intermediate`.
4. `/today` 에서 nav 토글 "고급" 선택 → 현재 페이지 refetch, 고급 variant 표시.
5. `/archive` 진입 → 주제 목록 정상. 항목 클릭 → `/learn/[id]/reading` 에서 현재 레벨(고급) variant 표시.
6. 6단계 학습 완주 → `/complete` 정상 (streak/progress 저장 없음은 기존과 동일).
7. 브라우저 쿠키/localStorage 전체 삭제 → 다음 방문 시 다시 모달 뜸.

### Admin
1. `/admin/login` → 로그인 (모달 안 뜸).
2. `/admin/content/new` → 상단 공통 필드 + 3탭 입력 UI.
3. 초급 탭만 채우고 저장 시도 → 검증 에러 (중급/고급 필수).
4. 3탭 모두 JSON 유효하게 채움 → 저장 성공. DB 에 `Content` 1행 + `ContentVariant` 3행 생성 확인.
5. `/admin/content` 목록에서 방금 생성한 행에 "3/3 variants" 뱃지 표시.
6. 생성한 Content 편집 → 초급 탭의 quiz JSON 수정 → 저장 → 해당 variant 갱신.
7. 생성한 Content 삭제 → cascade 로 ContentVariant 3행 함께 삭제 (DB 확인).

### 마이그레이션
1. 배포 전 `contents` 테이블 비움 (기존 1건 삭제).
2. `pnpm prisma migrate dev --name add_content_variants` → 성공, 새 테이블 생성 확인.
3. `pnpm prisma db seed` → Morning Routines 3레벨 주입 확인.
4. `pnpm build` 성공 + PM2 reload → `/today` 정상 표시.

## 배포

- 단일 커밋이 아닌 기능별 5-6개 커밋으로 분할 (revert 쉽게):
  1. Prisma 스키마 + 마이그레이션 + seed
  2. `<LevelGate>` + `<LevelToggle>` 컴포넌트 신설
  3. 사용자 API (`/api/content/today`, `/api/content/[id]`) 레벨 지원
  4. Admin API (`/api/admin/content/*`) 레벨 지원
  5. Admin 폼 (3탭 UI) 재구성
  6. 사용자 학습 페이지 8개 (today + 6 학습 스텝 + archive) 레벨 파라미터 전달
- PM2 reload 후 브라우저 수동 검증.
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

# Level Tabs & Progress Bar Redesign — Design Spec

**Date**: 2026-04-27
**Project**: routines.soritune.com
**Status**: Ready for plan

## Goal

학습 페이지의 레벨 선택 UX 를 모달 차단 → 상단 탭 방식으로 바꾸고, 6단계 진행률을 항상 보이는 프로그레스 바로 노출한다. 동시에 메인 페이지 진입 흐름을 단순화한다 (`/` → `/today` → `/learn` 3단 → `/` → `/learn` 2단).

## Non-Goals

- 학습 콘텐츠 자체(텍스트, 인터뷰 질문, 퀴즈) 변경
- 새로운 step 추가 또는 기존 step 의 순서 변경
- 회원/관리자 인증 흐름 변경
- /archive 페이지 UI 개편 (항목 클릭 동작만 영향)
- 모바일 전용 별도 레이아웃

## 정책 결정 (사용자 승인)

| 결정 | 선택 |
|------|------|
| 진행 중 레벨 변경 정책 | **B**: 자유 변경 + 레벨별 progress 분리 (스키마 변경) |
| 학습 페이지 진입 시 기본 탭 | **a**: 항상 초급 (저장 없음) |
| 메인/today 페이지 정리 | **b**: `/today` 폐기, `/` 가 학습 진입점 (hero + 6단계 미리보기 + 시작하기) |
| 프로그레스 바 클릭 정책 | **복습 허용 / 미래 잠금**: 완료 단계 클릭 = 복습, 미래 단계 = 회색 비활성 |
| 다른 레벨 탭 클릭 동작 | **그 레벨의 진행 위치로 점프**: 0/6이면 reading, 4/6이면 quiz |
| 시각 스타일 | **A**: Pill 탭 + 6칸 세그먼트 바 + 작은 라벨 |

---

## 1. 아키텍처 & 페이지 구조

### 페이지 트리 변경

| 경로 | Before | After |
|------|--------|-------|
| `/` | hero + 미리보기 카드 + 버튼(→/today) | **메인 = 학습 진입점**: hero + 오늘 콘텐츠 카드 + 6단계 미리보기 + "시작하기" 버튼 (→ `/learn/[id]/reading`) |
| `/today` | 콘텐츠 정보 + step list + 시작하기 | **삭제**. `/today` 접근 시 `/` 로 redirect (북마크 보호용) |
| `/learn/[id]/{step}` | 각 step 페이지, 상단 라벨만 | **shared layout 변경**: 상단에 LevelTabs + ProgressBar 영구 노출. step 페이지는 본문만 |
| `/learn/[id]/complete` | 완료 화면 | 그대로 유지. layout 의 LevelTabs/ProgressBar 가 6/6 표시된 채로 같이 보임 |
| `/archive` | 과거 콘텐츠 리스트 | 그대로 유지. 항목 클릭 시 `/learn/[id]/reading` (default 초급) |

### Next.js 구조

- **새 layout**: `src/app/(main)/learn/[contentId]/layout.tsx` 확장 — 기존 `SpeechProvider` 유지 + 새 `LearnTopBar` 컴포넌트 추가. step 페이지 6개는 그대로 분리 (라우팅 재구조 없음).
- **메인 페이지**: `src/app/(main)/page.tsx` 가 기존 `/today` 의 step list UI 를 흡수. server component로 컨텐츠 fetch (default level=beginner).
- **today 페이지**: `src/app/(main)/today/page.tsx` 는 `redirect('/')` 한 줄짜리 파일로 축소.
- **공통 layout**: `src/app/(main)/layout.tsx` 의 `<LevelProvider>`, `<LevelGate>` 제거. 헤더만 남김.

### 왜 이 구조인가

- **라우팅 재구조 안 함**: 기존 6 step 페이지가 각각 substantial logic (interview chat, recording, quiz, etc.). 단일 라우트로 합치면 큰 refactor + state 관리 복잡도 ↑. 공유 layout 으로 충분.
- **LevelContext → URL searchParams**: 탭 전환 시 server component 가 올바른 레벨로 데이터 prefetch 가능, 북마크/공유 가능, "default = beginner" 가 자연스럽게 충족 (`?level=` 없으면 beginner).

---

## 2. 데이터 모델 변경

### Prisma 스키마: `UserProgress`

**Before**:
```prisma
model UserProgress {
  id        Int           @id @default(autoincrement())
  userId    Int
  contentId Int
  step      LearningStep
  completed Boolean       @default(false)
  skipped   Boolean       @default(false)
  // ...
  @@unique([userId, contentId, step])
  @@map("user_progress")
}
```

**After**:
```prisma
model UserProgress {
  id        Int           @id @default(autoincrement())
  userId    Int
  contentId Int
  level     ContentLevel  // ★ 추가
  step      LearningStep
  completed Boolean       @default(false)
  skipped   Boolean       @default(false)
  // ...
  @@unique([userId, contentId, level, step])  // ★ unique 키에 level 추가
  @@index([userId, contentId, level])         // ★ 탭 진입시 진행률 조회 인덱스
  @@map("user_progress")
}
```

`ContentLevel` enum (`beginner`/`intermediate`/`advanced`) 은 이미 존재 (`ContentVariant`, `InterviewAnswer`). 그대로 재사용.

### 마이그레이션

DB 상태 확인 결과: `user_progress` / `interview_answers` / `recordings` 모두 **0 rows**, `users` 3 (테스트 계정). 백필 불필요.

```sql
-- prisma/migrations/<timestamp>_add_level_to_user_progress/migration.sql
ALTER TABLE user_progress
  ADD COLUMN level ENUM('beginner','intermediate','advanced') NOT NULL;

ALTER TABLE user_progress
  DROP INDEX user_progress_userId_contentId_step_key;

ALTER TABLE user_progress
  ADD UNIQUE KEY user_progress_userId_contentId_level_step_key
  (userId, contentId, level, step);

CREATE INDEX user_progress_userId_contentId_level_idx
  ON user_progress(userId, contentId, level);
```

NOT NULL DEFAULT 없이 가능 (테이블 비어있음). 0 rows 가정이 깨지면 (실행 직전 누가 작성) 마이그레이션 실패하므로, 실행 직전 한 번 더 `SELECT COUNT(*) FROM user_progress;` 확인.

### 새 헬퍼

`src/lib/progress.ts` (신규):

```ts
export async function nextStepForLevel(
  userId: number,
  contentId: number,
  level: ContentLevel
): Promise<LearningStep | 'complete'>
```
로직: 그 (userId, contentId, level) 의 user_progress 중 completed=false 인 가장 작은 step 순서. 전부 완료면 `'complete'` 리턴.

```ts
export async function progressMapForLevel(
  userId: number,
  contentId: number,
  level: ContentLevel
): Promise<Record<LearningStep, { completed: boolean; skipped: boolean }>>
```
ProgressBar 가 6칸을 한 번에 그릴 데이터.

```ts
export async function progressSummaryByLevel(
  userId: number,
  contentId: number
): Promise<Record<ContentLevel, { nextStep: LearningStep | 'complete'; completedCount: number }>>
```
LevelTabs 가 3개 레벨 각각의 진행 위치를 알기 위한 가벼운 객체 (탭 클릭 시 점프 대상).

### 영향 받는 API

| 엔드포인트 | 변경 |
|------------|------|
| `POST /api/progress/[contentId]` | body 에 `level` 추가, upsert 키에 level 포함, streak 증가 조건 변경 (아래 참조) |
| `GET /api/progress/[contentId]` | `?level=` query 추가. 그 레벨의 6단계 상태만 반환 |
| 모든 컨텐츠 fetch (`/api/content/today`, `/api/content/[id]`, `/api/interview-answer`, `/api/ai/interview`) | 변경 없음 (이미 `?level=` 사용 중) |

### Streak 정책

새 정책: **한 글당 한 번만 streak +1** (어느 레벨로 6/6 했는지 무관).
- 구현: `POST /api/progress` 에서 6/6 done 검증 통과 후, `analytics_events` 에서 `type='complete' AND contentId=X AND userId=Y` 가 이미 있는지 확인. 있으면 streak skip, `complete` 이벤트도 새로 기록 ❌ (또는 metadata 만 업데이트). 없으면 streak +1 + `complete` 이벤트 기록.
- 사용자 영향: 같은 글을 다른 레벨로 또 풀어도 streak 추가 ❌. 이건 기존에는 모호했던 부분이고, 사용자 합의 정책.

### 변경 없는 모델
- `InterviewAnswer`, `Recording`, `ContentVariant` — 이미 level 분리되어 있음

---

## 3. 컴포넌트 & URL/상태 흐름

### 새 컴포넌트

#### `<LearnTopBar contentId currentLevel currentStep progress progressByLevel />`
- `learn/[contentId]/layout.tsx` 에서 렌더링
- 내부에 `<LevelTabs>` + `<ProgressBar>` 배치
- props 의 `currentLevel` 은 URL searchParams 에서, `progress`/`progressByLevel` 은 server-side fetch 결과

#### `<LevelTabs currentLevel contentId currentStep progressByLevel />` (client)
- 3개 pill 버튼 (초급/중급/고급), 현재 레벨 active
- 다른 레벨 클릭 시: 그 레벨의 `nextStep` 으로 `router.push(/learn/${contentId}/${nextStep}?level=${newLevel})`
- 6/6 완료된 레벨이면 `nextStep='complete'` → `/learn/${contentId}/complete?level=${newLevel}`
- `progressByLevel` 로 탭에 미니 정보 노출 가능 (선택, MVP 에서는 생략)

#### `<ProgressBar level contentId currentStep progress />` (client)
- 6칸 세그먼트 바 + 작은 라벨 (mockup A 그대로)
- 클릭 가능 조건:
  - 완료 단계 (`progress[step].completed === true`): `Link` 로 그 step 페이지 이동 (복습)
  - 현재 단계: 비활성 (이미 그 페이지)
  - 미래 단계: `disabled`, 회색, 클릭 무반응
- 시각: 완료=녹색(`#10b981`), 현재=인디고(`#4f46e5`), 미래=옅은 회색(`#e2e8f0`)
- 모바일 (가로 폭 < 480px): 라벨 글자 9px, 줄바꿈 허용. 정 안 되면 라벨 숨기고 "3/6 · 표현" 텍스트로 축약

### URL & 상태 모델

**Source of truth = URL `?level=` query param**
- 기본값: 없으면 `beginner` (server component 가 처리)
- 탭 전환 = `router.push` 로 URL 업데이트 + 다른 step 으로 이동
- 모든 step 페이지 사이 navigation (예: 다음 step 버튼) 은 현재 `?level=` 유지 — `Link` 의 `href` 에 query 포함

### Server component 패턴 (`learn/[contentId]/layout.tsx`)

```ts
export default async function LearnLayout({ params, searchParams, children }) {
  const level = parseLevel(searchParams.level) ?? 'beginner';
  const userId = await getUserIdFromCookie();
  const progress = await progressMapForLevel(userId, params.contentId, level);
  const progressByLevel = await progressSummaryByLevel(userId, params.contentId);
  const currentStep = inferCurrentStepFromUrl(); // route segment 에서

  return (
    <>
      <LearnTopBar
        contentId={params.contentId}
        currentLevel={level}
        currentStep={currentStep}
        progress={progress}
        progressByLevel={progressByLevel}
      />
      <SpeechProvider>{children}</SpeechProvider>
    </>
  );
}
```

각 step 페이지도 서버/클라이언트 모두 `searchParams.level` 을 읽고 그 레벨의 `ContentVariant` fetch.

### 메인 페이지 (`(main)/page.tsx`)

서버 컴포넌트로 변환. 오늘 콘텐츠 fetch + 6단계 미리보기 표시 + "시작하기" 버튼:

```tsx
<Link href={`/learn/${todaysContent.id}/reading`}>시작하기</Link>
```

`?level=` 빠지므로 `/learn/...` 진입 시 default = beginner (정책 a).
기존 `/today` 페이지의 6단계 step list UI 를 메인으로 이식 (`STEPS` 배열 + 번호 동그라미 + 화살표).

### 제거되는 파일/심볼

| 파일 | 처리 |
|------|------|
| `src/components/level-gate.tsx` | 삭제 |
| `src/components/level-toggle.tsx` | 삭제 |
| `src/contexts/level-context.tsx` | 삭제 |
| `src/lib/level.ts` (localStorage 로직) | 삭제 또는 `parseLevel(string)` 유틸만 남기고 축소 |
| `src/app/(main)/today/page.tsx` | `redirect('/')` 한 줄로 축소 |
| `src/app/(main)/layout.tsx` 내 `<LevelProvider>`, `<LevelGate>` | 제거 |

### 영향 받는 client 코드

- 모든 step 페이지의 `useLevel()` 호출 → `useSearchParams().get('level')` 또는 props 로 변경
- 모든 step 페이지의 "다음 단계" Link → query param 유지하도록 수정
- `/api/progress/[contentId]` 호출하는 곳 → body 에 `level` 추가

### 새로 추가되는 파일

- `src/components/learn/learn-top-bar.tsx`
- `src/components/learn/level-tabs.tsx`
- `src/components/learn/progress-bar.tsx`
- `src/lib/progress.ts`
- `prisma/migrations/<timestamp>_add_level_to_user_progress/migration.sql`

---

## 4. 엣지 케이스

| # | 상황 | 처리 |
|---|------|------|
| 1 | URL 에 `?level=invalid` 같은 잘못된 값 | `parseLevel` 이 unknown → `beginner` 로 fallback. 로그 X |
| 2 | 사용자가 진행 0인 레벨 탭 클릭 | `nextStepForLevel` = `reading`. `/learn/[id]/reading?level=X` 로 push |
| 3 | 사용자가 6/6 완료한 레벨 탭 클릭 | `nextStepForLevel` = `'complete'`. `/learn/[id]/complete?level=X` 로 push. ProgressBar 6칸 모두 녹색 |
| 4 | URL 직접 입력으로 미래 step 진입 (예: 0/6 인데 `/learn/1/quiz?level=beginner`) | step 페이지는 그냥 렌더링 (서버는 현재도 progress 체크 안 함). ProgressBar 가 "현재 단계" 를 quiz 로 표시하지만 1·2·3 은 회색. **정책: URL 직접 진입은 막지 않음** (다른 학습기기 호환, 디버그 편의). UI 클릭은 정책상 잠금 |
| 5 | Streak 중복 증가 방지 | `analytics_events` 에서 `type='complete' AND contentId=X AND userId=Y` 가 이미 있으면 streak skip. Streak 정책 섹션 참조 |
| 6 | 익명 쿠키 사용자가 브라우저 바꿈 | 새 anon User 생성 → 진행률 0/6 으로 리셋. 기존 동작 유지 |
| 7 | 관리자 로그인 사용자 + 익명 쿠키 동시 존재 | `requireUser()` 가 admin 우선 (기존 로직). 변경 없음 |
| 8 | `/today` 북마크 보호 | `(main)/today/page.tsx` 가 `redirect('/')`. SEO 는 `/` 로 통일 |
| 9 | 모바일 가로 폭 부족 (탭 + 6 라벨) | 라벨 글자 작게 (9~11px), 줄바꿈 허용. 정 안 되면 라벨만 숨기고 세그먼트 + "3/6 · 표현" 텍스트로 축약 |
| 10 | 사용자가 reading 진행 중 다른 글로 이동 후 돌아옴 | progress 는 DB 에 저장됨, URL 의 `?level=` 만 유지하면 됨. `Link` 가 query 보존 |
| 11 | `LevelContext` 제거 후 admin 페이지 영향 | admin 라우트는 `(admin)` 그룹이라 `(main)/layout.tsx` 영향 안 받음. 변경 없음 |

---

## 5. 테스트 전략

### 자동 테스트

**단위**:
- `nextStepForLevel`: 0/6, 일부 진행, 6/6 케이스
- `progressMapForLevel`: 모든 step 반환 + completed/skipped 플래그
- `progressSummaryByLevel`: 3 레벨 동시 반환
- `parseLevel`: 정상 / 잘못된 값 / undefined

**API**:
- `POST /api/progress` 에 `level` 누락 / 오타 → 400 반환
- 같은 `(user, content, level, step)` 두 번 호출 → upsert 멱등성
- 6/6 두 번째 호출 (다른 레벨) → streak 증가 ❌ 검증

**Prisma migration**:
- 빈 테이블에서 새 unique key 작동 확인
- prisma generate + 컴파일 통과 확인

### 수동 / E2E 스모크 (사용자 검증 필요)

- [ ] 메인 페이지 → "시작하기" → `/learn/[id]/reading` 진입 시 초급 콘텐츠 자동 로딩
- [ ] LevelGate 모달 안 뜸 / LevelToggle 드롭다운 사라짐
- [ ] 상단 탭 = 초급 active, 6칸 모두 회색 + 첫 칸 인디고
- [ ] reading 완료 → 다음 단계 클릭 → URL `?level=beginner` 유지된 채 listening 진입
- [ ] expressions 진행 중 ProgressBar 의 reading 칸 클릭 → reading 페이지로 (복습 동작)
- [ ] expressions 진행 중 ProgressBar 의 quiz/interview/speaking 칸 클릭 → 무반응
- [ ] 중급 탭 클릭 → URL `?level=intermediate` reading 페이지 (중급 진행 0)
- [ ] 중급에서 reading 완료 후 초급 탭 다시 클릭 → 초급 expressions (초급 진행 위치) 로 점프
- [ ] 한 레벨로 6 step 모두 완료 → /complete 페이지 + streak +1
- [ ] 같은 글을 다른 레벨로 또 6/6 → streak 추가 증가 ❌
- [ ] /today 직접 접속 → / 로 redirect
- [ ] /archive → 항목 클릭 → 그 글의 reading 페이지 (default 초급)
- [ ] 잘못된 `?level=foo` URL → 초급으로 fallback
- [ ] 모바일 (375px) 에서 상단 바 가독성 확인

### 회귀 위험 큰 영역
- 모든 step 페이지가 `useLevel()` → `useSearchParams()` 로 바뀜. 각 페이지 한 번씩 다 열어 확인 필수
- streak 로직 변경 — 기존 기대와 다르면 사용자 혼란

---

## 결정 요약

| 영역 | 결정 |
|------|------|
| Step 라우팅 구조 | 유지 (route 그대로, layout 만 확장) |
| 레벨 상태 보관 | URL `?level=` query (single source of truth) |
| 데이터 마이그레이션 | 컬럼 추가 1회 (테이블 비어있어 백필 불필요) |
| 진행 중 레벨 변경 | 자유 + 레벨별 분리 (그 레벨 진행 위치로 점프) |
| 진입 default 레벨 | 항상 초급 (저장 없음) |
| 페이지 진입 흐름 | `/` → `/learn/[id]/reading` (2단), `/today` redirect |
| 프로그레스 클릭 | 완료=복습 가능, 미래=잠금 |
| 시각 스타일 | Pill 탭 + 6칸 세그먼트 바 + 라벨 (mockup A) |
| Streak 정책 | 한 글당 1회만 +1 (레벨 무관) |

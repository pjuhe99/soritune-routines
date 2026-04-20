# routines.soritune.com — 회원 로그인 제거, Admin 로그인만 유지

**날짜**: 2026-04-20
**대상 프로젝트**: `/var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines/`
**스택**: Next.js (App Router) + NextAuth.js + Prisma

## 배경 & 목표

현재 routines.soritune.com 은 NextAuth.js 기반 로그인/회원가입을 통해 `/today`, `/learn`, `/archive`, `/profile` 을 보호하고 있다. 파일럿 단계로 진입하면서 회원 종속 기능(진도, 스트릭, 프로필)을 당분간 닫고 **누구나 학습 콘텐츠를 열람할 수 있도록** 전환한다. 단 운영을 위한 `/admin` 영역은 로그인을 계속 요구한다.

회원 기능은 파일럿 후 복구할 가능성이 있으므로 **코드/DB는 보존**하고 UI/라우팅 레벨에서만 제거한다.

## 결정 사항 요약

| 항목 | 결정 |
|------|------|
| 회원 종속 기능 처리 | **C** — 코드/DB 유지, UI에서만 제거 |
| Admin 로그인 경로 | **B** — `/admin/login` 으로 이전, `/login`/`/signup`/`/reset-password` 제거 |
| 회원 페이지 공개 범위 | **A** — `/today`, `/learn`, `/archive` 공개. `/profile` 접근 불가 (코드 보존) |
| 인증 API 호출 처리 | **A** — 프론트엔드에서 호출 코드 자체 제거 (API 라우트 파일은 보존) |

## 라우트 맵

| 경로 | 현재 | 변경 후 |
|------|------|--------|
| `/` | 랜딩 (signup CTA 포함) | 랜딩 (CTA를 "오늘 학습 시작하기" → `/today` 로 교체) |
| `/today`, `/learn/*`, `/archive` | 로그인 필요 | **공개** |
| `/profile` | 로그인 필요 | **접근 불가** (폴더명 `_profile` 로 변경하여 라우팅 제외, 파일 보존) |
| `/login`, `/signup`, `/reset-password` | 접근 가능 | **제거** (디렉토리 삭제) |
| `/admin/*` | 로그인 + admin role | 유지 |
| `/admin/login` | 없음 | **신설** (기존 `/login` 페이지를 admin 전용 폼으로 이전, 회원가입/비번재설정 링크 제거) |
| `/api/auth/*` (NextAuth) | 활성 | 유지 (admin 로그인에 필요) |
| `/api/progress`, `/api/streak`, `/api/events` | 활성 | 파일 보존, 호출자 없음 |

## 핵심 변경 파일

1. **`middleware.ts`** — matcher 를 `/admin/:path*` 하나로 축소. 미인증 시 `/admin/login` 리다이렉트. `/today`, `/learn`, `/archive`, `/profile` matcher 제거.
2. **`src/lib/auth.ts`** — NextAuth `pages.signIn` 을 `/admin/login` 으로 변경. 필요시 callback URL 도 `/admin` 으로 조정.
3. **라우트 이동/삭제**
   - `src/app/(auth)/login` → `src/app/(admin)/admin/login` 으로 이전. 회원가입/비번재설정 링크를 제거한 admin 전용 폼으로 수정.
   - `src/app/(auth)/signup`, `src/app/(auth)/reset-password` 디렉토리 **삭제**.
   - `src/app/(auth)` 그룹 자체 삭제 가능.
   - `src/app/(main)/profile` → `src/app/(main)/_profile` 로 폴더명 변경 (Next.js App Router 에서 `_` 접두사는 라우팅에서 제외). 파일은 보존.
4. **네비게이션/랜딩 UI**
   - 전역 내비: 로그인/회원가입 링크, 프로필 아이콘, 스트릭 배지 제거. "오늘 학습" / "아카이브" 등 공개 메뉴만 유지.
   - 랜딩 (`/`): 회원가입 CTA → "오늘 학습 시작하기" (`/today` 링크) 로 교체. 회원 가입 유도 섹션 제거.
5. **학습 플로우 API 호출 제거**
   - `/today`, `/learn/*`, `/archive` 컴포넌트에서 아래 호출 삭제:
     - `POST /api/progress` (6-step 진도 저장)
     - `POST/GET /api/streak` (스트릭 증가/조회)
     - `POST /api/events` (학습 이벤트 기록)
   - 관련 UI 요소(스트릭 배지, 진도 저장 버튼 등) 제거.
   - 진행 상태는 컴포넌트 로컬 state 로만 관리.
6. **세션 호출 정리** — 공개 페이지 컴포넌트에서 `useSession()` / `auth()` 호출 제거 (불필요한 세션 요청 방지).

## 검토 필요 항목 (구현 계획 단계에서 확인)

- **공유 기능 (`/api/share`)**: user 종속인지 확인 후, 비종속이면 유지, 종속이면 UI 숨김.
- **AI 인터뷰 (`/api/ai`)**: user 종속 여부 확인 후 결정. 우선 UI 진입점만 숨기고 API 라우트는 그대로 보존.

## 변경하지 않는 것

- Prisma 스키마 / DB 테이블 (User, Account, Session, Streak, Progress, Event 등 전부 유지)
- DB 마이그레이션 없음
- 환경변수 변경 없음
- NextAuth 세션 전략, 쿠키 설정 유지

## 검증 시나리오

**비로그인 상태**
- `/` 랜딩 진입, CTA 클릭 시 `/today` 로 이동
- `/today`, `/learn/*`, `/archive` 직접 접근 시 200 응답, 콘텐츠 표시
- `/login`, `/signup`, `/reset-password`, `/profile` → 404
- DevTools Network 탭에 `/api/progress`, `/api/streak`, `/api/events` 호출이 **발생하지 않음**
- `/admin` 접근 → `/admin/login` 으로 리다이렉트

**Admin 로그인 후**
- `/admin/login` 에서 로그인 → `/admin` 정상 진입
- 기존 admin 기능(대시보드, 콘텐츠 CRUD, Users, AI Settings) 정상 동작

**DB**
- User, Progress, Streak 테이블 스키마 / 데이터 변경 없음

## 배포

- routines 는 단일 디렉토리(dev/prod 분리 없음), `main` 브랜치 단일, git remote 미설정 상태.
- 작업은 로컬 디렉토리에서 진행하고 `main` 에 커밋.
- PM2 (`ecosystem.config.js` 존재) 로 Next.js 프로덕션 서버 재시작 필요.
- 커밋은 기능별로 분리하여 문제 발생 시 특정 커밋만 `git revert` 할 수 있도록 한다:
  1. 라우트 이동 및 삭제 (`(auth)` 제거, `/admin/login` 신설, `/profile` → `/_profile`)
  2. 미들웨어 및 NextAuth 설정 변경
  3. 네비게이션 및 랜딩 페이지 수정
  4. 학습 플로우에서 인증 필요 API 호출 제거

## 복구 전략

파일럿 이후 회원 기능 재도입 결정 시:
1. 라우트/UI 관련 커밋을 `git revert` 로 되살림 (삭제된 `(auth)` 디렉토리, `profile` 폴더명 복구).
2. `middleware.ts` matcher 확장, NextAuth `signIn` 경로 복구.
3. 네비/랜딩에 로그인 링크 다시 추가.
4. 각 학습 페이지에 진도/스트릭/이벤트 API 호출 다시 삽입.

## 작업 범위 추정

- 변경 파일: 약 15~20개
  - 미들웨어 1
  - auth.ts 1
  - 라우트 이동/삭제 5~7
  - 네비 및 랜딩 2~3
  - 학습 플로우 API 호출 제거 4~6
- DB 마이그레이션: 없음
- 환경변수 변경: 없음

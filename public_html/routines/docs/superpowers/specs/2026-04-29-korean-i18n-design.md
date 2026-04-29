# routines UI 한국어화 설계

작성일: 2026-04-29
작성자: 사용자 + Claude (브레인스토밍 세션)

## 배경

routines.soritune.com의 주 타깃은 4-50대 한국 사용자, 그중 영어 초보가 많다. 그러나 현재 사용자 메인 화면 곳곳에 영어 버튼/헤더/안내 문구가 하드코딩되어 있어, 영어 초보가 학습 콘텐츠 외 인터페이스에서도 영어 부담을 진다. 본 작업은 학습 콘텐츠(레슨 본문·표현·단어)는 영어 그대로 유지하면서, 그 외 UI 텍스트를 한국어로 전환한다.

## 결정 사항(요약)

| 항목 | 결정 |
|---|---|
| 한국어화 정책 | C — UI 한국어, **브랜드성 텍스트만 영어 유지** (`Routines` 로고/히어로/슬로건 등) |
| 구현 방식 | i18n 라이브러리 미도입. 단일 언어. |
| 코드 구조 | 하이브리드 — 반복 라벨은 `src/lib/labels.ts` 모듈, 페이지 고유 헤더는 인라인 |
| 톤 | 혼합 — 버튼/라벨=정중·간결, 헤더/안내/완료=친근·격려 |
| 작업 범위 | 사용자 메인 + 시스템 메시지 + 어드민 placeholder 정리, **단일 PR** |
| 메타 title | 혼합 — `Routines — 매일의 영어 루틴` |
| 어드민 이메일 placeholder | 영어 유지 (`email@example.com`) |
| 학습 콘텐츠(레슨 본문/표현/단어) | 영어 유지(학습 대상이라 한국어화 대상 아님) |

## 코드 구조

### `src/lib/labels.ts` (신규)

반복 라벨과 시스템 메시지는 한 파일에 모은다. 키 네이밍은 도메인.항목 형식, 키 자체는 영문(코드 가독성).

```ts
export const L = {
  common: {
    skip: '건너뛰기',
    loading: '불러오는 중...',
  },
  step: {
    captionReading: '1단계 · 읽기',
    captionListening: '2단계 · 듣기',
    captionExpressions: '3단계 · 표현',
    captionQuiz: '4단계 · 퀴즈',
    captionSpeaking: '5단계 · 말하기',
    captionInterview: '6단계 · AI 인터뷰',
  },
  next: {
    listening: '다음: 듣기',
    expressions: '다음: 표현',
    quiz: '다음: 퀴즈',
    interview: '다음: AI 인터뷰',
    speaking: '다음: 말하기',
    complete: '다음: 마무리',
  },
  complete: {
    title: '잘하셨어요!',
    subtitle: '오늘의 학습 루틴을 마쳤어요',
    shareButton: '결과 공유하기',
    backToToday: '오늘로',
    copied: '클립보드에 복사했어요',
    shareText:
      'Routines에서 오늘의 영어 학습을 마쳤어요! https://routines.soritune.com',
  },
  player: {
    playAll: '전체 재생',
    listenTooltip: '듣기',
    ttsUnsupported:
      '이 브라우저는 음성 재생을 지원하지 않아요. 아래 문장을 직접 소리 내어 읽어보세요.',
  },
  recording: {
    failed: '녹음에 실패했어요',
  },
} as const;
```

`speaking`/`interview` 페이지의 캡션과 다음 단계 라벨은 위 표 기준으로 통일한다(speaking → captionSpeaking, interview → captionInterview).

### 인라인 유지 — 페이지 고유 헤더 문구

해당 페이지에서만 노출되는 안내 헤더는 그 페이지 컴포넌트 안에 인라인으로 한국어 작성.

| 페이지 | 인라인 한국어 |
|---|---|
| `listening/page.tsx` | `문장을 들어볼까요?` |
| `expressions/page.tsx` | `핵심 표현을 익혀봐요` |
| `quiz/page.tsx` | `배운 내용을 점검해봐요` |

## 번역 사전 (작업 단위)

### 그룹 1 — 학습 단계 캡션

`labels.ts > L.step.*` 사용으로 통일.

| 위치 | 영어 | 한국어 |
|---|---|---|
| `src/app/(main)/learn/[contentId]/reading/page.tsx:51` | `Step 1 · Reading` | `1단계 · 읽기` |
| `src/app/(main)/learn/[contentId]/listening/page.tsx:45` | `Step 2 · Listening` | `2단계 · 듣기` |
| `src/app/(main)/learn/[contentId]/expressions/page.tsx:51` | `Step 3 · Expressions` | `3단계 · 표현` |
| `src/app/(main)/learn/[contentId]/quiz/page.tsx:49` | `Step 4 · Quiz` | `4단계 · 퀴즈` |

구현 단계에서 `speaking/page.tsx`, `interview/page.tsx`를 직접 열어 동일한 `Step N · X` 캡션이 존재하는지 확인. 존재한다면 `L.step.captionSpeaking` / `L.step.captionInterview`로 한국어화. 존재하지 않으면 변경 없음.

### 그룹 2 — 학습 페이지 헤더 (인라인)

| 위치 | 영어 | 한국어 |
|---|---|---|
| `listening/page.tsx:48` | `Listen to the sentences` | `문장을 들어볼까요?` |
| `expressions/page.tsx:54` | `Learn key expressions` | `핵심 표현을 익혀봐요` |
| `quiz/page.tsx:52` | `Test what you learned` | `배운 내용을 점검해봐요` |

### 그룹 3 — 다음 단계 / 건너뛰기 버튼

`labels.ts > L.next.*`, `L.common.skip` 사용.

| 위치 | 영어 | 한국어 |
|---|---|---|
| `reading/page.tsx:60` | `Next: Listening` | `다음: 듣기` |
| `listening/page.tsx:56` | `Skip` | `건너뛰기` |
| `listening/page.tsx:59` | `Next: Expressions` | `다음: 표현` |
| `expressions/page.tsx:60` | `Next: Quiz` | `다음: 퀴즈` |

### 그룹 4 — 완료 화면

`labels.ts > L.complete.*` 사용.

| 위치 | 영어 | 한국어 |
|---|---|---|
| `complete/page.tsx:58` (h1) | `Complete!` | `잘하셨어요!` |
| `complete/page.tsx:61` (p) | `You finished today's learning routine` | `오늘의 학습 루틴을 마쳤어요` |
| `complete/page.tsx:66` (button) | `Share Result` | `결과 공유하기` |
| `complete/page.tsx:69` (button) | `Back to Today` | `오늘로` |
| `complete/page.tsx:51` (alert) | `Copied to clipboard!` | `클립보드에 복사했어요` |
| `complete/page.tsx:34` (clipboard text) | `Completed today's English learning on Routines! https://routines.soritune.com` | `Routines에서 오늘의 영어 학습을 마쳤어요! https://routines.soritune.com` |

### 그룹 5 — 학습 컴포넌트

`labels.ts > L.player.*`, `L.recording.*` 사용.

| 위치 | 영어 | 한국어 |
|---|---|---|
| `src/components/learning/listening-player.tsx:68` | `This browser does not support text-to-speech. Please read the sentences below aloud.` | `이 브라우저는 음성 재생을 지원하지 않아요. 아래 문장을 직접 소리 내어 읽어보세요.` |
| `src/components/learning/listening-player.tsx:82` | `Play All` | `전체 재생` |
| `src/components/learning/expression-list.tsx:130` | `title="Listen"` | `title="듣기"` |
| `src/components/learning/recording-studio.tsx:42` | `Failed` | `녹음에 실패했어요` |

### 그룹 6 — 공통 로딩 메시지

`labels.ts > L.common.loading` 사용. 다음 위치의 `Loading...`을 모두 `불러오는 중...`으로:

- `reading/page.tsx:46`
- `listening/page.tsx:40`
- `expressions/page.tsx:46`
- `quiz/page.tsx:44`
- 그 외 작업 중 발견되는 동일 패턴

### 그룹 7 — 메타데이터(혼합 정책)

`src/app/layout.tsx`:

| 라인 | 영어 | 한국어/혼합 |
|---|---|---|
| 7 (metadata.title) | `Routines — Daily English Routine` | `Routines — 매일의 영어 루틴` |
| 10 (openGraph.title) | `Routines — Daily English Routine` | `Routines — 매일의 영어 루틴` |
| 13 (siteName) | `Routines by SoriTune` | 그대로 유지(브랜드명) |
| 19 (twitter.title) | `Routines — Daily English Routine` | `Routines — 매일의 영어 루틴` |

description은 이미 한국어이므로 변경 없음.

### 그룹 8 — 영어 유지 (변경 없음)

- `src/components/nav.tsx:19` — `Routines` 로고
- `src/app/(main)/page.tsx:32, 42` — 히어로 `<h1>Routines</h1>`
- `src/components/splash-intro.tsx` — SORITUNE→ROUTINES 애니메이션 글자
- `src/app/(main)/today/opengraph-image.tsx`, `learn/[contentId]/opengraph-image.tsx` — `keyPhrase="Routines"`, `name: "Pretendard"`
- `src/app/(admin)/admin/login/page.tsx:62` — `email@example.com` placeholder (이메일 형식 예시)

## 검증 절차

작업 완료 후 다음 3단계로 검증:

1. **수동 페이지 확인** — `/today`, `/learn/[id]/{reading,listening,expressions,quiz,speaking,interview,complete}`, `/archive`, `/_profile`, 어드민 로그인을 PM2 재시작 후 브라우저에서 직접 열어 영어 텍스트가 남아있지 않은지 확인.

2. **잔존 영어 grep** —
   ```bash
   grep -rEn ">[A-Z][a-zA-Z][a-zA-Z !?\.\,\:\-]{2,80}<" \
     src/app/\(main\) \
     src/components/{nav.tsx,splash-intro.tsx,learning,learn,ui}
   ```
   예상되는 잔존(허용): 브랜드 `Routines`, `Pretendard`. 그 외에 잡히는 항목이 있으면 수정.

3. **동적 메시지 시나리오 강제 노출**:
   - 네트워크 throttle → `불러오는 중...` 확인.
   - 브라우저 TTS 비활성 환경(예: 음성 엔진 없는 환경) → listening 페이지에서 `이 브라우저는 음성 재생을…` 메시지 확인.
   - 마이크 권한 거부 → speaking 단계에서 `녹음에 실패했어요` 확인.

## 롤아웃

routines는 main 단일 브랜치, dev/prod 분리 없음, Next.js + PM2 환경.

```
1. 작업 브랜치/직접 main에서 commit
2. push origin main
3. ⛔ 사용자 검토 게이트 — 운영 반영 명시 요청 시에만 진행
4. 운영 디렉토리에서 git pull origin main
5. pnpm install (의존성 미변경이면 skip)
6. pnpm build  ← 누락 시 옛 번들 서빙됨
7. pm2 restart routines
8. 검증 절차 1~3 수행
```

PR은 단일 PR(작업 범위가 적어 분할 이득 없음).

## 리스크 / 롤백

| 리스크 | 영향 | 대응 |
|---|---|---|
| 메타 title 변경이 OG/검색 캐시에 영향 | 카톡/페북 미리보기, 구글 검색 결과가 며칠간 옛 title로 노출될 수 있음 | 시간이 지나며 자연 갱신. 별도 대응 불필요. |
| 클립보드 공유 텍스트 변경 | 이미 공유한 카드에는 영향 없음(과거 시점). 신규 공유부터 한국어. | 별도 대응 불필요. |
| 잔존 영어 누락 | 본문에 영어가 남으면 4-50대 사용자가 막힘 | 검증 grep으로 catch. 추가 발견 시 hot-fix 한 줄 PR. |
| `labels.ts` 키 오타/누락 | TypeScript 컴파일 에러로 빌드 실패 | `as const` + 직접 import로 컴파일 시점에 잡힘. |
| 롤백 | 회귀 발견 시 단일 커밋 revert | `git revert <hash> && pnpm build && pm2 restart routines` |

## 비범위 (Out of Scope)

- 학습 콘텐츠 본문(레슨 paragraphs, expressions, quiz items, interview questions)의 영어. 이는 학습 대상이므로 영어 유지.
- i18n 라이브러리 도입 / 다국어 토글. 향후 필요해지면 `labels.ts`를 메시지 키로 마이그레이션.
- 어드민 화면 전반의 텍스트 톤 재작업. 이번 작업은 placeholder 미정리 항목만 손대고, 어드민의 기존 한국어 톤은 그대로.
- 새로운 안내 문구 추가. 본 작업은 기존 영어를 한국어로 치환하는 범위에 한정.

## 참고

- 정책 결정 근거(브레인스토밍 Q1~Q4): 브랜드성 영어는 학습 동기를 유지하지만, 상호작용 텍스트가 영어면 4-50대 초보가 매번 부담을 진다. 학습 콘텐츠로 영어를 충분히 만나므로, UI는 모두 한국어로 가는 균형이 적절하다.
- 톤 결정 근거: 정중·간결만 쓰면 차갑고, 친근·격려만 쓰면 가벼워진다. 버튼은 짧고 명확해야 모바일에서 잘 작동하고, 안내·완료 메시지는 격려 톤이 학습 지속에 도움된다.

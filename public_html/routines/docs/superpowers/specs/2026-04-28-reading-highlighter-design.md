# Reading Page Highlighter & Click-to-Reveal — Design Spec

**Date**: 2026-04-28
**Project**: routines.soritune.com
**Status**: Ready for plan

## Goal

학습 1단계(Reading) 페이지의 표현 노출 방식을 다음과 같이 바꾼다.

- 글마다 단일 `keyPhrase`만 brown 텍스트로 표시하던 걸, 레벨별 `expressions` 배열 전체를 **노란 형광펜**으로 표시한다 (교과서 필기 느낌).
- 의미·설명을 본문 아래 카드로 항상 노출하던 걸, **표현 클릭 시 위/아래 팝업**으로 노출한다 (의미 + 설명, 예문은 Step 3에서).
- 학습자가 본문을 먼저 읽고, 모르는 표현만 능동적으로 확인하는 흐름으로 전환.

## Non-Goals

- Step 3 (Expressions 페이지) 변경 없음 — 의미 + 설명 + 예문 + TTS 카드 그대로 유지.
- Step 2/4/5/6 (Listening, Quiz, Interview, Speaking) 영향 없음.
- 기존 글의 `expressions` 데이터 마이그레이션 없음.
- 모바일 bottom-sheet 변형 없음 (동일 popover 사용).
- 사용자가 형광펜을 직접 추가/제거하는 기능 없음.
- 매칭률 모니터링 대시보드 없음.

## 정책 결정 (사용자 승인)

| 결정 | 선택 |
|------|------|
| 하이라이트 데이터 소스 | **A**: 기존 `ContentVariant.expressions` 배열 재활용 |
| 형광펜 시각 스타일 | **A**: 노란 단색 형광펜 (`#FFF3A8`) |
| 클릭 팝업 콘텐츠 | **B**: 의미(한글) + 설명(한글 2~3줄). 예문은 제외 |
| 기존 keyPhrase 카드 처리 | **A**: 카드 제거. keyPhrase는 expressions 안에서 자연스럽게 흡수 |
| 본문에 안 나오는 expression | **A**: 그냥 무시 (Step 3에서 학습) + 신규 글은 프롬프트로 verbatim 등장 강제 |

---

## 1. 아키텍처 & 데이터 흐름

### API
변경 없음. `/api/content/[id]?level=...`는 이미 `expressions` 필드를 반환한다 (`src/app/api/content/[id]/route.ts:55`).

### 데이터 모델
변경 없음. `ContentVariant.expressions` JSON 필드를 그대로 사용한다.

```ts
type Expression = {
  expression: string;   // 영어 표현 (본문 매칭의 키)
  meaning: string;      // 한글 한 줄 의미
  explanation: string;  // 한글 2~3줄 사용 맥락 설명
  example: string;      // 영문 예문 (reading 단계에선 사용 안 함)
};
```

### 페이지 데이터 흐름
1. `reading/page.tsx`가 `/api/content/[id]?level=...` fetch
2. 응답에서 `paragraphs` (string[]), `expressions` (Expression[])을 `<ReadingView>`에 전달
3. `<ReadingView>`가 매칭 → 렌더 → 클릭 시 `<ExpressionPopup>`로 anchor + Expression 객체 전달

---

## 2. UI 동작 명세

### 형광펜 표시
- 모든 paragraph를 순회, 각 expression을 **case-insensitive + word boundary**로 매칭.
- 매칭된 부분은 `<HighlightedSpan>`으로, 그 외는 plain text로 렌더.
- 매칭 알고리즘:
  1. `expressions` 배열에서 길이 ≥ 3 인 항목만 사용 (2자 이하는 false positive 방지로 제외).
  2. **길이 내림차순 정렬** → longer-first greedy.
  3. 모든 표현을 escape 후 `\b(<longest>|...|<shortest>)\b` 단일 정규식으로 합성, `gi` 플래그.
  4. paragraph 단위로 split → 매치 토큰 / non-match 토큰 분리.
- 같은 expression이 본문에 N번 등장하면 N개 모두 형광펜 (모두 클릭 가능, 같은 popup 데이터).
- `expressions[]` 빈 배열 또는 매칭 0건: paragraphs만 plain하게 렌더 (오류 아님).

### 시각 스타일 (highlight span)
- 배경: `var(--color-highlight)` (= `#FFF3A8`, globals.css에 신규 토큰 추가)
- 호버: `bg-[#FFE873]` (살짝 진한 노랑)
- 그 외: `px-0.5 rounded-[2px] cursor-pointer`
- underline 없음 (노란 배경이 클릭 신호로 충분).

### 클릭 → 팝업
- 클릭 시 해당 expression의 popup 열림.
- 같은 expression 다시 클릭 → 닫힘.
- 다른 expression 클릭 → 이전 닫고 새로 엶 (한 번에 하나만).
- 외부 클릭 / ESC → 닫힘.
- 상태 키: `openKey: string | null` (expression 텍스트 자체를 키로 사용 → 같은 표현 다중 등장 시 popup 일관성 자동 보장).

### Popup 컴포넌트 (`expression-popup.tsx`, 신규)
- 배경: `var(--color-surface)`, 테두리: `var(--color-border-default)`, 그림자: `var(--shadow-overlay)`, `rounded-lg`, padding 16px.
- 너비: `min(360px, 90vw)`.
- 위치: 클릭된 highlight span 기준으로 **자동(아래에 공간 부족하면 위로)**.
  - 구현: `useLayoutEffect`에서 `anchor.getBoundingClientRect()` + `popup.getBoundingClientRect()`로 viewport bottom까지 거리 계산 → 부족하면 위로.
  - viewport 좌우 경계 체크해서 horizontal overflow 보정.
- 외부 popover 라이브러리 추가 없음 (자체 구현, 50줄 이하 예상).
- 콘텐츠:
  - 1행: 영어 표현 (강조, `font-semibold text-brand-primary`)
  - 2행: 의미 (한글, `text-body`)
  - 3행: 설명 (한글, `text-body text-text-secondary leading-[1.7]`)
- 닫기 버튼은 추가 안 함 (외부 클릭/ESC/재클릭으로 충분).

### 페이지 레이아웃 변경
**Before** (`reading/page.tsx:48-69`):
```
Step 1 · Reading
{title}
<ReadingView paragraphs keyPhrase>
{keyPhrase} {keyKo}  ← 항상 노출되는 카드
[Next: Listening]
```

**After**:
```
Step 1 · Reading
{title}
<ReadingView paragraphs expressions>
[Next: Listening]
```

하단 카드 제거. `keyPhrase`/`keyKo`는 page 레벨에서 더 이상 사용하지 않으나, 다른 페이지(글 목록, 공유 미리보기, upcoming)에서 계속 사용되므로 API/스키마는 그대로.

---

## 3. 변경 파일 목록

| 파일 | 변경 내용 |
|------|-----------|
| `src/components/learning/reading-view.tsx` | 핵심 재작성. props: `expressions: Expression[]` (`keyPhrase` 제거). 매칭 + 형광펜 + popup 상태. |
| `src/components/learning/expression-popup.tsx` | **신규**. anchor element + Expression 객체 받아 위/아래 자동 배치 popup 렌더. |
| `src/app/(main)/learn/[contentId]/reading/page.tsx` | `Content` interface에 `expressions` 추가, `<ReadingView>` props 교체, 하단 카드 제거. `keyPhrase`/`keyKo` interface 필드 제거 가능. |
| `src/app/globals.css` | `--color-highlight: #FFF3A8` 토큰 추가 (`:root` 블록 안). |
| `src/lib/generation-prompts.ts` | expressions 생성 규칙에 "expression 필드는 반드시 paragraphs 본문에 동일 형태(대소문자만 무시)로 등장해야 한다" 한 줄 추가. |
| `src/components/learning/reading-view.test.tsx` | **신규** (vitest). 매칭 0/1/N건, longer-first greedy, 빈 배열, 같은 표현 다중 등장 시 popup 일관성. |

---

## 4. 엣지케이스 처리

| 상황 | 처리 |
|------|------|
| `expressions[]` 빈 배열 | paragraphs plain 렌더, 오류 없음 |
| 본문에 매칭되는 expression 0건 | paragraphs plain 렌더 |
| 본문에 같은 expression이 여러 번 등장 | 모두 형광펜, 어디 클릭해도 같은 popup |
| 두 expression이 본문에서 겹침 (예: "good impression" ⊂ "make a good impression") | longer-first greedy로 긴 쪽 우선 매칭 |
| 대소문자 불일치 | case-insensitive로 매칭 |
| 구두점 인접 ("plan ahead.") | `\b` word boundary가 처리 |
| 짧은 표현 ("go", "be") | 길이 ≤ 2 인 항목은 매칭 대상에서 제외 |
| popup이 viewport 하단에 잘릴 때 | 위로 자동 배치 |
| popup이 viewport 좌우에 잘릴 때 | horizontal clamp |
| 매우 긴 paragraph 안에서 매칭 다수 | 정규식 한 번 수행, useMemo로 페이지 단위 캐싱 |

---

## 5. 신규 글 생성 프롬프트 보완

`src/lib/generation-prompts.ts`의 expressions 생성 규칙에 다음 한 줄 추가 (정확한 표현은 구현 단계에서 다듬되, 의도는 이 두 가지):

1. 각 expression의 `expression` 필드는 동일 글의 `paragraphs` 어딘가에 (대소문자만 무시한) 동일 문자열로 등장해야 한다.
2. paragraph 본문에 안 들어갈 표현이라면 expressions 항목으로 만들지 않는다.

기존 글은 이 규칙 미적용 상태로 남아있으므로, 운영 직후 한두 글 직접 확인해서 매칭률이 너무 낮으면 (예: 5개 중 1~2개만 매칭) 그때 별도로 수동 보정 또는 재생성 검토.

---

## 6. 테스트

`src/components/learning/reading-view.test.tsx` (신규, vitest + Testing Library)

| 케이스 | 검증 |
|--------|------|
| 매칭 0건 | 형광펜 span 없음, paragraphs는 plain 텍스트로 렌더 |
| 매칭 1건 | 정확히 1개 highlight span, 클릭 시 popup 열림 |
| 같은 expression이 본문에 2회 등장 | 2개 highlight span, 둘 중 어느 걸 클릭해도 popup 콘텐츠 동일 |
| Overlap 케이스 | "make a good impression" / "good impression" 중 longer-first 우선 |
| Case-insensitive | `Plan Ahead`도 `plan ahead`로 매칭 |
| 짧은 표현 제외 | 길이 ≤ 2 항목은 매칭 안 됨 |
| 빈 expressions 배열 | 오류 없이 paragraphs만 렌더 |

Popup 위치 자동 배치 로직은 단위 테스트보다 운영 후 수동 확인 (jsdom에서 viewport 계산이 부정확).

---

## 7. 위험 요소 & 운영 체크리스트

- 기존 글의 expressions와 paragraphs 매칭률이 낮을 가능성 → 배포 후 두세 글 직접 reading 페이지 열어 확인. 휑하면 수동 보정 또는 해당 글 재생성.
- 짧은 표현 제외 가드(길이 ≤ 2)로 false positive는 줄지만, 흔한 단어("get", "see")가 expressions에 들어있으면 본문 곳곳이 형광펜될 수 있음 → 매칭률 확인 시 함께 점검.
- `Content.keyPhrase` 필드는 다른 페이지(글 목록, share preview, upcoming)에서 계속 쓰이므로 schema/API에서 제거하지 않는다. reading/page.tsx의 `Content` interface에서만 빠짐.

# Routines 공유 기능 재설계 — Design Spec

- **작성일**: 2026-04-30
- **대상 사이트**: routines.soritune.com
- **범위**: 학습 완료 화면과 6단계(말하기) 녹음 카드의 공유 흐름을, 카카오톡 SDK 기반의 통합 ShareSheet으로 재구성한다.

## 1. 배경

routines는 로그인 없이 영어 학습 콘텐츠를 제공한다. 기존 공유 동선은 단 두 곳에 흩어져 있고, 외부 노출/유입 효과가 거의 없다.

- `/learn/[contentId]/complete` 페이지의 secondary 버튼 `결과 공유하기` — 클립보드에 고정 문구만 복사.
- `recording-card` 컴포넌트의 `📮 카페에 올리기` 버튼 — 네이버 카페 글쓰기 페이지를 새 탭으로 열고 첨부 안내.

본 작업의 목표는 **다른 사람에게 routines를 추천하고 싶게 만드는 흐름**을 만드는 것이다. 4-50대 사용자가 중심이며, 카카오톡으로의 공유가 가장 큰 채널이다.

## 2. 비목표 (Out of Scope)

다음 항목들은 별도 후속 작업으로 분리하며, 본 spec에서 다루지 않는다.

- localStorage 기반 streak 표시/마일스톤 트리거 — 로그인이 없어 신뢰성이 떨어지고, 4-50대 톤과 어긋남.
- 녹음 자체를 공유 가능한 token URL로 노출 — 인증/만료/접근 제어 설계가 필요한 별도 작업.
- 단계별(읽기/듣기/표현/퀴즈/인터뷰) micro-share 모먼트.
- 헤더 상시 공유 아이콘, /today 상단 공유 카드.
- "오늘의 함께 학습한 사람 N명" 같은 서버 집계 지표.
- 기존 `/api/share`의 응답 스키마 또는 Prisma `Share` / `AnalyticsEvent` 모델 변경.

## 3. 사용자 시나리오

### 3.1 학습 완료 후 추천

1. 사용자가 6단계까지 마치고 `/learn/{id}/complete`에 도달.
2. 화면 중심에 `친구에게 추천하기` primary 버튼이 노출됨.
3. 누르면 ShareSheet 모달(모바일은 bottom-sheet)이 열림.
4. `카카오톡으로 보내기`를 누르면 카카오 공유 팝업이 뜨고 친구를 선택해 메시지를 보낸다.
5. 친구는 메시지의 썸네일(=해당 콘텐츠의 OG 카드)과 카피를 보고, `지금 시작하기` 버튼을 눌러 `/learn/{id}`로 진입한다.

### 3.2 녹음 후 추천

1. 사용자가 6단계 말하기 단계에서 녹음을 마침.
2. 녹음 카드의 액션 줄에 기존 `📮 카페에 올리기`와 함께 신규 `💬 친구에게 추천하기` 버튼이 보임.
3. 카페 버튼은 본인 녹음을 카페에 자랑하고 싶을 때, 추천 버튼은 routines 자체를 친구에게 권할 때 — 의도가 분리됨.
4. 추천 버튼을 누르면 ShareSheet이 동일하게 뜨고, 시트 안에 카페 옵션도 함께 표시된다 (`context="recording"`).

## 4. 아키텍처

```
┌──────────────────────────────────────────────────────────────┐
│  ShareSheet 컴포넌트 (신규)                                   │
│  src/components/share/share-sheet.tsx                        │
│                                                              │
│  - props: { open, onOpenChange, contentId?, context }        │
│  - context: "complete" | "recording"                         │
│  - 옵션: 카카오톡 / 이미지 저장 / 링크 복사                  │
│         + 카페 (context="recording"일 때만)                  │
│         + Web Share (지원 시)                                │
│  - 각 액션 후 POST /api/share 로 채널 기록                   │
└──────────────────────────────────────────────────────────────┘
            ▲                               ▲
┌───────────┴──────────────┐    ┌───────────┴────────────────┐
│ complete 페이지           │    │ recording-card 컴포넌트     │
│ - "친구에게 추천하기"      │    │ - 기존 "카페에 올리기" 유지 │
│   primary 버튼            │    │ - 신규 "친구에게 추천하기"  │
│ - context="complete"      │    │   secondary 버튼            │
│                          │    │ - context="recording"      │
└──────────────────────────┘    └───────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  Kakao SDK 로더 (신규)                                       │
│  src/lib/kakao.ts                                            │
│  - 동적 로드 (시트 첫 열림 시) + 1회 init + 모듈 캐시         │
│  - sendKakaoShare(payload) 헬퍼                              │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  OG card (재사용, 변경 없음)                                  │
│  - /learn/[contentId]/opengraph-image  ← contentId 있을 때    │
│  - /opengraph-image                    ← 홈 fallback          │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  /api/share (기존, 채널 enum만 확장)                         │
│  - VALID_CHANNELS:                                           │
│    copy, kakao, image_download, web_share, cafe, other       │
└──────────────────────────────────────────────────────────────┘
```

## 5. 컴포넌트 상세

### 5.1 ShareSheet

**파일**: `src/components/share/share-sheet.tsx` (신규)

**Props**:

```ts
interface ShareSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contentId?: number;
  context: "complete" | "recording";
}
```

**파생 값**:

```ts
const baseUrl = "https://routines.soritune.com";
const shareUrl = contentId
  ? `${baseUrl}/learn/${contentId}`
  : baseUrl;
const ogImageUrl = contentId
  ? `${baseUrl}/learn/${contentId}/opengraph-image`
  : `${baseUrl}/opengraph-image`;
```

**옵션 동작**

| 옵션 | 핸들러 동작 | `/api/share` channel |
|------|--------------|----------------------|
| 카카오톡으로 보내기 | `sendKakaoShare({ title, description, imageUrl: ogImageUrl, linkUrl: shareUrl, buttonTitle: "지금 시작하기" })` | `kakao` |
| 이미지 저장 | `fetch(ogImageUrl)` → `Blob` → `<a download>` 트리거. 파일명: contentId가 있으면 `routines-{contentId}.png`, 없으면 `routines.png` | `image_download` |
| 링크 복사 | `navigator.clipboard.writeText(shareUrl)` + 토스트 "링크를 복사했어요" | `copy` |
| 카페에 올리기 (context="recording" 한정) | `window.open(getCafeUrl(), "_blank", "noopener,noreferrer")` + "다운받은 녹음 파일을 카페 게시글에 첨부해주세요" 토스트 | `cafe` |
| 더 많은 공유 옵션 (Web Share 지원 시) | `navigator.share({ title, text: description, url: shareUrl })` | `web_share` |

**시트 자체의 카피**

- 헤더 타이틀: `친구에게 추천하기`
- 카톡 버튼 라벨: `카카오톡으로 보내기`
- 이미지 저장 버튼 라벨: `이미지 저장`
- 링크 복사 버튼 라벨: `링크 복사`
- 카페 버튼 라벨: `카페에 올리기`
- Web Share 버튼 라벨: `더 많은 공유 옵션`

이상은 모두 `src/lib/labels.ts`의 신규 `share` 네임스페이스로 관리한다.

**카카오 피드 템플릿 (확정)**

```ts
{
  objectType: "feed",
  content: {
    title: "하루 10분, 영어가 조금씩 편해집니다",
    description: "짧은 글 하나로 듣고, 읽고, 따라 말해보세요. 꾸준히 하면 차이가 느껴집니다.",
    imageUrl: ogImageUrl,
    link: { mobileWebUrl: shareUrl, webUrl: shareUrl },
  },
  buttons: [
    { title: "지금 시작하기", link: { mobileWebUrl: shareUrl, webUrl: shareUrl } },
  ],
}
```

위 메시지 카피는 streak 도달 여부와 무관하게 항상 동일하다 (streak 자체가 본 작업 범위에 없음).

**스타일/접근성**

- shadcn/ui `Dialog` 기반. 모바일 미디어 쿼리에서 bottom-sheet 모양으로 정렬.
- 카톡 버튼은 카카오 가이드라인의 노란색(`#FEE500`) + 검정 텍스트.
- ESC로 닫기, Tab 순환, focus trap — Dialog 컴포넌트 기본 동작 활용.

### 5.2 Kakao SDK 로더

**파일**: `src/lib/kakao.ts` (신규)

**환경변수**:

```
NEXT_PUBLIC_KAKAO_JS_KEY=91b1de30748dce084970498c8b3eff9f
```

JS 앱 키는 카카오에서 클라이언트 노출을 전제로 발급되는 키다 (REST/Admin/네이티브 키와 다름). 환경변수로 두는 이유는 환경별 분리(dev/prod)와 관리 편의이며, 보안상 의무는 아니다.

**로딩 전략**

- 페이지 전역에 `<Script>` 태그를 넣지 않는다.
- `loadKakao()` 호출 시점(=ShareSheet의 카톡 버튼이 처음 눌렸을 때)에 동적으로 `https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js`를 `<script>`로 주입한다.
- 모듈 레벨 `initPromise`를 캐시해 SDK 로드/`Kakao.init`은 세션당 1회만 일어나도록 한다.
- SDK CDN URL은 카카오 공식 가이드의 SRI 해시와 함께 사용 (`integrity` + `crossOrigin="anonymous"`).

**API 표면**

```ts
export interface KakaoShareInput {
  title: string;
  description: string;
  imageUrl: string;
  linkUrl: string;
  buttonTitle: string;
}

export function loadKakao(): Promise<KakaoStatic>;
export async function sendKakaoShare(input: KakaoShareInput): Promise<void>;
```

`sendKakaoShare`는 내부에서 `loadKakao()`를 await한 뒤 `Kakao.Share.sendDefault({ objectType: "feed", ... })`를 호출한다. 실패 시 throw.

### 5.3 complete 페이지 변경

**파일**: `src/app/(main)/learn/[contentId]/complete/page.tsx`

- 기존 `handleShare` (clipboard 직접 복사 + alert) 함수와 그 호출부 제거.
- `useState<boolean>` 으로 시트 열림 상태 관리.
- 신규 안내 문구 한 줄 추가: `이 글이 좋았다면 친구에게도 추천해보세요.` (subtitle 아래, 버튼 위).
- primary 버튼 `친구에게 추천하기`를 누르면 `setShareOpen(true)`.
- `ShareSheet`을 `contentId={contentId}`, `context="complete"`로 렌더.
- ghost 버튼 `오늘로 가기`는 그대로 유지 (라벨 미세 수정: `오늘로` → `오늘로 가기`).
- 기존 `complete` 분석 이벤트 emit (`emittedRef` + `/api/events { type: "complete" }`)은 변경 없음.

### 5.4 recording-card 변경

**파일**: `src/components/learning/recording-card.tsx`

- `RecordingCardProps`에 `contentId: number` 추가. 호출부인 `src/app/(main)/learn/[contentId]/speaking/page.tsx`에서 `params.contentId`를 그대로 넘긴다.
- 녹음 완료 후 액션 줄에 신규 secondary 버튼 `💬 친구에게 추천하기` 추가. 기존 카페 버튼 오른쪽에 위치.
- 신규 버튼은 `setShareOpen(true)`만 호출. ShareSheet은 `contentId={contentId}`, `context="recording"`으로 렌더.
- 카페 버튼의 기존 동작 (카페 글쓰기 페이지 새 탭 + 6초 힌트 토스트)은 그대로 유지.
- ShareSheet이 열리는 순간 `setShowShareHint(false)` + `clearTimeout(hintTimerRef.current)`로 카페 힌트와 충돌 방지. 모달이 닫혀도 힌트는 다시 띄우지 않는다.

### 5.5 labels.ts 변경

```ts
// 신규 / 수정
complete: {
  title: '잘하셨어요!',
  subtitle: '오늘의 학습 루틴을 마쳤어요',
  shareHint: '이 글이 좋았다면 친구에게도 추천해보세요.',
  shareButton: '친구에게 추천하기',
  backToToday: '오늘로 가기',
},
share: {
  sheetTitle: '친구에게 추천하기',
  kakao: '카카오톡으로 보내기',
  imageDownload: '이미지 저장',
  copyLink: '링크 복사',
  cafe: '카페에 올리기',
  webShare: '더 많은 공유 옵션',
  copyDone: '링크를 복사했어요',
  linkCopyFailed: '링크 복사에 실패했어요. 잠시 후 다시 시도해주세요.',
  kakaoLoadFailed: '카카오톡 공유를 불러올 수 없어요. 잠시 후 다시 시도해주세요.',
  imageDownloadFailed: '이미지를 만들 수 없어요. 잠시 후 다시 시도해주세요.',
  cafeHint: '다운받은 녹음 파일을 카페 게시글에 첨부해주세요!',
  // 기본 카톡 메시지 카피 — Kakao 호출 시 사용
  pitchTitle: '하루 10분, 영어가 조금씩 편해집니다',
  pitchDescription: '짧은 글 하나로 듣고, 읽고, 따라 말해보세요. 꾸준히 하면 차이가 느껴집니다.',
  pitchButton: '지금 시작하기',
},
recording: {
  failed: '녹음에 실패했어요',
  postToCafe: '카페에 올리기',
  recommendToFriend: '친구에게 추천하기',
},
```

기존 `complete.copied` / `complete.shareText`는 제거 (clipboard 직접 복사 흐름이 사라지므로).

## 6. API 변경

**파일**: `src/app/api/share/route.ts`

```diff
- const VALID_CHANNELS = ["copy", "kakao", "twitter", "other"] as const;
+ const VALID_CHANNELS = ["copy", "kakao", "image_download", "web_share", "cafe", "other"] as const;
```

- `twitter` 제거: 호출 이력 없고, 운영 페이지의 채널 선택지에서 혼란을 줄 수 있음. `Share.channel`은 String 컬럼이라 마이그레이션 영향 없음.
- 응답 형식, 인증 동작(`auth()`로 옵셔널 userId), `AnalyticsEvent` 생성 로직은 변경 없음.

**`metadata` 본문 표준**:

```jsonc
{
  "contentId": 123,
  "channel": "kakao",
  "metadata": {
    "context": "complete",   // "complete" | "recording"
    "level": "beginner"      // 호출 측에서 알면 같이 보냄
  }
}
```

`context`는 어드민 대시보드에서 "어디서 공유 시트를 열었는지"를 분석하기 위한 표식.

## 7. 분석 / 어드민 대시보드

- `src/app/api/admin/dashboard/route.ts` 와 `src/app/(admin)/admin/page.tsx`는 본 작업에서 변경하지 않는다. 신규 채널은 자연스럽게 기존 share 이벤트 집계에 포함된다.
- 채널별 분리 표시(예: kakao vs copy 비율)는 후속 작업.
- 시트 열림(impression) 이벤트는 1차에서 추가하지 않는다 (YAGNI). 필요하면 별도 `type=share_sheet_open`으로 후속 도입.

## 8. 에러 처리

| 시나리오 | 동작 |
|----------|------|
| Kakao SDK 로드 실패 (네트워크) | ShareSheet에 토스트 `kakaoLoadFailed`. 다른 옵션은 정상 작동. 시트 자체는 유지. |
| `Kakao.Share.sendDefault` 호출 자체 실패 | 동일하게 `kakaoLoadFailed` 토스트. |
| `navigator.clipboard` 미지원 | textarea 셀렉트 + `document.execCommand("copy")` fallback. 그래도 실패하면 토스트 `linkCopyFailed`. |
| `navigator.share` 미지원 | "더 많은 공유 옵션" 버튼 자체를 시트에 렌더하지 않음. |
| OG 이미지 fetch 실패 (이미지 저장) | 토스트 `imageDownloadFailed`. |
| `/api/share` 실패 | silent. 사용자 행동은 이미 완료. 추적만 누락 (기존 패턴). |

## 9. 테스트 계획

### 9.1 Vitest

- `lib/kakao.ts`
  - `loadKakao`이 SDK script를 1회만 주입하는지 (모듈 캐시 검증, jsdom 환경에서 `document.head` 자식 수 검사).
  - `sendKakaoShare`가 올바른 페이로드로 `Kakao.Share.sendDefault`를 호출하는지 (`window.Kakao` mock).
- `ShareSheet` 컴포넌트
  - `context="complete"`일 때 카페 버튼 미렌더, `context="recording"`일 때 렌더.
  - `navigator.share` 미지원 환경에서 Web Share 버튼 미렌더.
  - 각 액션 클릭 시 해당 핸들러 + `/api/share` POST 호출 (fetch mock으로 호출 인자 검증).
  - 클립보드 복사 후 토스트 노출.
- `complete` 페이지
  - 신규 primary 버튼 클릭 시 ShareSheet이 열린다.
  - 기존 `complete` 이벤트 emit이 여전히 1회만 일어난다.
- `recording-card`
  - `contentId` prop이 ShareSheet으로 전달된다.
  - 신규 추천 버튼 클릭 시 ShareSheet이 열리고, 동시에 카페 힌트 타이머가 클리어된다.

### 9.2 수동 (브라우저)

- 데스크톱 Chrome: 카톡 공유 → 카카오 로그인 팝업 → 친구 선택 → 메시지 도착 확인.
- 모바일 Safari/Chrome: 같은 흐름.
- 카톡 메시지의 OG 썸네일이 `/learn/{id}/opengraph-image`로 정상 렌더되는지 (콘텐츠별로 변하는지).
- 친구가 받은 링크 클릭 시 `/learn/{id}` 진입 → 정상 학습 진입 가능.
- 이미지 저장 → 다운로드된 PNG가 OG 카드와 동일한지.
- recording-card에서 카페 버튼과 추천 버튼 두 개가 시각적으로 헷갈리지 않는지 (라벨/아이콘으로 구분 명확).

### 9.3 합격 기준

- `pnpm vitest run` 전체 통과 (기존 65개 + 신규 8~12개).
- `pnpm build` 성공 (Next.js 16/Turbopack).
- 위 수동 시나리오 1회 이상 통과.

## 10. 배포 체크리스트

```
[ ] Kakao Developers 콘솔
    [ ] 플랫폼 > Web 도메인에 https://routines.soritune.com 등록
    [ ] (옵션) http://localhost:3000 추가 (로컬 개발용)
    [ ] 카카오톡 공유 활성화 토글 ON
[ ] 환경변수 NEXT_PUBLIC_KAKAO_JS_KEY 주입
    [ ] PM2 ecosystem 또는 .env.production 에 등록
    [ ] 빌드 시점에 Next.js가 정상 픽업하는지 확인
[ ] pnpm build 성공
[ ] vitest 전체 통과
[ ] PM2 restart (auto-memory 규칙: build 먼저, restart 그 다음)
[ ] 운영 도메인에서 카톡 공유 1회 실제 발송 + 받는 쪽 확인
[ ] 어드민 dashboard에서 share 이벤트가 channel="kakao"로 잡히는지 확인
```

## 11. 후속 작업 후보 (별도 spec 필요)

- 채널별 분리 표시(어드민 대시보드).
- 시트 열림 impression 이벤트.
- 단계별 micro-share 모먼트 (읽기/듣기/표현/퀴즈/인터뷰).
- 헤더 상시 공유 아이콘 또는 /today 상단 카드.
- 녹음 자체의 공유 가능한 token URL.
- 로그인 도입 후 streak/마일스톤 모달 재검토.

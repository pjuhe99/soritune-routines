# routines 공유 기능 재설계 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** routines.soritune.com의 학습 완료 화면과 6단계 녹음 카드에, 카카오톡 SDK 기반의 통합 ShareSheet를 도입해 4-50대 사용자의 자연스러운 친구 추천 흐름을 만든다.

**Architecture:** 신규 의존성 없음. 자체 modal + inline 메시지로 ShareSheet 구현. Kakao JS SDK는 시트 첫 열림 시 동적 로드(모듈 캐시 1회). `Share.channel` Prisma enum을 마이그레이션해 신규 채널(`image_download`, `web_share`, `cafe`) 추가, `twitter` 제거. complete 페이지의 공유는 primary CTA로 격상. recording-card는 기존 카페 버튼을 유지하고 옆에 새 "친구에게 추천하기" 버튼을 추가(의도 분리).

**Tech Stack:** Next.js (App Router) 16 + React + TypeScript + Tailwind + Prisma(MySQL) + pnpm + PM2 + vitest(`src/**/*.test.ts`만 포함, env=node). React 컴포넌트는 vitest의 jsdom 미설치로 자동 테스트 불가 — 순수 로직은 `*.test.ts`로 검증, UI 동작은 수동 스모크.

**Spec:** `docs/superpowers/specs/2026-04-30-routines-share-redesign-design.md`

---

## 작업 디렉토리

모든 명령은 다음 디렉토리에서 실행한다:

```
/var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines
```

이하 경로는 이 루트 기준 상대 경로.

## 파일 구조

| 변경 | 경로 | 책임 |
|---|---|---|
| Modify | `prisma/schema.prisma` | `enum ShareChannel`에 `image_download`/`web_share`/`cafe` 추가, `twitter` 제거 |
| Create | `prisma/migrations/<timestamp>_share_channels_v2/migration.sql` | DB enum 변경 SQL (Prisma가 생성) |
| Create | `src/lib/share-channels.ts` | `VALID_CHANNELS` 상수 + `isValidChannel()` 가드 (route와 테스트가 공유) |
| Create | `src/lib/share-channels.test.ts` | 신규/제거 채널 검증 |
| Modify | `src/app/api/share/route.ts` | `share-channels.ts`에서 import |
| Create | `src/lib/kakao.ts` | Kakao SDK 동적 로더 + `sendKakaoShare` + `buildKakaoFeedPayload` (순수 헬퍼) |
| Create | `src/lib/kakao.test.ts` | `buildKakaoFeedPayload` 단위 테스트 |
| Modify | `src/lib/labels.ts` | `share` 네임스페이스 추가, `complete` 키 갱신, `recording`에 `postToCafe`/`recommendToFriend` 추가, 구 키(`copied`/`shareText`) 제거 |
| Create | `src/components/share/share-helpers.ts` | URL 빌더, 시트 옵션 가시성 결정, `/api/share` POST 페이로드 빌더 — 순수 함수 |
| Create | `src/components/share/share-helpers.test.ts` | 헬퍼 단위 테스트 |
| Create | `src/components/share/share-sheet.tsx` | ShareSheet 컴포넌트(자체 modal + 옵션 5종 + inline 메시지) |
| Modify | `src/app/(main)/learn/[contentId]/complete/page.tsx` | `handleShare` 제거, ShareSheet 렌더, 라벨 갱신 |
| Modify | `src/components/learning/recording-studio.tsx` | `contentId` prop을 RecordingCard로 통과 |
| Modify | `src/components/learning/recording-card.tsx` | `contentId` prop 추가, 신규 "친구에게 추천하기" 버튼, ShareSheet 렌더, 카페 힌트 충돌 방지 |
| Modify | `.env.local` (개발용, gitignore 대상) | `NEXT_PUBLIC_KAKAO_JS_KEY` 추가 |

---

## Task 1: Prisma `ShareChannel` enum 마이그레이션

**Files:**
- Modify: `prisma/schema.prisma:288-296`
- Create: `prisma/migrations/<timestamp>_share_channels_v2/migration.sql` (Prisma가 자동 생성)

- [ ] **Step 1: DEV DB에서 기존 `twitter` 행 카운트**

```bash
pnpm prisma db execute --stdin <<'SQL'
SELECT COUNT(*) AS twitter_count FROM shares WHERE channel = 'twitter';
SQL
```

기대 출력: `twitter_count`가 0이면 그대로 진행. 1 이상이면 다음 SQL로 `other`로 마이그레이트:

```bash
pnpm prisma db execute --stdin <<'SQL'
UPDATE shares SET channel = 'other' WHERE channel = 'twitter';
SQL
```

- [ ] **Step 2: `prisma/schema.prisma`의 `ShareChannel` enum 수정**

기존(`prisma/schema.prisma` 292행 부근):
```prisma
enum ShareChannel {
  copy
  kakao
  twitter
  other
}
```

다음으로 변경:
```prisma
enum ShareChannel {
  copy
  kakao
  image_download
  web_share
  cafe
  other
}
```

- [ ] **Step 3: Prisma 마이그레이션 생성·적용 (DEV)**

```bash
pnpm prisma migrate dev --name share_channels_v2
```

기대: `prisma/migrations/<timestamp>_share_channels_v2/migration.sql` 생성, DEV DB에 적용 완료, Prisma Client 재생성.

- [ ] **Step 4: 적용 결과 확인**

```bash
pnpm prisma db execute --stdin <<'SQL'
SHOW COLUMNS FROM shares LIKE 'channel';
SQL
```

기대 출력: 컬럼 타입에 `enum('copy','kakao','image_download','web_share','cafe','other')` 가 보임.

- [ ] **Step 5: 커밋**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(db): add image_download/web_share/cafe to ShareChannel, drop twitter"
```

---

## Task 2: `src/lib/share-channels.ts` + 테스트

라우트와 ShareSheet, 테스트가 동일한 채널 목록을 참조하도록 모듈 분리.

**Files:**
- Create: `src/lib/share-channels.ts`
- Create: `src/lib/share-channels.test.ts`
- Modify: `src/app/api/share/route.ts:6,20-22`

- [ ] **Step 1: 실패하는 테스트 먼저 작성** — `src/lib/share-channels.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { VALID_CHANNELS, isValidChannel } from "./share-channels";

describe("VALID_CHANNELS", () => {
  it("includes the new v2 channels", () => {
    expect(VALID_CHANNELS).toEqual(
      expect.arrayContaining(["copy", "kakao", "image_download", "web_share", "cafe", "other"])
    );
  });

  it("does not include the removed 'twitter' channel", () => {
    expect(VALID_CHANNELS).not.toContain("twitter");
  });
});

describe("isValidChannel", () => {
  it("accepts each v2 channel", () => {
    for (const ch of ["copy", "kakao", "image_download", "web_share", "cafe", "other"]) {
      expect(isValidChannel(ch)).toBe(true);
    }
  });

  it("rejects unknown values including legacy 'twitter'", () => {
    expect(isValidChannel("twitter")).toBe(false);
    expect(isValidChannel("")).toBe(false);
    expect(isValidChannel("foo")).toBe(false);
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
pnpm vitest run src/lib/share-channels.test.ts
```

기대: 모듈을 찾을 수 없다는 에러로 FAIL.

- [ ] **Step 3: 모듈 구현** — `src/lib/share-channels.ts`

```ts
export const VALID_CHANNELS = [
  "copy",
  "kakao",
  "image_download",
  "web_share",
  "cafe",
  "other",
] as const;

export type ShareChannel = (typeof VALID_CHANNELS)[number];

export function isValidChannel(value: unknown): value is ShareChannel {
  return typeof value === "string" && (VALID_CHANNELS as readonly string[]).includes(value);
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
pnpm vitest run src/lib/share-channels.test.ts
```

기대: 두 describe 블록 4 케이스 모두 PASS.

- [ ] **Step 5: `src/app/api/share/route.ts`에서 import로 전환**

기존(6행):
```ts
const VALID_CHANNELS = ["copy", "kakao", "twitter", "other"] as const;
```
삭제하고 상단 import에 추가:
```ts
import { VALID_CHANNELS, isValidChannel } from "@/lib/share-channels";
```

기존(20행 부근) 검증부:
```ts
if (!channel || !VALID_CHANNELS.includes(channel)) {
```
다음으로 교체:
```ts
if (!isValidChannel(channel)) {
```

(에러 메시지의 `${VALID_CHANNELS.join(", ")}`는 그대로 둔다 — 모듈에서 import한 같은 배열이라 자동으로 신규 채널 반영.)

- [ ] **Step 6: 전체 vitest로 회귀 확인 + 빌드**

```bash
pnpm vitest run
pnpm build
```

기대: 모든 기존 테스트 + 신규 4 케이스 PASS. 빌드 성공.

- [ ] **Step 7: 커밋**

```bash
git add src/lib/share-channels.ts src/lib/share-channels.test.ts src/app/api/share/route.ts
git commit -m "feat(share): extract VALID_CHANNELS module + drop twitter from API"
```

---

## Task 3: `src/lib/kakao.ts` (Kakao SDK 로더 + 페이로드 빌더)

순수 함수 `buildKakaoFeedPayload`만 vitest로 검증한다. SDK 로딩(`document` 조작)과 `Kakao.Share.sendDefault` 호출은 수동 스모크로 검증.

**Files:**
- Create: `src/lib/kakao.ts`
- Create: `src/lib/kakao.test.ts`

- [ ] **Step 1: 실패하는 테스트 먼저 작성** — `src/lib/kakao.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { buildKakaoFeedPayload } from "./kakao";

describe("buildKakaoFeedPayload", () => {
  const input = {
    title: "하루 10분, 영어가 조금씩 편해집니다",
    description: "짧은 글 하나로 듣고, 읽고, 따라 말해보세요. 꾸준히 하면 차이가 느껴집니다.",
    imageUrl: "https://routines.soritune.com/learn/42/opengraph-image",
    linkUrl: "https://routines.soritune.com/learn/42",
    buttonTitle: "지금 시작하기",
  };

  it("builds a Kakao feed object with the provided copy", () => {
    const payload = buildKakaoFeedPayload(input);
    expect(payload.objectType).toBe("feed");
    expect(payload.content.title).toBe(input.title);
    expect(payload.content.description).toBe(input.description);
    expect(payload.content.imageUrl).toBe(input.imageUrl);
  });

  it("uses the same linkUrl for both mobileWebUrl and webUrl in content + button", () => {
    const payload = buildKakaoFeedPayload(input);
    expect(payload.content.link.mobileWebUrl).toBe(input.linkUrl);
    expect(payload.content.link.webUrl).toBe(input.linkUrl);
    expect(payload.buttons[0].link.mobileWebUrl).toBe(input.linkUrl);
    expect(payload.buttons[0].link.webUrl).toBe(input.linkUrl);
  });

  it("uses the provided button title", () => {
    const payload = buildKakaoFeedPayload(input);
    expect(payload.buttons[0].title).toBe(input.buttonTitle);
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
pnpm vitest run src/lib/kakao.test.ts
```

기대: 모듈 미존재로 FAIL.

- [ ] **Step 3: 모듈 구현** — `src/lib/kakao.ts`

```ts
// Kakao JS SDK loader and helpers.
//
// JS app key is meant for client-side use (REST/Admin/Native keys are
// different and never exposed). The key is read from
// process.env.NEXT_PUBLIC_KAKAO_JS_KEY at runtime.

export interface KakaoShareInput {
  title: string;
  description: string;
  imageUrl: string;
  linkUrl: string;
  buttonTitle: string;
}

export interface KakaoFeedPayload {
  objectType: "feed";
  content: {
    title: string;
    description: string;
    imageUrl: string;
    link: { mobileWebUrl: string; webUrl: string };
  };
  buttons: { title: string; link: { mobileWebUrl: string; webUrl: string } }[];
}

export function buildKakaoFeedPayload(input: KakaoShareInput): KakaoFeedPayload {
  const link = { mobileWebUrl: input.linkUrl, webUrl: input.linkUrl };
  return {
    objectType: "feed",
    content: {
      title: input.title,
      description: input.description,
      imageUrl: input.imageUrl,
      link,
    },
    buttons: [{ title: input.buttonTitle, link }],
  };
}

// Minimal shape of window.Kakao that we actually use.
interface KakaoStatic {
  isInitialized(): boolean;
  init(key: string): void;
  Share: {
    sendDefault(payload: KakaoFeedPayload): void;
  };
}

declare global {
  interface Window {
    Kakao?: KakaoStatic;
  }
}

const KAKAO_SDK_URL = "https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js";
// SRI hash from Kakao official getting-started guide for the matching version:
// https://developers.kakao.com/docs/latest/ko/javascript/getting-started
// The implementer should copy the integrity attribute from that page at
// implementation time. Leaving as null disables SRI; ship with the value set.
const KAKAO_SDK_INTEGRITY: string | null = null; // TODO(impl): paste SRI hash from Kakao guide

let initPromise: Promise<KakaoStatic> | null = null;

export function loadKakao(): Promise<KakaoStatic> {
  if (initPromise) return initPromise;

  initPromise = new Promise<KakaoStatic>((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("Kakao SDK requires a browser environment"));
      return;
    }
    const existing = window.Kakao;
    if (existing && existing.isInitialized()) {
      resolve(existing);
      return;
    }

    const onReady = () => {
      const Kakao = window.Kakao;
      if (!Kakao) {
        reject(new Error("Kakao SDK loaded but window.Kakao is undefined"));
        return;
      }
      const key = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
      if (!key) {
        reject(new Error("NEXT_PUBLIC_KAKAO_JS_KEY is not set"));
        return;
      }
      if (!Kakao.isInitialized()) Kakao.init(key);
      resolve(Kakao);
    };

    if (existing) {
      onReady();
      return;
    }

    const script = document.createElement("script");
    script.src = KAKAO_SDK_URL;
    script.async = true;
    script.crossOrigin = "anonymous";
    if (KAKAO_SDK_INTEGRITY) script.integrity = KAKAO_SDK_INTEGRITY;
    script.onload = onReady;
    script.onerror = () => reject(new Error("Failed to load Kakao SDK"));
    document.head.appendChild(script);
  });

  return initPromise;
}

export async function sendKakaoShare(input: KakaoShareInput): Promise<void> {
  const Kakao = await loadKakao();
  Kakao.Share.sendDefault(buildKakaoFeedPayload(input));
}
```

> **TODO(impl)**: 구현자는 카카오 공식 가이드(https://developers.kakao.com/docs/latest/ko/javascript/getting-started)에서 v2.7.4 의 `integrity` 해시 값을 복사해 `KAKAO_SDK_INTEGRITY` 상수에 채워 넣을 것. 구현 PR 머지 전 반드시 채워져야 함.

- [ ] **Step 4: 테스트 통과 확인**

```bash
pnpm vitest run src/lib/kakao.test.ts
```

기대: 3 케이스 PASS.

- [ ] **Step 5: 전체 vitest + 빌드 회귀**

```bash
pnpm vitest run
pnpm build
```

기대: 전체 PASS, 빌드 성공.

- [ ] **Step 6: 커밋**

```bash
git add src/lib/kakao.ts src/lib/kakao.test.ts
git commit -m "feat(share): add Kakao SDK loader and feed payload builder"
```

---

## Task 4: `src/lib/labels.ts` 갱신

기존 `complete.copied` / `complete.shareText`는 제거(이제 ShareSheet가 처리), 신규 `share` 네임스페이스 + `recording` 라벨 추가.

**Files:**
- Modify: `src/lib/labels.ts`

- [ ] **Step 1: 현재 파일 확인**

```bash
cat src/lib/labels.ts
```

`complete` / `recording` 키 위치를 파악.

- [ ] **Step 2: `complete` 블록 갱신**

기존(23-31행 부근):
```ts
complete: {
  title: '잘하셨어요!',
  subtitle: '오늘의 학습 루틴을 마쳤어요',
  shareButton: '결과 공유하기',
  backToToday: '오늘로',
  copied: '클립보드에 복사했어요',
  shareText:
    'Routines에서 오늘의 영어 학습을 마쳤어요! https://routines.soritune.com',
},
```

다음으로 교체:
```ts
complete: {
  title: '잘하셨어요!',
  subtitle: '오늘의 학습 루틴을 마쳤어요',
  shareHint: '이 글이 좋았다면 친구에게도 추천해보세요.',
  shareButton: '친구에게 추천하기',
  backToToday: '오늘로 가기',
},
```

- [ ] **Step 3: `recording` 블록 갱신**

기존:
```ts
recording: {
  failed: '녹음에 실패했어요',
},
```

다음으로 교체:
```ts
recording: {
  failed: '녹음에 실패했어요',
  postToCafe: '카페에 올리기',
  recommendToFriend: '친구에게 추천하기',
  cafeHint: '다운받은 녹음 파일을 카페 게시글에 첨부해주세요!',
  deleteConfirm: '이 녹음을 삭제할까요?',
  deleteFailed: '삭제에 실패했어요. 다시 시도해주세요.',
  deleteError: '삭제 중 오류가 발생했어요.',
  uploadFailedDefault: '업로드에 실패했어요.',
},
```

(`recording-card.tsx`에 인라인으로 박혀있던 한국어 문자열도 이 기회에 라벨로 흡수해 일관성 확보 — Task 10에서 사용.)

- [ ] **Step 4: `share` 네임스페이스 추가**

`recording` 블록 직후, `} as const;` 직전에 추가:
```ts
  share: {
    sheetTitle: '친구에게 추천하기',
    kakao: '카카오톡으로 보내기',
    imageDownload: '이미지 저장',
    copyLink: '링크 복사',
    cafe: '카페에 올리기',
    webShare: '더 많은 공유 옵션',
    close: '닫기',
    copyDone: '링크를 복사했어요',
    linkCopyFailed: '링크 복사에 실패했어요. 잠시 후 다시 시도해주세요.',
    kakaoLoadFailed: '카카오톡 공유를 불러올 수 없어요. 잠시 후 다시 시도해주세요.',
    imageDownloadFailed: '이미지를 만들 수 없어요. 잠시 후 다시 시도해주세요.',
    cafeHint: '다운받은 녹음 파일을 카페 게시글에 첨부해주세요!',
    pitchTitle: '하루 10분, 영어가 조금씩 편해집니다',
    pitchDescription: '짧은 글 하나로 듣고, 읽고, 따라 말해보세요. 꾸준히 하면 차이가 느껴집니다.',
    pitchButton: '지금 시작하기',
  },
```

- [ ] **Step 5: 빌드로 미사용 키 / 누락 키 회귀 확인**

```bash
pnpm build
```

기대: 빌드 성공. 만약 `L.complete.copied` / `L.complete.shareText` 참조가 남아있으면 TypeScript가 잡는다 — 이는 Task 7(complete 페이지 통합)에서 해당 참조를 제거하면서 함께 해결된다. 본 Task에서 빌드가 일시적으로 실패해도 진행한다(아직 미수정 페이지의 영향). 단 새 키 자체에 오타가 있으면 본 Task 안에서 고친다.

- [ ] **Step 6: 커밋**

```bash
git add src/lib/labels.ts
git commit -m "feat(i18n): expand share + recording labels for share-sheet"
```

---

## Task 5: `src/components/share/share-helpers.ts` (순수 함수 + 테스트)

ShareSheet의 핵심 로직(URL 빌드, 옵션 가시성, `/api/share` 페이로드)을 별도 모듈로 분리하여 vitest로 검증.

**Files:**
- Create: `src/components/share/share-helpers.ts`
- Create: `src/components/share/share-helpers.test.ts`

- [ ] **Step 1: 실패하는 테스트 먼저 작성** — `src/components/share/share-helpers.test.ts`

```ts
import { describe, it, expect } from "vitest";
import {
  buildShareUrl,
  buildOgImageUrl,
  buildSharePostBody,
  shouldShowCafeOption,
  shouldShowWebShareOption,
} from "./share-helpers";

const BASE = "https://routines.soritune.com";

describe("buildShareUrl", () => {
  it("returns the deep link to the learn page for the given contentId", () => {
    expect(buildShareUrl(42)).toBe(`${BASE}/learn/42`);
  });
});

describe("buildOgImageUrl", () => {
  it("returns the per-content opengraph-image URL", () => {
    expect(buildOgImageUrl(42)).toBe(`${BASE}/learn/42/opengraph-image`);
  });
});

describe("buildSharePostBody", () => {
  it("packages contentId, channel, and context metadata", () => {
    const body = buildSharePostBody({ contentId: 42, channel: "kakao", context: "complete" });
    expect(body).toEqual({
      contentId: 42,
      channel: "kakao",
      metadata: { context: "complete" },
    });
  });

  it("includes optional level when provided", () => {
    const body = buildSharePostBody({
      contentId: 42,
      channel: "image_download",
      context: "complete",
      level: "beginner",
    });
    expect(body.metadata).toEqual({ context: "complete", level: "beginner" });
  });
});

describe("shouldShowCafeOption", () => {
  it("shows cafe option only for recording context", () => {
    expect(shouldShowCafeOption("recording")).toBe(true);
    expect(shouldShowCafeOption("complete")).toBe(false);
  });
});

describe("shouldShowWebShareOption", () => {
  it("returns false when navigator.share is not a function", () => {
    expect(shouldShowWebShareOption(undefined)).toBe(false);
    expect(shouldShowWebShareOption({} as Navigator)).toBe(false);
  });

  it("returns true when navigator.share is a function", () => {
    const nav = { share: () => Promise.resolve() } as unknown as Navigator;
    expect(shouldShowWebShareOption(nav)).toBe(true);
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
pnpm vitest run src/components/share/share-helpers.test.ts
```

기대: 모듈 미존재로 FAIL.

- [ ] **Step 3: 헬퍼 모듈 구현** — `src/components/share/share-helpers.ts`

```ts
import type { ShareChannel } from "@/lib/share-channels";

const BASE_URL = "https://routines.soritune.com";

export type ShareContext = "complete" | "recording";

export function buildShareUrl(contentId: number): string {
  return `${BASE_URL}/learn/${contentId}`;
}

export function buildOgImageUrl(contentId: number): string {
  return `${BASE_URL}/learn/${contentId}/opengraph-image`;
}

export interface SharePostBodyInput {
  contentId: number;
  channel: ShareChannel;
  context: ShareContext;
  level?: string;
}

export interface SharePostBody {
  contentId: number;
  channel: ShareChannel;
  metadata: { context: ShareContext; level?: string };
}

export function buildSharePostBody(input: SharePostBodyInput): SharePostBody {
  const metadata: { context: ShareContext; level?: string } = { context: input.context };
  if (input.level) metadata.level = input.level;
  return {
    contentId: input.contentId,
    channel: input.channel,
    metadata,
  };
}

export function shouldShowCafeOption(context: ShareContext): boolean {
  return context === "recording";
}

export function shouldShowWebShareOption(nav: Navigator | undefined): boolean {
  return typeof nav?.share === "function";
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
pnpm vitest run src/components/share/share-helpers.test.ts
```

기대: 7 케이스 PASS.

- [ ] **Step 5: 전체 vitest 회귀**

```bash
pnpm vitest run
```

기대: 전체 PASS.

- [ ] **Step 6: 커밋**

```bash
git add src/components/share/share-helpers.ts src/components/share/share-helpers.test.ts
git commit -m "feat(share): pure helpers for url/payload/option visibility"
```

---

## Task 6: `src/components/share/share-sheet.tsx` (UI 컴포넌트)

자체 modal + 5개 옵션 + inline 메시지. 새 의존성 없음.

**Files:**
- Create: `src/components/share/share-sheet.tsx`

- [ ] **Step 1: 컴포넌트 작성**

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { L } from "@/lib/labels";
import { getCafeUrl } from "@/lib/cafe-link";
import { loadKakao, sendKakaoShare } from "@/lib/kakao";
import type { ShareChannel } from "@/lib/share-channels";
import {
  buildOgImageUrl,
  buildSharePostBody,
  buildShareUrl,
  shouldShowCafeOption,
  shouldShowWebShareOption,
  type ShareContext,
} from "./share-helpers";

interface ShareSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contentId: number;
  context: ShareContext;
  level?: string;
}

type Notice =
  | { kind: "success"; text: string }
  | { kind: "error"; text: string }
  | null;

export function ShareSheet({ open, onOpenChange, contentId, context, level }: ShareSheetProps) {
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const sheetTitleId = "share-sheet-title";

  const shareUrl = buildShareUrl(contentId);
  const ogImageUrl = buildOgImageUrl(contentId);
  const showCafe = shouldShowCafeOption(context);
  const showWebShare =
    typeof navigator !== "undefined" && shouldShowWebShareOption(navigator);

  function flashNotice(next: Notice, autoDismissMs = 3000) {
    setNotice(next);
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    if (next) {
      noticeTimerRef.current = setTimeout(() => setNotice(null), autoDismissMs);
    }
  }

  // Preload Kakao SDK on first open so the kakao button has zero delay later.
  useEffect(() => {
    if (!open) return;
    loadKakao().catch(() => {
      // Surface only when the user actually clicks the kakao button.
    });
  }, [open]);

  // Body scroll lock + ESC + initial focus.
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeBtnRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onOpenChange(false);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onOpenChange]);

  // Clean up notice timer on unmount.
  useEffect(() => {
    return () => {
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    };
  }, []);

  async function recordShare(channel: ShareChannel) {
    try {
      await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          buildSharePostBody({ contentId, channel, context, level })
        ),
      });
    } catch {
      // Tracking is best-effort.
    }
  }

  async function handleKakao() {
    setBusy("kakao");
    try {
      await sendKakaoShare({
        title: L.share.pitchTitle,
        description: L.share.pitchDescription,
        imageUrl: ogImageUrl,
        linkUrl: shareUrl,
        buttonTitle: L.share.pitchButton,
      });
      void recordShare("kakao");
    } catch {
      flashNotice({ kind: "error", text: L.share.kakaoLoadFailed });
    } finally {
      setBusy(null);
    }
  }

  async function handleImageDownload() {
    setBusy("image");
    try {
      const res = await fetch(ogImageUrl);
      if (!res.ok) throw new Error(`og-image ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `routines-${contentId}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      void recordShare("image_download");
    } catch {
      flashNotice({ kind: "error", text: L.share.imageDownloadFailed });
    } finally {
      setBusy(null);
    }
  }

  async function handleCopyLink() {
    setBusy("copy");
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const ta = document.createElement("textarea");
        ta.value = shareUrl;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand("copy");
        ta.remove();
        if (!ok) throw new Error("execCommand copy failed");
      }
      flashNotice({ kind: "success", text: L.share.copyDone });
      void recordShare("copy");
    } catch {
      flashNotice({ kind: "error", text: L.share.linkCopyFailed });
    } finally {
      setBusy(null);
    }
  }

  function handleCafe() {
    window.open(getCafeUrl(), "_blank", "noopener,noreferrer");
    flashNotice({ kind: "success", text: L.share.cafeHint }, 6000);
    void recordShare("cafe");
  }

  async function handleWebShare() {
    setBusy("web");
    try {
      await navigator.share({
        title: L.share.pitchTitle,
        text: L.share.pitchDescription,
        url: shareUrl,
      });
      void recordShare("web_share");
    } catch {
      // User cancellation throws on most browsers — silently ignore.
    } finally {
      setBusy(null);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onOpenChange(false);
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={sheetTitleId}
        className="bg-surface text-text-primary w-full max-w-md rounded-t-2xl sm:rounded-2xl p-5 shadow-xl"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 id={sheetTitleId} className="text-headline font-semibold">
            {L.share.sheetTitle}
          </h2>
          <button
            ref={closeBtnRef}
            type="button"
            aria-label={L.share.close}
            className="text-text-secondary text-lg px-2"
            onClick={() => onOpenChange(false)}
          >
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            disabled={busy !== null}
            onClick={handleKakao}
            className="w-full rounded-lg py-3 text-base font-semibold disabled:opacity-50"
            style={{ backgroundColor: "#FEE500", color: "#000" }}
          >
            💬 {L.share.kakao}
          </button>

          <Button variant="secondary" disabled={busy !== null} onClick={handleImageDownload}>
            🖼 {L.share.imageDownload}
          </Button>

          <Button variant="secondary" disabled={busy !== null} onClick={handleCopyLink}>
            🔗 {L.share.copyLink}
          </Button>

          {showCafe && (
            <Button variant="secondary" disabled={busy !== null} onClick={handleCafe}>
              📮 {L.share.cafe}
            </Button>
          )}

          {showWebShare && (
            <Button variant="ghost" disabled={busy !== null} onClick={handleWebShare}>
              {L.share.webShare}
            </Button>
          )}
        </div>

        <div
          aria-live="polite"
          className="min-h-[1.5rem] mt-4 text-caption"
          style={{ color: notice?.kind === "error" ? "var(--danger)" : "var(--brand-primary)" }}
        >
          {notice?.text ?? ""}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 빌드로 타입/import 회귀 확인**

```bash
pnpm build
```

기대: 빌드 성공. 사용처(complete page, recording-card)는 아직 수정 전이라 직접 import는 없으므로 영향 없음. 만약 Task 4에서 제거한 `L.complete.copied`/`L.complete.shareText`를 complete 페이지가 아직 참조해 빌드가 깨지면, Task 7(complete 페이지 통합)에서 해당 참조를 제거하면 해소된다 — 다음 Task로 즉시 진행.

- [ ] **Step 3: 커밋**

```bash
git add src/components/share/share-sheet.tsx
git commit -m "feat(share): add ShareSheet component with kakao/image/copy/cafe/web-share options"
```

---

## Task 7: complete 페이지 통합

**Files:**
- Modify: `src/app/(main)/learn/[contentId]/complete/page.tsx`

- [ ] **Step 1: 파일 전체 교체**

기존(전체) 파일을 다음으로 교체:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ShareSheet } from "@/components/share/share-sheet";
import { parseLevel } from "@/lib/level";
import { L } from "@/lib/labels";

export default function CompletePage() {
  const params = useParams();
  const contentId = Number(params.contentId);
  const searchParams = useSearchParams();
  const level = parseLevel(searchParams.get("level")) ?? "beginner";
  const emittedRef = useRef(false);
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => {
    if (emittedRef.current) return;
    if (!Number.isFinite(contentId)) return;
    emittedRef.current = true;
    fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "complete",
        contentId,
        metadata: { level },
      }),
    }).catch(() => undefined);
  }, [contentId, level]);

  return (
    <div className="max-w-[600px] mx-auto px-6 py-20 text-center">
      <div className="text-[80px] mb-6">&#127881;</div>
      <h1 className="text-display font-bold mb-4">{L.complete.title}</h1>
      <p className="text-body text-text-secondary mb-4">{L.complete.subtitle}</p>
      <p className="text-body text-text-secondary mb-8">{L.complete.shareHint}</p>

      <div className="flex flex-col items-center gap-3">
        <Button onClick={() => setShareOpen(true)}>{L.complete.shareButton}</Button>
        <Link href="/today">
          <Button variant="ghost">{L.complete.backToToday}</Button>
        </Link>
      </div>

      {Number.isFinite(contentId) && (
        <ShareSheet
          open={shareOpen}
          onOpenChange={setShareOpen}
          contentId={contentId}
          context="complete"
          level={level}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: 빌드 및 vitest 회귀**

```bash
pnpm build
pnpm vitest run
```

기대: 빌드 성공(이제 `complete.copied`/`complete.shareText` 참조가 사라짐), 모든 테스트 PASS.

- [ ] **Step 3: 커밋**

```bash
git add src/app/\(main\)/learn/\[contentId\]/complete/page.tsx
git commit -m "feat(complete): make share the primary CTA via ShareSheet"
```

---

## Task 8: RecordingStudio가 contentId를 RecordingCard로 통과

**Files:**
- Modify: `src/components/learning/recording-studio.tsx`

- [ ] **Step 1: 현재 파일에서 RecordingCard 호출부 확인**

```bash
grep -n "RecordingCard" src/components/learning/recording-studio.tsx
```

대상: 82행 부근의 `<RecordingCard ... />`.

- [ ] **Step 2: prop 추가**

`<RecordingCard ... />` 의 호출부에 `contentId={contentId}` 한 줄 추가.

예시(주변 컨텍스트는 그대로):
```tsx
<RecordingCard
  contentId={contentId}
  interviewAnswerId={...}
  questionIndex={...}
  question={...}
  recommendedSentence={...}
  initialRecording={...}
/>
```

(다른 prop은 기존 그대로 유지. 본 Task에서는 `contentId` 한 줄만 추가.)

- [ ] **Step 3: 빌드로 타입 회귀 확인**

```bash
pnpm build
```

기대: RecordingCard에 아직 `contentId` prop이 없으므로 TypeScript 오류 — 이는 Task 9에서 즉시 해결.

(빌드 실패가 일시적으로 허용되는 유일한 Task. 다음 Task로 바로 진행.)

- [ ] **Step 4: 커밋(빌드 통과 후 Task 9와 묶어 커밋)**

이 Task는 Task 9 완료 후에 한꺼번에 커밋한다.

---

## Task 9: RecordingCard에 contentId prop + 친구 추천 버튼 + ShareSheet

**Files:**
- Modify: `src/components/learning/recording-card.tsx`

- [ ] **Step 1: import 추가**

파일 상단의 import 블록에 추가:
```tsx
import { ShareSheet } from "@/components/share/share-sheet";
import { L } from "@/lib/labels";
```

- [ ] **Step 2: Props 인터페이스에 `contentId` 추가**

기존(17-23행 부근):
```ts
interface RecordingCardProps {
  interviewAnswerId: number;
  questionIndex: number;
  question: string;
  recommendedSentence: string;
  initialRecording: RecordingSummary | null;
}
```

다음으로 변경:
```ts
interface RecordingCardProps {
  contentId: string;
  interviewAnswerId: number;
  questionIndex: number;
  question: string;
  recommendedSentence: string;
  initialRecording: RecordingSummary | null;
}
```

- [ ] **Step 3: 함수 시그니처와 destructure에 추가**

```tsx
export function RecordingCard({
  contentId,
  interviewAnswerId,
  questionIndex,
  question,
  recommendedSentence,
  initialRecording,
}: RecordingCardProps) {
```

- [ ] **Step 4: ShareSheet 상태 + numeric contentId 파생**

`useMediaRecorder` 호출 직후에 추가:
```tsx
const [shareOpen, setShareOpen] = useState(false);
const numericContentId = Number(contentId);
const canRecommend = Number.isFinite(numericContentId);
```

- [ ] **Step 5: ShareSheet 열림과 카페 힌트 충돌 방지**

`handleOpenCafe` 함수 정의 다음에 새 함수 추가:
```tsx
function handleOpenShare() {
  setShowShareHint(false);
  if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
  setShareOpen(true);
}
```

- [ ] **Step 6: 액션 줄에 신규 버튼 추가**

기존(205-207행 부근):
```tsx
<Button onClick={handleOpenCafe}>
  📮 카페에 올리기
</Button>
```

다음으로 교체(라벨도 i18n 적용):
```tsx
<Button onClick={handleOpenCafe}>
  📮 {L.recording.postToCafe}
</Button>
{canRecommend && (
  <Button variant="secondary" onClick={handleOpenShare}>
    💬 {L.recording.recommendToFriend}
  </Button>
)}
```

- [ ] **Step 7: ShareSheet 렌더 (컴포넌트 마지막 `</div>` 직전)**

```tsx
{canRecommend && (
  <ShareSheet
    open={shareOpen}
    onOpenChange={setShareOpen}
    contentId={numericContentId}
    context="recording"
  />
)}
```

- [ ] **Step 8: 인라인 한국어 문자열을 라벨로 흡수 (옵션 — 일관성)**

기존 인라인 메시지를 라벨로 교체:

| 위치 | 기존 | 변경 |
|---|---|---|
| `handleDelete` 의 `confirm` 메시지 | `"이 녹음을 삭제할까요?"` | `L.recording.deleteConfirm` |
| 삭제 실패 메시지 | `"삭제에 실패했어요. 다시 시도해주세요."` | `L.recording.deleteFailed` |
| 삭제 오류 catch 메시지 | `"삭제 중 오류가 발생했어요."` | `L.recording.deleteError` |
| 업로드 실패 기본 | `"업로드에 실패했어요."` | `L.recording.uploadFailedDefault` |
| 카페 힌트 안내(210-214행) | `"다운받은 녹음 파일을 카페 게시글에 첨부해주세요!"` | `L.recording.cafeHint` |

- [ ] **Step 9: 빌드 + 전체 vitest 회귀**

```bash
pnpm build
pnpm vitest run
```

기대: 빌드 성공, 모든 테스트 PASS.

- [ ] **Step 10: Task 8 + Task 9를 함께 커밋**

```bash
git add src/components/learning/recording-studio.tsx src/components/learning/recording-card.tsx
git commit -m "feat(recording): add 'recommend to friend' button alongside cafe button"
```

---

## Task 10: 환경변수 + 수동 스모크

**Files:**
- Modify: `.env.local` (gitignore 대상)

- [ ] **Step 1: `.env.local`에 키 추가**

```bash
grep -q '^NEXT_PUBLIC_KAKAO_JS_KEY=' .env.local 2>/dev/null \
  || printf '\nNEXT_PUBLIC_KAKAO_JS_KEY=91b1de30748dce084970498c8b3eff9f\n' >> .env.local
```

(이 파일은 git에서 무시됨. PROD 배포 시 별도로 PM2 ecosystem이나 .env.production에 등록 — §배포 체크리스트 참조.)

- [ ] **Step 2: dev 서버 기동**

```bash
pnpm dev
```

기대: `http://localhost:3000`에서 정상 기동.

- [ ] **Step 3: 카카오 콘솔에서 로컬 도메인 등록 확인**

브라우저에서 https://developers.kakao.com → 내 애플리케이션 (JS 키 `91b1de...`) → 플랫폼 → Web 도메인에 `http://localhost:3000`이 등록되어 있는지 확인. 없으면 추가.

- [ ] **Step 4: complete 페이지 스모크**

1. 브라우저에서 임의의 활성 콘텐츠 학습 흐름을 완주하거나, `http://localhost:3000/learn/<contentId>/complete?level=beginner` 직행.
2. "친구에게 추천하기" primary 버튼 노출 확인.
3. 클릭 → ShareSheet 모달 노출.
4. "카카오톡으로 보내기" → 카카오 로그인 팝업 → 친구 선택 → 메시지 도착, 썸네일이 `/learn/<contentId>/opengraph-image`로 렌더되는지 확인.
5. 메시지 내 "지금 시작하기" 버튼 클릭 시 `https://routines.soritune.com/learn/<contentId>` 로 이동.
6. "이미지 저장" → `routines-<contentId>.png` 파일이 다운로드되고 OG 카드와 동일한지 확인.
7. "링크 복사" → 클립보드에 deep link 복사, 시트 하단 inline 메시지 노출.
8. "더 많은 공유 옵션" (모바일에서) → 네이티브 시트 노출.
9. ESC 키, 백드롭 클릭으로 모달 닫힘 확인.

- [ ] **Step 5: recording-card 스모크**

1. `/learn/<contentId>/speaking?level=beginner` 진입, 녹음 1개 생성.
2. 액션 줄에 "📮 카페에 올리기" + "💬 친구에게 추천하기" 두 버튼 노출 확인.
3. 카페 버튼: 새 탭 + "다운받은 녹음 파일을 카페 게시글에 첨부해주세요!" 힌트 노출 (기존 동작).
4. 친구에게 추천하기 버튼: ShareSheet 모달 노출, 시트 안에 "📮 카페에 올리기" 옵션도 보임 (`context="recording"`).
5. 친구에게 추천하기 버튼 클릭 시점에 카페 힌트가 즉시 사라지는지 확인 (충돌 방지).

- [ ] **Step 6: `/api/share` 이벤트 기록 확인**

DEV DB에서 직접 조회:
```bash
pnpm prisma db execute --stdin <<'SQL'
SELECT id, content_id, channel, created_at
FROM shares
ORDER BY id DESC
LIMIT 10;
SQL
```

기대: 위 스모크에서 누른 채널들이 행으로 들어와 있음 (kakao, image_download, copy, cafe, web_share 중 누른 것들).

- [ ] **Step 7: 어드민 대시보드 영향 확인**

`http://localhost:3000/admin` 페이지에서 share 이벤트 카운트가 정상 집계되는지 확인 (채널 라벨에 enum 값이 직접 표시되면 한국어 매핑 필요 — 후속 작업).

- [ ] **Step 8: SRI 해시 채워넣기**

Task 3의 `KAKAO_SDK_INTEGRITY` 값을 카카오 공식 가이드(https://developers.kakao.com/docs/latest/ko/javascript/getting-started)에서 v2.7.4의 `integrity` 속성 값으로 교체.

```bash
# src/lib/kakao.ts 안의
const KAKAO_SDK_INTEGRITY: string | null = null; // TODO(impl): paste SRI hash from Kakao guide
# 위 줄을 다음으로 교체 (가이드에서 복사한 실제 해시 사용)
const KAKAO_SDK_INTEGRITY: string | null = "sha384-...실제값...";
```

브라우저 콘솔에서 SDK 로드 시 SRI 검증 오류가 없는지 확인.

- [ ] **Step 9: 커밋(SRI 해시)**

```bash
git add src/lib/kakao.ts
git commit -m "feat(share): set Kakao SDK SRI integrity hash"
```

---

## Task 11: dev push + PROD 배포 준비

**Files:**
- (no source changes)

- [ ] **Step 1: 최종 회귀**

```bash
pnpm vitest run
pnpm build
```

기대: 모두 통과.

- [ ] **Step 2: dev 브랜치 push**

```bash
git push origin main
```

> auto-memory 규칙: routines는 단일 main 브랜치, dev/prod 분리 없음. **PROD 반영(서버 pull + 마이그레이션 + restart)은 사용자 명시적 요청 시에만 진행.**

- [ ] **Step 3: 사용자에게 dev 검증 요청**

dev 환경에서 위 §10 스모크를 사용자가 직접 한 번 더 확인할 수 있게 안내. 사용자가 "운영 반영해줘"를 명시적으로 요청한 경우에만 다음 단계 진행.

- [ ] **Step 4: PROD 배포 (사용자 요청 후에만)**

PROD 서버에서:

```bash
cd /var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines
git pull origin main

# 사전 점검: PROD에 'twitter' 행이 있는지 확인
pnpm prisma db execute --stdin <<'SQL'
SELECT COUNT(*) AS twitter_count FROM shares WHERE channel = 'twitter';
SQL

# 1건 이상이면 보존을 위해 'other'로 마이그레이트
# (pnpm prisma db execute UPDATE 실행)

# 마이그레이션 deploy
pnpm prisma migrate deploy

# 환경변수 NEXT_PUBLIC_KAKAO_JS_KEY 가 PROD .env.production 또는 PM2 ecosystem에 있는지 확인
# 없으면 추가하고 PM2 reload

pnpm build
pm2 restart routines
```

- [ ] **Step 5: PROD 스모크**

`https://routines.soritune.com/learn/<contentId>/complete` 에서 카카오 공유 1회 실제 발송 + 받는 쪽 확인.

- [ ] **Step 6: 배포 후 PROD share 이벤트 확인**

PROD DB에서:
```sql
SELECT channel, COUNT(*)
FROM shares
WHERE created_at > NOW() - INTERVAL 1 HOUR
GROUP BY channel;
```

기대: `kakao` 행이 적어도 1건.

---

## 합격 기준 (모든 Task 완료 후)

- [ ] `pnpm vitest run` 전체 통과 (기존 + 신규 14 케이스).
- [ ] `pnpm build` 성공.
- [ ] DEV 브라우저 수동 스모크 §10 통과.
- [ ] PROD 배포 후 §11.5 스모크 통과 (사용자 요청 시).
- [ ] auto-memory 업데이트: 진행 중인 작업에서 완료 작업으로 이동.

---

## 후속 작업 후보 (별도 plan)

- 어드민 대시보드 채널별 분리 표시 + 한국어 라벨 매핑.
- 시트 열림 impression 이벤트.
- 단계별(읽기/듣기/표현/퀴즈/인터뷰) micro-share 모먼트.
- 헤더 상시 공유 아이콘 / `/today` 상단 공유 카드.
- 녹음 자체의 공유 가능한 token URL.
- 홈/`/today`에서의 공유 (`Share.contentId` nullable + API/Sheet props optional).
- ShareSheet focus trap 도입.
- jsdom + @testing-library/react 도입해 ShareSheet 컴포넌트 자동 테스트.

# 인터뷰/녹음 기능 재설계 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** routines.soritune.com 의 인터뷰 피드백을 한국어화하고, 녹음 기능을 "AI 추천 문장을 MediaRecorder 로 녹음 → 서버 저장 → 재생/다운로드/카페 이동" 으로 전면 교체한다.

**Architecture:** Interview API 가 AI 응답에 `recommendedSentence` 를 추가로 받아 `InterviewAnswer` 모델에 upsert 하고, Speaking 페이지가 이를 읽어와 `Recording` 모델을 통해 서버 파일시스템(`uploads/recordings/`)에 저장한다. 7일 TTL 은 매일 새벽 4시 cron 이 정리. 네이버 카페는 클라이언트 UA 로 PC/모바일 URL 분기.

**Tech Stack:** Next.js 16 App Router, NextAuth v5, Prisma 6 (MySQL), React 19, TypeScript, pnpm, vitest (신규).

**Spec:** `docs/superpowers/specs/2026-04-21-interview-recording-redesign-design.md`

**Repo root:** `/var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines/` — 모든 경로는 이 repo root 기준.

**Branch:** `main` (routines 는 main 단일 브랜치 운영).

---

## 파일 맵

### 신규 파일
- `prisma/migrations/YYYYMMDDHHMMSS_add_interview_answer_and_recording/migration.sql` (자동 생성)
- `src/lib/audio-mime.ts` — MIME → 확장자 매핑 순수 함수
- `src/lib/audio-mime.test.ts`
- `src/lib/cafe-link.ts` — PC/모바일 카페 URL 분기
- `src/lib/cafe-link.test.ts`
- `src/lib/interview-answer-keys.ts` — Prisma composite key 빌더
- `src/lib/interview-answer-keys.test.ts`
- `src/lib/upload-paths.ts` — 녹음 파일 경로 규약 함수
- `src/app/api/interview-answer/route.ts` — GET 리스팅
- `src/app/api/recording/upload/route.ts` — POST 업로드
- `src/app/api/recording/[id]/route.ts` — DELETE
- `src/app/api/recording/[id]/file/route.ts` — GET 스트리밍
- `src/app/api/cron/cleanup-recordings/route.ts` — POST TTL 정리
- `src/hooks/use-media-recorder.ts` — MediaRecorder 추상화
- `src/components/learning/recording-studio.tsx` — 녹음 페이지 메인 컴포넌트
- `src/components/learning/recording-card.tsx` — 카드 하나
- `vitest.config.ts` — 테스트 러너 설정

### 수정 파일
- `package.json` — vitest 의존성 + test 스크립트
- `prisma/schema.prisma` — `InterviewAnswer`, `Recording` 모델 + `User`/`Content` 역관계
- `.env.local` — `CLEANUP_CRON_SECRET` 추가 (배포 서버에서 직접)
- `src/lib/ai-service.ts` — 시스템 프롬프트 한글화 + 스키마 확장
- `src/app/api/ai/interview/route.ts` — InterviewAnswer upsert
- `src/components/learning/interview-chat.tsx` — 한글 피드백 + 추천 문장 섹션 + 스킵
- `src/app/(main)/learn/[contentId]/interview/page.tsx` — 완료 시 speaking 이동 유지
- `src/app/(main)/learn/[contentId]/speaking/page.tsx` — RecordingStudio 사용
- `src/contexts/speech-context.tsx` — STT 감지 제거, TTS 만 유지

### 삭제 파일
- `src/lib/string-similarity.ts` — Levenshtein 점수는 더 이상 사용 안 함
- `src/components/learning/speaking-recorder.tsx` — RecordingStudio 로 대체

---

## Task 1: 테스트 러너 셋업 (vitest)

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`

- [ ] **Step 1: vitest 의존성 추가**

Run:
```bash
cd /var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines
pnpm add -D vitest @vitest/ui
```

Expected: `package.json` 에 `vitest` 와 `@vitest/ui` 가 devDependencies 로 추가.

- [ ] **Step 2: vitest.config.ts 작성**

Create `vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    globals: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

- [ ] **Step 3: test 스크립트 추가**

Edit `package.json` scripts:
```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 4: 빈 스모크 테스트로 러너 검증**

Create `src/lib/_smoke.test.ts`:
```ts
import { describe, it, expect } from "vitest";

describe("vitest smoke", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: 테스트 실행 확인**

Run: `pnpm test`
Expected: `1 test passed`.

- [ ] **Step 6: 스모크 테스트 파일 삭제 + 커밋**

Run:
```bash
rm src/lib/_smoke.test.ts
git add package.json pnpm-lock.yaml vitest.config.ts
git commit -m "chore: add vitest test runner"
```

---

## Task 2: MIME → 확장자 매핑 함수 (TDD)

**Files:**
- Create: `src/lib/audio-mime.ts`
- Create: `src/lib/audio-mime.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

Create `src/lib/audio-mime.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { mimeToExt } from "./audio-mime";

describe("mimeToExt", () => {
  it("maps audio/webm → webm", () => {
    expect(mimeToExt("audio/webm")).toBe("webm");
  });
  it("maps audio/webm;codecs=opus → webm (ignores codec suffix)", () => {
    expect(mimeToExt("audio/webm;codecs=opus")).toBe("webm");
  });
  it("maps audio/ogg → ogg", () => {
    expect(mimeToExt("audio/ogg")).toBe("ogg");
  });
  it("maps audio/mp4 → mp4", () => {
    expect(mimeToExt("audio/mp4")).toBe("mp4");
  });
  it("maps audio/mpeg → mp4 (Safari alias)", () => {
    expect(mimeToExt("audio/mpeg")).toBe("mp4");
  });
  it("is case-insensitive", () => {
    expect(mimeToExt("AUDIO/WEBM")).toBe("webm");
  });
  it("throws on unsupported MIME", () => {
    expect(() => mimeToExt("video/mp4")).toThrow(/Unsupported audio MIME/);
    expect(() => mimeToExt("")).toThrow(/Unsupported audio MIME/);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `pnpm test src/lib/audio-mime.test.ts`
Expected: FAIL — 파일 없음 에러.

- [ ] **Step 3: 최소 구현**

Create `src/lib/audio-mime.ts`:
```ts
export type AudioExt = "webm" | "ogg" | "mp4";

export function mimeToExt(mime: string): AudioExt {
  const m = mime.toLowerCase();
  if (m.startsWith("audio/webm")) return "webm";
  if (m.startsWith("audio/ogg")) return "ogg";
  if (m.startsWith("audio/mp4") || m.startsWith("audio/mpeg")) return "mp4";
  throw new Error(`Unsupported audio MIME: ${mime}`);
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm test src/lib/audio-mime.test.ts`
Expected: 7 tests passed.

- [ ] **Step 5: 커밋**

```bash
git add src/lib/audio-mime.ts src/lib/audio-mime.test.ts
git commit -m "feat(audio): mimeToExt mapper for recording uploads"
```

---

## Task 3: 카페 URL 분기 함수 (TDD)

**Files:**
- Create: `src/lib/cafe-link.ts`
- Create: `src/lib/cafe-link.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

Create `src/lib/cafe-link.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { pickCafeUrl, CAFE_URL_PC, CAFE_URL_MOBILE } from "./cafe-link";

describe("pickCafeUrl", () => {
  it("returns PC URL for desktop Chrome UA", () => {
    const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0";
    expect(pickCafeUrl(ua)).toBe(CAFE_URL_PC);
  });
  it("returns mobile URL for iPhone UA", () => {
    const ua = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit";
    expect(pickCafeUrl(ua)).toBe(CAFE_URL_MOBILE);
  });
  it("returns mobile URL for Android UA", () => {
    const ua = "Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile";
    expect(pickCafeUrl(ua)).toBe(CAFE_URL_MOBILE);
  });
  it("returns mobile URL for iPad UA", () => {
    const ua = "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit";
    expect(pickCafeUrl(ua)).toBe(CAFE_URL_MOBILE);
  });
  it("returns PC URL for empty / unknown UA", () => {
    expect(pickCafeUrl("")).toBe(CAFE_URL_PC);
    expect(pickCafeUrl("curl/8.0")).toBe(CAFE_URL_PC);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `pnpm test src/lib/cafe-link.test.ts`
Expected: FAIL — 모듈 없음.

- [ ] **Step 3: 최소 구현**

Create `src/lib/cafe-link.ts`:
```ts
export const CAFE_URL_PC = "https://cafe.naver.com/f-e/cafes/23243775/menus/1";
export const CAFE_URL_MOBILE = "https://m.cafe.naver.com/ca-fe/web/cafes/23243775/menus/1";

export function pickCafeUrl(userAgent: string): string {
  const ua = userAgent.toLowerCase();
  const isMobile = /mobile|android|iphone|ipad|ipod/.test(ua);
  return isMobile ? CAFE_URL_MOBILE : CAFE_URL_PC;
}

export function getCafeUrl(): string {
  if (typeof window === "undefined") return CAFE_URL_PC;
  return pickCafeUrl(navigator.userAgent);
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm test src/lib/cafe-link.test.ts`
Expected: 5 tests passed.

- [ ] **Step 5: 커밋**

```bash
git add src/lib/cafe-link.ts src/lib/cafe-link.test.ts
git commit -m "feat(cafe-link): UA-based PC/mobile URL selection"
```

---

## Task 4: InterviewAnswer composite key 빌더 (TDD)

**Files:**
- Create: `src/lib/interview-answer-keys.ts`
- Create: `src/lib/interview-answer-keys.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

Create `src/lib/interview-answer-keys.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { buildInterviewAnswerUniqueKey } from "./interview-answer-keys";

describe("buildInterviewAnswerUniqueKey", () => {
  it("returns Prisma composite key object", () => {
    const key = buildInterviewAnswerUniqueKey({
      userId: "u1",
      contentId: 42,
      level: "beginner",
      questionIndex: 0,
    });
    expect(key).toEqual({
      userId_contentId_level_questionIndex: {
        userId: "u1",
        contentId: 42,
        level: "beginner",
        questionIndex: 0,
      },
    });
  });
  it("preserves all four fields", () => {
    const key = buildInterviewAnswerUniqueKey({
      userId: "u2",
      contentId: 7,
      level: "advanced",
      questionIndex: 3,
    });
    const inner = key.userId_contentId_level_questionIndex;
    expect(Object.keys(inner).sort()).toEqual(
      ["contentId", "level", "questionIndex", "userId"]
    );
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `pnpm test src/lib/interview-answer-keys.test.ts`
Expected: FAIL — 모듈 없음.

- [ ] **Step 3: 최소 구현**

Create `src/lib/interview-answer-keys.ts`:
```ts
import type { ContentLevel } from "@prisma/client";

export interface InterviewAnswerKey {
  userId: string;
  contentId: number;
  level: ContentLevel;
  questionIndex: number;
}

export function buildInterviewAnswerUniqueKey(k: InterviewAnswerKey) {
  return {
    userId_contentId_level_questionIndex: {
      userId: k.userId,
      contentId: k.contentId,
      level: k.level,
      questionIndex: k.questionIndex,
    },
  };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm test src/lib/interview-answer-keys.test.ts`
Expected: 2 tests passed.

- [ ] **Step 5: 커밋**

```bash
git add src/lib/interview-answer-keys.ts src/lib/interview-answer-keys.test.ts
git commit -m "feat(interview): composite key builder for upsert"
```

---

## Task 5: 업로드 파일 경로 규약 유틸

**Files:**
- Create: `src/lib/upload-paths.ts`

- [ ] **Step 1: 구현**

Create `src/lib/upload-paths.ts`:
```ts
import path from "node:path";
import type { AudioExt } from "./audio-mime";

// repo-root-relative base
export const UPLOAD_BASE = "uploads/recordings";

export function getUploadRoot(): string {
  // process.cwd() 는 Next.js 런타임에서 앱 루트를 가리킴
  return path.join(process.cwd(), UPLOAD_BASE);
}

export function getUserDir(userId: string): string {
  return path.join(getUploadRoot(), userId);
}

export function getRecordingAbsPath(userId: string, recordingId: number, ext: AudioExt): string {
  return path.join(getUserDir(userId), `${recordingId}.${ext}`);
}

export function getRecordingRelPath(userId: string, recordingId: number, ext: AudioExt): string {
  // DB 에 저장되는 filePath — repo root 상대
  return path.posix.join(UPLOAD_BASE, userId, `${recordingId}.${ext}`);
}

export function getTempAbsPath(userId: string, tmpId: string, ext: AudioExt): string {
  return path.join(getUserDir(userId), `.tmp-${tmpId}.${ext}`);
}
```

- [ ] **Step 2: `uploads/` 디렉토리를 gitignore 에 추가**

Edit `.gitignore` (append):
```
# Audio recording uploads (per-user, TTL-controlled)
/uploads/
```

- [ ] **Step 3: 커밋**

```bash
git add src/lib/upload-paths.ts .gitignore
git commit -m "feat(upload): path utilities for recording storage"
```

---

## Task 6: Prisma 스키마 확장 + 마이그레이션

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: User 모델에 역관계 추가**

Edit `prisma/schema.prisma` — `User` 모델 (line 10-28) 의 relations 블록 (line 21-25) 를 다음으로 교체:
```prisma
  progress         UserProgress[]
  streak           Streak?
  analyticsEvents  AnalyticsEvent[]
  shares           Share[]
  passwordResets   PasswordReset[]
  interviewAnswers InterviewAnswer[]
  recordings       Recording[]
```

- [ ] **Step 2: Content 모델에 역관계 추가**

Edit `prisma/schema.prisma` — `Content` 모델 (line 43-66) 의 relations 블록 (line 57-62) 를 다음으로 교체 (기존 필드 유지 + 한 줄 추가):
```prisma
  variants         ContentVariant[]
  progress         UserProgress[]
  analyticsEvents  AnalyticsEvent[]
  shares           Share[]
  interviewAnswers InterviewAnswer[]
  reusedFrom       Content?  @relation("ContentReuse", fields: [reusedFromContentId], references: [id], onDelete: SetNull)
  reusedBy         Content[] @relation("ContentReuse")
```

- [ ] **Step 3: InterviewAnswer 모델 추가**

Edit `prisma/schema.prisma` — `AISetting` 모델 바로 앞에 추가:
```prisma
model InterviewAnswer {
  id                  Int          @id @default(autoincrement())
  userId              String       @map("user_id") @db.VarChar(36)
  contentId           Int          @map("content_id")
  questionIndex       Int          @map("question_index")
  level               ContentLevel
  question            String       @db.Text
  userAnswer          String       @map("user_answer") @db.Text
  recommendedSentence String       @map("recommended_sentence") @db.Text
  feedback            Json
  createdAt           DateTime     @default(now()) @map("created_at")
  updatedAt           DateTime     @updatedAt @map("updated_at")

  user       User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  content    Content     @relation(fields: [contentId], references: [id], onDelete: Cascade)
  recordings Recording[]

  @@unique([userId, contentId, level, questionIndex])
  @@index([userId, contentId, level])
  @@map("interview_answers")
}

model Recording {
  id                Int      @id @default(autoincrement())
  userId            String   @map("user_id") @db.VarChar(36)
  interviewAnswerId Int      @map("interview_answer_id")
  targetSentence    String   @map("target_sentence") @db.Text
  filePath          String   @map("file_path") @db.VarChar(512)
  fileExt           String   @map("file_ext") @db.VarChar(8)
  mimeType          String   @map("mime_type") @db.VarChar(64)
  sizeBytes         Int      @map("size_bytes")
  durationMs        Int?     @map("duration_ms")
  createdAt         DateTime @default(now()) @map("created_at")
  expiresAt         DateTime @map("expires_at")

  user            User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  interviewAnswer InterviewAnswer @relation(fields: [interviewAnswerId], references: [id], onDelete: Cascade)

  @@index([userId, interviewAnswerId])
  @@index([expiresAt])
  @@map("recordings")
}
```

- [ ] **Step 4: 스키마 검증 (포매팅·문법)**

Run:
```bash
cd /var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines
pnpm prisma format
pnpm prisma validate
```
Expected: "The schema at ... is valid ✔️".

- [ ] **Step 5: 마이그레이션 생성 및 적용**

Run:
```bash
pnpm prisma migrate dev --name add_interview_answer_and_recording
```
Expected: `prisma/migrations/YYYYMMDDHHMMSS_add_interview_answer_and_recording/migration.sql` 생성, DB 에 적용, Prisma Client 재생성.

- [ ] **Step 6: 마이그레이션 SQL 내용 확인**

Read the generated `prisma/migrations/*_add_interview_answer_and_recording/migration.sql`.
Expected: `CREATE TABLE interview_answers`, `CREATE TABLE recordings`, 각 인덱스 / unique / FK 가 포함되어 있을 것.

- [ ] **Step 7: 커밋**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(db): add InterviewAnswer and Recording models"
```

---

## Task 7: AI 서비스 시스템 프롬프트 한글화 + recommendedSentence

**Files:**
- Modify: `src/lib/ai-service.ts`

- [ ] **Step 1: 시스템 프롬프트 + 반환 타입 교체**

Edit `src/lib/ai-service.ts` — 파일 전체를 다음으로 교체:
```ts
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { prisma } from "./prisma";
import { decrypt } from "./encryption";

const SYSTEM_PROMPT = `You are an English tutor helping Korean learners practice conversational English. Your feedback targets Korean learners, so **write all explanations in Korean**. Quote English expressions, example sentences, and corrected phrases in English using double quotes — do not translate the English itself into Korean.

Given a question and the student's answer, respond with this JSON:
{
  "relevance": "한국어로 설명. 답변이 질문에 적절히 답했는지. 영어 예시는 \\"like this\\"처럼 따옴표로.",
  "grammar": "한국어로 문법 교정 설명. 오류가 없으면 \\"No grammar issues found.\\" 라고만 쓴다.",
  "nativeExpression": "한국어로 더 자연스러운 표현 제안. 영어 표현은 \\"hang out\\" 처럼 따옴표로.",
  "encouragement": "한국어로 격려 메시지. 짧고 따뜻하게.",
  "recommendedSentence": "학생이 녹음 연습할 자연스러운 영어 문장(들). 학생의 의도를 반영하며 권장 25단어 이내, 필요하면 여러 문장으로 구성 가능. 따옴표 없이 순수 영어만."
}

Respond ONLY with valid JSON. No markdown, no code blocks, just the JSON object.`;

interface ActiveProvider {
  provider: "claude" | "openai";
  apiKey: string;
  model: string;
}

export interface InterviewFeedback {
  relevance: string;
  grammar: string;
  nativeExpression: string;
  encouragement: string;
}

export interface InterviewAIResponse {
  feedback: InterviewFeedback;
  recommendedSentence: string;
}

export async function getActiveProvider(): Promise<ActiveProvider> {
  const setting = await prisma.aISetting.findFirst({
    where: { isActive: true },
  });

  if (!setting) {
    throw new Error("AI provider not configured");
  }

  return {
    provider: setting.provider as "claude" | "openai",
    apiKey: decrypt(setting.apiKey),
    model: setting.model,
  };
}

export async function getInterviewFeedback(
  question: string,
  answer: string,
  contentContext: string
): Promise<InterviewAIResponse> {
  const { provider, apiKey, model } = await getActiveProvider();

  const userMessage = `Context: The student is learning from content about "${contentContext}".

Question: ${question}

Student's answer: ${answer}`;

  let responseText: string;

  if (provider === "claude") {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const block = response.content[0];
    responseText = block.type === "text" ? block.text : "";
  } else {
    const client = new OpenAI({ apiKey });
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
    });

    responseText = response.choices[0]?.message?.content ?? "";
  }

  // AI 응답은 flat 5-key 구조로 반환. 누락 대비 모두 optional.
  const parsed = JSON.parse(responseText) as Partial<InterviewFeedback & { recommendedSentence: string }>;

  const feedback: InterviewFeedback = {
    relevance: parsed.relevance ?? "",
    grammar: parsed.grammar ?? "",
    nativeExpression: parsed.nativeExpression ?? "",
    encouragement: parsed.encouragement ?? "",
  };

  // Graceful degrade: recommendedSentence 누락 시 원문 답변을 fallback
  const recommendedSentence =
    typeof parsed.recommendedSentence === "string" && parsed.recommendedSentence.trim().length > 0
      ? parsed.recommendedSentence.trim()
      : answer;

  return { feedback, recommendedSentence };
}
```

- [ ] **Step 2: 타입 체크**

Run: `pnpm tsc --noEmit`
Expected: 에러 없음 (혹은 관련 없는 기존 에러만).

⚠️ 이 시점에 `src/app/api/ai/interview/route.ts` 가 기존 `{ feedback }` 만 받는 형태라 반환 타입 변경으로 타입 에러 발생할 수 있음 → 다음 task 에서 해결.

- [ ] **Step 3: 커밋**

```bash
git add src/lib/ai-service.ts
git commit -m "feat(ai): Korean feedback + recommendedSentence in interview prompt"
```

---

## Task 8: Interview API 라우트 수정 (upsert + 응답 확장)

**Files:**
- Modify: `src/app/api/ai/interview/route.ts`

- [ ] **Step 1: 라우트 전체 교체**

Edit `src/app/api/ai/interview/route.ts` — 전체를 다음으로 교체:
```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { getInterviewFeedback } from "@/lib/ai-service";
import { buildInterviewAnswerUniqueKey } from "@/lib/interview-answer-keys";
import type { ContentLevel } from "@prisma/client";

const VALID_LEVELS: readonly ContentLevel[] = ["beginner", "intermediate", "advanced"] as const;

export async function POST(req: NextRequest) {
  const { error, session } = await requireAuth();
  if (error) return error;

  try {
    const body = await req.json() as {
      contentId?: number;
      questionIndex?: number;
      question?: string;
      answer?: string;
      level?: ContentLevel;
    };
    const { contentId, questionIndex, question, answer, level } = body;

    if (
      typeof contentId !== "number" ||
      typeof questionIndex !== "number" ||
      typeof question !== "string" ||
      typeof answer !== "string" ||
      typeof level !== "string" ||
      !VALID_LEVELS.includes(level)
    ) {
      return NextResponse.json(
        { error: "Missing or invalid fields" },
        { status: 400 }
      );
    }

    const content = await prisma.content.findUnique({
      where: { id: contentId },
      select: { title: true, keyPhrase: true },
    });

    const contentContext = content
      ? `${content.title} - ${content.keyPhrase}`
      : "General English conversation";

    const { feedback, recommendedSentence } = await getInterviewFeedback(
      question,
      answer,
      contentContext
    );

    const userId = session!.user.id;

    await prisma.interviewAnswer.upsert({
      where: buildInterviewAnswerUniqueKey({ userId, contentId, level, questionIndex }),
      update: {
        question,
        userAnswer: answer,
        recommendedSentence,
        feedback,
      },
      create: {
        userId,
        contentId,
        level,
        questionIndex,
        question,
        userAnswer: answer,
        recommendedSentence,
        feedback,
      },
    });

    return NextResponse.json({ feedback, recommendedSentence });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";

    if (message === "AI provider not configured") {
      return NextResponse.json(
        { error: "AI service is not configured" },
        { status: 503 }
      );
    }

    console.error("AI interview error:", message);
    return NextResponse.json(
      { error: "Failed to get AI feedback" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: 타입 체크**

Run: `pnpm tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 3: 수동 검증 — dev 서버에서 인터뷰 호출**

Run: `pnpm dev` (별도 터미널)
로컬 or staging 에서 인터뷰 한 건 제출 → 응답에 한국어 피드백 + `recommendedSentence` 포함 확인. DB 의 `interview_answers` 테이블에 row 생성 확인:
```bash
mysql -u root SORITUNECOM_ROUTINES -e "SELECT id, user_id, content_id, level, question_index, LEFT(recommended_sentence,60) FROM interview_answers ORDER BY id DESC LIMIT 3;"
```
(자격증명은 `~/.db_credentials` 에서)

- [ ] **Step 4: 커밋**

```bash
git add src/app/api/ai/interview/route.ts
git commit -m "feat(api): persist InterviewAnswer on POST /api/ai/interview"
```

---

## Task 9: InterviewAnswer 리스팅 API (GET)

**Files:**
- Create: `src/app/api/interview-answer/route.ts`

- [ ] **Step 1: 엔드포인트 구현**

Create `src/app/api/interview-answer/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import type { ContentLevel } from "@prisma/client";

const VALID_LEVELS: readonly ContentLevel[] = ["beginner", "intermediate", "advanced"] as const;

export async function GET(req: NextRequest) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const contentIdStr = searchParams.get("contentId");
  const levelStr = searchParams.get("level");

  const contentId = contentIdStr ? parseInt(contentIdStr, 10) : NaN;
  if (Number.isNaN(contentId)) {
    return NextResponse.json({ error: "Invalid contentId" }, { status: 400 });
  }
  if (!levelStr || !VALID_LEVELS.includes(levelStr as ContentLevel)) {
    return NextResponse.json({ error: "Invalid level" }, { status: 400 });
  }
  const level = levelStr as ContentLevel;

  const userId = session!.user.id;

  const answers = await prisma.interviewAnswer.findMany({
    where: { userId, contentId, level },
    orderBy: { questionIndex: "asc" },
    include: {
      recordings: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  return NextResponse.json({
    answers: answers.map((a) => ({
      id: a.id,
      questionIndex: a.questionIndex,
      question: a.question,
      recommendedSentence: a.recommendedSentence,
      latestRecording: a.recordings[0]
        ? {
            id: a.recordings[0].id,
            targetSentence: a.recordings[0].targetSentence,
            createdAt: a.recordings[0].createdAt.toISOString(),
            expiresAt: a.recordings[0].expiresAt.toISOString(),
            durationMs: a.recordings[0].durationMs,
          }
        : null,
    })),
  });
}
```

- [ ] **Step 2: 타입 체크**

Run: `pnpm tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 3: 수동 검증**

로그인된 브라우저에서:
```
GET https://routines.soritune.com/api/interview-answer?contentId=1&level=beginner
```
Expected: `{ "answers": [...] }` JSON. Task 8 에서 생성한 답변이 포함.

- [ ] **Step 4: 커밋**

```bash
git add src/app/api/interview-answer/route.ts
git commit -m "feat(api): GET /api/interview-answer lists user's answers + latest recording"
```

---

## Task 10: 녹음 업로드 API (POST)

**Files:**
- Create: `src/app/api/recording/upload/route.ts`

- [ ] **Step 1: 엔드포인트 구현**

Create `src/app/api/recording/upload/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { mimeToExt } from "@/lib/audio-mime";
import {
  getUserDir,
  getRecordingAbsPath,
  getRecordingRelPath,
  getTempAbsPath,
} from "@/lib/upload-paths";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MiB
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function POST(req: NextRequest) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const userId = session!.user.id;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const interviewAnswerIdRaw = form.get("interviewAnswerId");
  const audio = form.get("audio");
  const durationMsRaw = form.get("durationMs");

  const interviewAnswerId = typeof interviewAnswerIdRaw === "string"
    ? parseInt(interviewAnswerIdRaw, 10)
    : NaN;
  if (Number.isNaN(interviewAnswerId)) {
    return NextResponse.json({ error: "Missing interviewAnswerId" }, { status: 400 });
  }

  if (!(audio instanceof File)) {
    return NextResponse.json({ error: "Missing audio file" }, { status: 400 });
  }
  if (audio.size === 0) {
    return NextResponse.json({ error: "Empty audio file" }, { status: 400 });
  }
  if (audio.size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large (max 10 MiB)" }, { status: 413 });
  }

  let fileExt: "webm" | "ogg" | "mp4";
  try {
    fileExt = mimeToExt(audio.type);
  } catch {
    return NextResponse.json({ error: `Unsupported MIME: ${audio.type}` }, { status: 400 });
  }

  const durationMs = typeof durationMsRaw === "string"
    ? Math.max(0, parseInt(durationMsRaw, 10) || 0)
    : null;

  // Ownership check — InterviewAnswer must belong to this user, and snapshot its current recommendedSentence.
  const answer = await prisma.interviewAnswer.findUnique({
    where: { id: interviewAnswerId },
    select: { id: true, userId: true, recommendedSentence: true },
  });
  if (!answer || answer.userId !== userId) {
    return NextResponse.json({ error: "Interview answer not found" }, { status: 404 });
  }

  const userDir = getUserDir(userId);
  await fs.mkdir(userDir, { recursive: true });

  // Step 1: save to temp file
  const tmpId = crypto.randomBytes(8).toString("hex");
  const tmpPath = getTempAbsPath(userId, tmpId, fileExt);
  const buffer = Buffer.from(await audio.arrayBuffer());
  await fs.writeFile(tmpPath, buffer);

  // Step 2 & 3: transactional DB swap (delete old, create new)
  let newRecordingId: number;
  let oldPaths: string[] = [];
  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.recording.findMany({
        where: { interviewAnswerId, userId },
        select: { id: true, filePath: true },
      });
      if (existing.length > 0) {
        await tx.recording.deleteMany({
          where: { id: { in: existing.map((r) => r.id) } },
        });
      }
      const created = await tx.recording.create({
        data: {
          userId,
          interviewAnswerId,
          targetSentence: answer.recommendedSentence,
          filePath: "", // filled after rename
          fileExt,
          mimeType: audio.type,
          sizeBytes: audio.size,
          durationMs,
          expiresAt: new Date(Date.now() + TTL_MS),
        },
      });
      return { newId: created.id, oldPaths: existing.map((r) => r.filePath) };
    });
    newRecordingId = result.newId;
    oldPaths = result.oldPaths;
  } catch (err) {
    await fs.unlink(tmpPath).catch(() => undefined);
    console.error("Recording DB tx failed:", err);
    return NextResponse.json({ error: "Failed to save recording" }, { status: 500 });
  }

  // Step 4: rename temp → final, update filePath
  const finalAbs = getRecordingAbsPath(userId, newRecordingId, fileExt);
  const finalRel = getRecordingRelPath(userId, newRecordingId, fileExt);
  try {
    await fs.rename(tmpPath, finalAbs);
  } catch (err) {
    console.error("Recording rename failed:", err);
    // Row remains with filePath="" — cron will expire it. Log for diagnosis.
  }
  await prisma.recording.update({
    where: { id: newRecordingId },
    data: { filePath: finalRel },
  });

  // Step 5: unlink old files (best-effort, cron is safety net)
  for (const p of oldPaths) {
    if (!p) continue;
    const abs = path.join(process.cwd(), p);
    await fs.unlink(abs).catch(() => undefined);
  }

  const rec = await prisma.recording.findUnique({
    where: { id: newRecordingId },
    select: { id: true, createdAt: true, expiresAt: true, durationMs: true, targetSentence: true },
  });

  return NextResponse.json({
    id: rec!.id,
    targetSentence: rec!.targetSentence,
    createdAt: rec!.createdAt.toISOString(),
    expiresAt: rec!.expiresAt.toISOString(),
    durationMs: rec!.durationMs,
  });
}

export const runtime = "nodejs";
```

- [ ] **Step 2: 타입 체크**

Run: `pnpm tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 3: 커밋**

```bash
git add src/app/api/recording/upload/route.ts
git commit -m "feat(api): POST /api/recording/upload with one-per-answer policy"
```

---

## Task 11: 녹음 스트리밍 API (GET file)

**Files:**
- Create: `src/app/api/recording/[id]/file/route.ts`

- [ ] **Step 1: 엔드포인트 구현**

Create `src/app/api/recording/[id]/file/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  const recordingId = parseInt(id, 10);
  if (Number.isNaN(recordingId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const rec = await prisma.recording.findUnique({
    where: { id: recordingId },
    include: { interviewAnswer: { select: { contentId: true, questionIndex: true } } },
  });
  if (!rec || rec.userId !== session!.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (rec.expiresAt.getTime() < Date.now()) {
    return NextResponse.json({ error: "Expired" }, { status: 404 });
  }

  const abs = path.join(process.cwd(), rec.filePath);
  let buffer: Buffer;
  try {
    buffer = await fs.readFile(abs);
  } catch {
    return NextResponse.json({ error: "File missing" }, { status: 404 });
  }

  const download = new URL(req.url).searchParams.get("download") === "1";
  const dateStr = rec.createdAt.toISOString().slice(0, 10).replace(/-/g, "");
  const filename = `soritune-${rec.interviewAnswer.contentId}-q${rec.interviewAnswer.questionIndex}-${dateStr}.${rec.fileExt}`;

  const headers: Record<string, string> = {
    "Content-Type": rec.mimeType,
    "Content-Length": String(rec.sizeBytes),
    "Cache-Control": "private, no-store",
  };
  if (download) {
    headers["Content-Disposition"] = `attachment; filename="${filename}"`;
  } else {
    headers["Content-Disposition"] = `inline; filename="${filename}"`;
  }

  return new NextResponse(new Uint8Array(buffer), { status: 200, headers });
}

export const runtime = "nodejs";
```

- [ ] **Step 2: 타입 체크**

Run: `pnpm tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 3: 커밋**

```bash
git add src/app/api/recording/\[id\]/file/route.ts
git commit -m "feat(api): GET /api/recording/[id]/file streams audio with auth"
```

---

## Task 12: 녹음 삭제 API (DELETE)

**Files:**
- Create: `src/app/api/recording/[id]/route.ts`

- [ ] **Step 1: 엔드포인트 구현**

Create `src/app/api/recording/[id]/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  const recordingId = parseInt(id, 10);
  if (Number.isNaN(recordingId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const rec = await prisma.recording.findUnique({
    where: { id: recordingId },
    select: { id: true, userId: true, filePath: true },
  });
  if (!rec || rec.userId !== session!.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const abs = path.join(process.cwd(), rec.filePath);
  await fs.unlink(abs).catch(() => undefined);
  await prisma.recording.delete({ where: { id: recordingId } });

  return NextResponse.json({ ok: true });
}

export const runtime = "nodejs";
```

- [ ] **Step 2: 타입 체크**

Run: `pnpm tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 3: 커밋**

```bash
git add src/app/api/recording/\[id\]/route.ts
git commit -m "feat(api): DELETE /api/recording/[id] removes file + row"
```

---

## Task 13: TTL 정리 크론 API

**Files:**
- Create: `src/app/api/cron/cleanup-recordings/route.ts`

- [ ] **Step 1: 엔드포인트 구현**

Create `src/app/api/cron/cleanup-recordings/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const secret = process.env.CLEANUP_CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CLEANUP_CRON_SECRET not configured" }, { status: 503 });
  }
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  const expired = await prisma.recording.findMany({
    where: { expiresAt: { lt: new Date() } },
    select: { id: true, filePath: true },
  });

  let fileDeleteFailures = 0;
  for (const rec of expired) {
    if (!rec.filePath) continue;
    const abs = path.join(process.cwd(), rec.filePath);
    try {
      await fs.unlink(abs);
    } catch (err) {
      const code = (err as NodeJS.ErrnoException)?.code;
      if (code !== "ENOENT") {
        fileDeleteFailures += 1;
        console.error("cleanup unlink failed:", rec.filePath, err);
      }
    }
  }

  const { count } = await prisma.recording.deleteMany({
    where: { id: { in: expired.map((r) => r.id) } },
  });

  return NextResponse.json({
    deletedCount: count,
    fileDeleteFailures,
    elapsedMs: Date.now() - startedAt,
  });
}

export const runtime = "nodejs";
```

- [ ] **Step 2: 타입 체크**

Run: `pnpm tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 3: 커밋**

```bash
git add src/app/api/cron/cleanup-recordings/route.ts
git commit -m "feat(cron): cleanup-recordings endpoint for 7d TTL"
```

---

## Task 14: useMediaRecorder 훅

**Files:**
- Create: `src/hooks/use-media-recorder.ts`

- [ ] **Step 1: 훅 구현**

Create `src/hooks/use-media-recorder.ts`:
```ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type RecorderStatus = "idle" | "requesting" | "recording" | "stopped" | "error";

interface UseMediaRecorderResult {
  status: RecorderStatus;
  start: () => Promise<void>;
  stop: () => Promise<Blob | null>;
  reset: () => void;
  durationMs: number;
  blob: Blob | null;
  mimeType: string | null;
  error: Error | null;
  isSupported: boolean;
}

function pickMimeType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg",
  ];
  for (const t of candidates) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return null;
}

export function useMediaRecorder(): UseMediaRecorderResult {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [durationMs, setDurationMs] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [mimeType, setMimeType] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startedAtRef = useRef<number>(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopResolverRef = useRef<((b: Blob | null) => void) | null>(null);

  const isSupported =
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices &&
    typeof MediaRecorder !== "undefined" &&
    pickMimeType() !== null;

  const stopTick = () => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  };

  const cleanupStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  useEffect(() => {
    return () => {
      stopTick();
      cleanupStream();
    };
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setBlob(null);
    setDurationMs(0);
    chunksRef.current = [];

    if (!isSupported) {
      const err = new Error("MediaRecorder not supported on this device");
      setError(err);
      setStatus("error");
      throw err;
    }

    setStatus("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mt = pickMimeType()!;
      setMimeType(mt);
      const rec = new MediaRecorder(stream, { mimeType: mt });
      recorderRef.current = rec;

      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        const finalBlob = new Blob(chunksRef.current, { type: mt });
        setBlob(finalBlob);
        setStatus("stopped");
        cleanupStream();
        stopTick();
        stopResolverRef.current?.(finalBlob);
        stopResolverRef.current = null;
      };
      rec.onerror = (ev) => {
        const err = new Error("MediaRecorder error");
        console.error("MediaRecorder error:", ev);
        setError(err);
        setStatus("error");
        cleanupStream();
        stopTick();
        stopResolverRef.current?.(null);
        stopResolverRef.current = null;
      };

      startedAtRef.current = Date.now();
      tickRef.current = setInterval(() => {
        setDurationMs(Date.now() - startedAtRef.current);
      }, 100);

      rec.start();
      setStatus("recording");
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      setStatus("error");
      cleanupStream();
      throw err;
    }
  }, [isSupported]);

  const stop = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const rec = recorderRef.current;
      if (!rec || rec.state === "inactive") {
        resolve(blob);
        return;
      }
      stopResolverRef.current = resolve;
      rec.stop();
    });
  }, [blob]);

  const reset = useCallback(() => {
    stopTick();
    cleanupStream();
    recorderRef.current = null;
    chunksRef.current = [];
    setBlob(null);
    setDurationMs(0);
    setMimeType(null);
    setError(null);
    setStatus("idle");
  }, []);

  return { status, start, stop, reset, durationMs, blob, mimeType, error, isSupported };
}
```

- [ ] **Step 2: 타입 체크**

Run: `pnpm tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 3: 커밋**

```bash
git add src/hooks/use-media-recorder.ts
git commit -m "feat(hooks): useMediaRecorder abstraction"
```

---

## Task 15: InterviewChat 컴포넌트 수정 (한글 UI + 추천 문장 + 스킵)

**Files:**
- Modify: `src/components/learning/interview-chat.tsx`

- [ ] **Step 1: 전체 교체**

Edit `src/components/learning/interview-chat.tsx` — 전체를 다음으로 교체:
```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useLevel } from "@/contexts/level-context";

interface InterviewChatProps {
  questions: string[];
  contentId: string;
  onComplete: () => void;
}

interface Feedback {
  relevance: string;
  grammar: string;
  nativeExpression: string;
  encouragement: string;
}

interface AIResponse {
  feedback: Feedback;
  recommendedSentence: string;
}

const FALLBACK: AIResponse = {
  feedback: {
    relevance: "지금은 피드백을 가져올 수 없어요.",
    grammar: "",
    nativeExpression: "",
    encouragement: "괜찮아요. 다음 질문으로 넘어가세요.",
  },
  recommendedSentence: "",
};

export function InterviewChat({ questions, contentId, onComplete }: InterviewChatProps) {
  const { level } = useLevel();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [response, setResponse] = useState<AIResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const isLast = currentIndex === questions.length - 1;

  async function handleSubmit() {
    if (!level) return;
    setLoading(true);
    setResponse(null);

    try {
      const res = await fetch("/api/ai/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentId: parseInt(contentId),
          questionIndex: currentIndex,
          level,
          question: questions[currentIndex],
          answer,
        }),
      });

      if (res.ok) {
        setResponse(await res.json() as AIResponse);
      } else {
        setResponse(FALLBACK);
      }
    } catch {
      setResponse(FALLBACK);
    }

    setLoading(false);
  }

  function handleNext() {
    if (isLast) {
      onComplete();
      return;
    }
    setCurrentIndex((i) => i + 1);
    setAnswer("");
    setResponse(null);
  }

  function handleSkip() {
    if (isLast) {
      onComplete();
      return;
    }
    setCurrentIndex((i) => i + 1);
    setAnswer("");
    setResponse(null);
  }

  return (
    <div>
      <div className="mb-2 text-[13px] text-muted-silver">
        {currentIndex + 1} / {questions.length}
      </div>

      <div className="bg-near-black shadow-ring-blue rounded-xl p-6 mb-6">
        <p className="text-[18px] text-white leading-[1.6]">{questions[currentIndex]}</p>
      </div>

      {!response ? (
        <div className="space-y-4">
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="영어로 답변을 작성해주세요..."
            className="w-full bg-near-black border border-white/10 rounded-xl px-4 py-3 text-[15px] text-white leading-[1.6] placeholder:text-white/40 focus:border-framer-blue focus:outline-none min-h-[120px] resize-none"
          />
          <div className="flex gap-3">
            <Button onClick={handleSubmit} disabled={!answer.trim() || loading || !level}>
              {loading ? "분석 중..." : "제출"}
            </Button>
            <Button variant="ghost" onClick={handleSkip} disabled={loading}>
              이 질문 건너뛰기
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {response.feedback.relevance && (
            <div className="bg-near-black rounded-xl p-4">
              <p className="text-[13px] text-framer-blue font-medium mb-1">연관성</p>
              <p className="text-[14px] text-white/80 leading-[1.6]">{response.feedback.relevance}</p>
            </div>
          )}
          {response.feedback.grammar && (
            <div className="bg-near-black rounded-xl p-4">
              <p className="text-[13px] text-framer-blue font-medium mb-1">문법</p>
              <p className="text-[14px] text-white/80 leading-[1.6]">{response.feedback.grammar}</p>
            </div>
          )}
          {response.feedback.nativeExpression && (
            <div className="bg-near-black rounded-xl p-4">
              <p className="text-[13px] text-framer-blue font-medium mb-1">자연스러운 표현</p>
              <p className="text-[14px] text-white/80 leading-[1.6]">{response.feedback.nativeExpression}</p>
            </div>
          )}
          {response.feedback.encouragement && (
            <div className="bg-green-500/5 border border-green-500/10 rounded-xl p-4">
              <p className="text-[14px] text-green-300 leading-[1.6]">{response.feedback.encouragement}</p>
            </div>
          )}
          {response.recommendedSentence && (
            <div className="bg-framer-blue/10 border border-framer-blue/30 rounded-xl p-4">
              <p className="text-[13px] text-framer-blue font-medium mb-2">🎤 녹음할 추천 문장</p>
              <p className="text-[15px] text-white leading-[1.6]">{response.recommendedSentence}</p>
            </div>
          )}
          <Button onClick={handleNext}>
            {isLast ? "녹음하러 가기" : "다음 질문"}
          </Button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 타입 체크**

Run: `pnpm tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 3: 커밋**

```bash
git add src/components/learning/interview-chat.tsx
git commit -m "feat(interview): Korean feedback UI + recommendedSentence section + skip"
```

---

## Task 16: RecordingCard 컴포넌트 (신규)

**Files:**
- Create: `src/components/learning/recording-card.tsx`

- [ ] **Step 1: 컴포넌트 구현**

Create `src/components/learning/recording-card.tsx`:
```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useMediaRecorder } from "@/hooks/use-media-recorder";
import { getCafeUrl } from "@/lib/cafe-link";
import { mimeToExt } from "@/lib/audio-mime";

export interface RecordingSummary {
  id: number;
  targetSentence: string;
  createdAt: string;
  expiresAt: string;
  durationMs: number | null;
}

interface RecordingCardProps {
  interviewAnswerId: number;
  questionIndex: number;
  question: string;
  recommendedSentence: string;
  initialRecording: RecordingSummary | null;
}

function formatDuration(ms: number): string {
  const total = Math.floor(ms / 1000);
  const mm = Math.floor(total / 60).toString().padStart(2, "0");
  const ss = (total % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

function formatExpiry(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

export function RecordingCard({
  interviewAnswerId,
  questionIndex,
  question,
  recommendedSentence,
  initialRecording,
}: RecordingCardProps) {
  const { status, start, stop, reset, durationMs, blob, mimeType, error, isSupported } = useMediaRecorder();
  const [recording, setRecording] = useState<RecordingSummary | null>(initialRecording);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showShareHint, setShowShareHint] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
    };
  }, []);

  async function handleStart() {
    setUploadError(null);
    try {
      await start();
    } catch {
      // error is surfaced via hook
    }
  }

  async function handleStop() {
    const finalBlob = await stop();
    if (!finalBlob) return;
    await uploadBlob(finalBlob);
  }

  async function uploadBlob(b: Blob) {
    setUploading(true);
    setUploadError(null);
    try {
      const mt = mimeType ?? b.type ?? "audio/webm";
      let ext: string;
      try {
        ext = mimeToExt(mt);
      } catch {
        ext = "webm";
      }
      const form = new FormData();
      form.append("interviewAnswerId", String(interviewAnswerId));
      form.append("durationMs", String(durationMs));
      form.append("audio", new File([b], `recording.${ext}`, { type: mt }));

      const res = await fetch("/api/recording/upload", { method: "POST", body: form });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Upload failed (${res.status})`);
      }
      const data = await res.json() as RecordingSummary;
      setRecording(data);
      reset();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "업로드에 실패했어요.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete() {
    if (!recording) return;
    const confirmed = window.confirm("이 녹음을 삭제할까요?");
    if (!confirmed) return;
    const res = await fetch(`/api/recording/${recording.id}`, { method: "DELETE" });
    if (res.ok) {
      setRecording(null);
    }
  }

  function handleDownload() {
    if (!recording) return;
    window.location.href = `/api/recording/${recording.id}/file?download=1`;
  }

  function handleOpenCafe() {
    window.open(getCafeUrl(), "_blank", "noopener,noreferrer");
    setShowShareHint(true);
    if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
    hintTimerRef.current = setTimeout(() => setShowShareHint(false), 6000);
  }

  const isRecording = status === "recording";
  const isRequesting = status === "requesting";
  const mismatchWarning =
    recording && recording.targetSentence.trim() !== recommendedSentence.trim()
      ? recording.targetSentence
      : null;

  return (
    <div className="bg-near-black rounded-xl p-5 space-y-4">
      <div>
        <p className="text-[13px] text-muted-silver mb-1">Q{questionIndex + 1}. {question}</p>
      </div>

      <div className="bg-framer-blue/10 border border-framer-blue/30 rounded-lg p-4">
        <p className="text-[13px] text-framer-blue font-medium mb-1">녹음할 문장</p>
        <p className="text-[15px] text-white leading-[1.6]">{recommendedSentence}</p>
      </div>

      {!isSupported && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 text-[13px] text-yellow-300">
          이 브라우저에서는 녹음이 지원되지 않아요.
        </div>
      )}

      {isSupported && !recording && (
        <div>
          {!isRecording ? (
            <div className="flex gap-3 items-center">
              <Button onClick={handleStart} disabled={isRequesting || uploading}>
                {isRequesting ? "준비 중..." : uploading ? "업로드 중..." : "🔴 녹음 시작"}
              </Button>
              {error && <p className="text-[13px] text-red-400">{error.message}</p>}
            </div>
          ) : (
            <div className="flex gap-3 items-center">
              <Button variant="frosted" onClick={handleStop}>
                ⏹ 중지 ({formatDuration(durationMs)})
              </Button>
              <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            </div>
          )}
          {uploadError && <p className="text-[13px] text-red-400 mt-2">{uploadError}</p>}
        </div>
      )}

      {recording && (
        <div className="space-y-3">
          <audio
            ref={audioRef}
            controls
            src={`/api/recording/${recording.id}/file`}
            className="w-full"
          />
          {mismatchWarning && (
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 text-[12px] text-yellow-200 leading-[1.5]">
              이 녹음은 이전 추천 문장 (&quot;{mismatchWarning}&quot;) 으로 제작되었어요. 현재 추천 문장과 달라서 다시 녹음을 권장해요.
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button variant="frosted" onClick={handleStart} disabled={uploading}>
              다시 녹음
            </Button>
            <Button variant="ghost" onClick={handleDelete}>
              삭제
            </Button>
            <Button variant="frosted" onClick={handleDownload}>
              ⬇ 다운로드
            </Button>
            <Button onClick={handleOpenCafe}>
              📮 카페에 올리기
            </Button>
          </div>
          {showShareHint && (
            <p className="text-[12px] text-framer-blue leading-[1.5]">
              다운받은 녹음 파일을 카페 게시글에 첨부해주세요!
            </p>
          )}
          <p className="text-[12px] text-muted-silver">
            {formatExpiry(recording.expiresAt)} 에 자동 삭제됩니다.
          </p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 타입 체크**

Run: `pnpm tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 3: 커밋**

```bash
git add src/components/learning/recording-card.tsx
git commit -m "feat(ui): RecordingCard with record/play/download/cafe actions"
```

---

## Task 17: RecordingStudio 컴포넌트 (신규)

**Files:**
- Create: `src/components/learning/recording-studio.tsx`

- [ ] **Step 1: 컴포넌트 구현**

Create `src/components/learning/recording-studio.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLevel } from "@/contexts/level-context";
import { Button } from "@/components/ui/button";
import { RecordingCard, RecordingSummary } from "./recording-card";

interface RecordingStudioProps {
  contentId: string;
  onComplete: () => void;
  onSkip: () => void;
}

interface AnswerItem {
  id: number;
  questionIndex: number;
  question: string;
  recommendedSentence: string;
  latestRecording: RecordingSummary | null;
}

export function RecordingStudio({ contentId, onComplete, onSkip }: RecordingStudioProps) {
  const { level, ready } = useLevel();
  const router = useRouter();
  const [answers, setAnswers] = useState<AnswerItem[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !level) return;
    let cancelled = false;
    setLoadError(null);
    fetch(`/api/interview-answer?contentId=${contentId}&level=${level}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`Failed (${r.status})`);
        return r.json() as Promise<{ answers: AnswerItem[] }>;
      })
      .then((data) => {
        if (!cancelled) setAnswers(data.answers);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err.message ?? "불러오기 실패");
      });
    return () => {
      cancelled = true;
    };
  }, [contentId, level, ready]);

  if (!ready || answers === null) {
    return (
      <div className="text-muted-silver">
        {loadError ? `오류: ${loadError}` : "불러오는 중..."}
      </div>
    );
  }

  if (answers.length === 0) {
    return (
      <div className="space-y-4">
        <div className="bg-near-black rounded-xl p-5 text-[14px] text-white/80 leading-[1.6]">
          아직 답변한 질문이 없어요. 인터뷰로 돌아가서 답변하면 여기서 녹음할 수 있어요.
        </div>
        <div className="flex gap-3">
          <Button variant="frosted" onClick={() => router.push(`/learn/${contentId}/interview`)}>
            인터뷰로 돌아가기
          </Button>
          <Button variant="ghost" onClick={onSkip}>
            이 스텝 건너뛰기
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        {answers.map((a) => (
          <RecordingCard
            key={a.id}
            interviewAnswerId={a.id}
            questionIndex={a.questionIndex}
            question={a.question}
            recommendedSentence={a.recommendedSentence}
            initialRecording={a.latestRecording}
          />
        ))}
      </div>

      <div className="flex gap-3">
        <Button onClick={onComplete}>스텝 완료</Button>
        <Button variant="ghost" onClick={onSkip}>이 스텝 건너뛰기</Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 타입 체크**

Run: `pnpm tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 3: 커밋**

```bash
git add src/components/learning/recording-studio.tsx
git commit -m "feat(ui): RecordingStudio lists answers + completion actions"
```

---

## Task 18: Speaking 페이지 RecordingStudio 사용으로 교체

**Files:**
- Modify: `src/app/(main)/learn/[contentId]/speaking/page.tsx`

- [ ] **Step 1: 페이지 교체**

Edit `src/app/(main)/learn/[contentId]/speaking/page.tsx` — 전체를 다음으로 교체:
```tsx
"use client";

import { useParams, useRouter } from "next/navigation";
import { RecordingStudio } from "@/components/learning/recording-studio";

export default function SpeakingPage() {
  const params = useParams();
  const router = useRouter();
  const contentId = params.contentId as string;

  async function handleComplete() {
    await fetch(`/api/progress/${contentId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: "speaking" }),
    }).catch(() => undefined);
    router.push(`/learn/${contentId}/complete`);
  }

  async function handleSkip() {
    await fetch(`/api/progress/${contentId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: "speaking", skipped: true }),
    }).catch(() => undefined);
    router.push(`/learn/${contentId}/complete`);
  }

  return (
    <div className="max-w-[800px] mx-auto px-6 py-12">
      <span className="text-[12px] font-semibold text-framer-blue tracking-[2px] uppercase">
        Step 6 · Recording
      </span>
      <h2 className="text-[32px] font-semibold tracking-[-1px] leading-[1.13] mt-2 mb-8">
        녹음하기
      </h2>

      <RecordingStudio
        contentId={contentId}
        onComplete={handleComplete}
        onSkip={handleSkip}
      />
    </div>
  );
}
```

⚠️ 참고: 기존 코드는 `/api/progress` 호출을 `onComplete` 에 명시하지 않았을 수도 있음. Task 8/Task 18 수동 검증 단계에서 완료 버튼 눌렀을 때 progress row 가 생성되는지 DB 로 확인할 것.

- [ ] **Step 2: 타입 체크**

Run: `pnpm tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 3: 커밋**

```bash
git add src/app/\(main\)/learn/\[contentId\]/speaking/page.tsx
git commit -m "feat(speaking): replace SpeakingRecorder with RecordingStudio"
```

---

## Task 19: SpeechContext 리팩토링 (STT 제거)

**Files:**
- Modify: `src/contexts/speech-context.tsx`

- [ ] **Step 1: 현재 SpeechContext 확인**

Run: `grep -nE "sttAvailable|SpeechRecognition" src/contexts/speech-context.tsx`
(에디터 환경에서는 Grep 툴 사용)

예상 내용: TTS + STT 두 가지 감지.

- [ ] **Step 2: STT 감지 코드 제거**

Edit `src/contexts/speech-context.tsx` — TTS (SpeechSynthesis) 감지만 남기고 STT 관련 state/감지 로직·`sttAvailable` export 제거. 컨텍스트 shape 예:
```tsx
"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

interface SpeechContextValue {
  ttsAvailable: boolean;
  ready: boolean;
}

const SpeechContext = createContext<SpeechContextValue>({ ttsAvailable: false, ready: false });

export function SpeechProvider({ children }: { children: ReactNode }) {
  const [ttsAvailable, setTtsAvailable] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setTtsAvailable(typeof window.speechSynthesis !== "undefined");
    setReady(true);
  }, []);

  return (
    <SpeechContext.Provider value={{ ttsAvailable, ready }}>
      {children}
    </SpeechContext.Provider>
  );
}

export function useSpeech() {
  return useContext(SpeechContext);
}
```

(실제 현재 파일을 읽어서 추가 속성이 있으면 유지하면서 STT 만 제거)

- [ ] **Step 3: STT 사용처 확인**

Run: `grep -rnE "sttAvailable|SpeechRecognition|webkitSpeechRecognition" src`
Expected: Task 20 에서 삭제할 `speaking-recorder.tsx` 외에는 나오지 않아야 함. 다른 파일에서 사용 중이면 그 파일도 정리해야 함.

- [ ] **Step 4: 타입 체크**

Run: `pnpm tsc --noEmit`
Expected: `speaking-recorder.tsx` 내부의 `sttAvailable` 참조가 에러로 나올 수 있음 → 다음 task 에서 해당 파일 삭제하면 해결.

- [ ] **Step 5: 커밋 (다음 task 와 함께)**

이 task 는 단독 커밋하지 말고 Task 20 과 함께 커밋 (빌드가 깨지는 중간 상태이므로).

---

## Task 20: 구 SpeakingRecorder 및 string-similarity 제거

**Files:**
- Delete: `src/components/learning/speaking-recorder.tsx`
- Delete: `src/lib/string-similarity.ts`

- [ ] **Step 1: string-similarity 사용처 최종 확인**

Run: `grep -rnE "string-similarity|similarityPercent|levenshteinDistance" src`
Expected: 오직 `speaking-recorder.tsx` 와 `string-similarity.ts` 자신만.

- [ ] **Step 2: 파일 삭제**

Run:
```bash
cd /var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines
rm src/components/learning/speaking-recorder.tsx src/lib/string-similarity.ts
```

- [ ] **Step 3: 타입 체크**

Run: `pnpm tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 4: 커밋 (Task 19 포함)**

```bash
git add -A src/contexts/speech-context.tsx src/components/learning/speaking-recorder.tsx src/lib/string-similarity.ts
git commit -m "refactor: remove STT-based SpeakingRecorder and similarity utility"
```

(삭제된 파일도 `git add -A` 로 스테이징됨)

---

## Task 21: 빌드 + 린트 확인

- [ ] **Step 1: 린트**

Run: `pnpm lint`
Expected: 에러 없음. (경고는 허용)

- [ ] **Step 2: 테스트 전체 실행**

Run: `pnpm test`
Expected: 모든 테스트 통과 (mimeToExt, pickCafeUrl, buildInterviewAnswerUniqueKey).

- [ ] **Step 3: 프로덕션 빌드**

Run: `pnpm build`
Expected: 성공. 빌드 로그에서 `/api/recording/*`, `/api/interview-answer`, `/api/cron/cleanup-recordings` 라우트가 모두 나열되어야 함.

- [ ] **Step 4: 빌드 에러 발생 시**

타입 에러나 Next.js 호환 이슈가 나오면 해당 task 로 돌아가서 수정. 커밋하지 말고 해결 후 진행.

---

## Task 22: 환경 변수 및 크론 등록

**Files:**
- Modify: `.env.local` (서버에서 직접)
- Modify: crontab (서버에서 직접)

⚠️ 이 task 는 코드 변경이 아니라 서버 인프라 설정.

- [ ] **Step 1: CLEANUP_CRON_SECRET 생성**

Run:
```bash
openssl rand -hex 32
```
Expected: 64자 hex 문자열. 이 값을 `<SECRET>` 으로 사용.

- [ ] **Step 2: .env.local 에 추가**

Edit `/var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines/.env.local` — 파일 끝에 추가:
```
CLEANUP_CRON_SECRET="<SECRET>"
```

- [ ] **Step 3: PM2 재기동으로 env 반영**

Run:
```bash
pm2 restart routines --update-env
```
Expected: `online` 상태.

- [ ] **Step 4: 엔드포인트 수동 호출로 검증**

Run:
```bash
curl -s -X POST \
  -H "Authorization: Bearer <SECRET>" \
  https://routines.soritune.com/api/cron/cleanup-recordings
```
Expected: `{"deletedCount":0,"fileDeleteFailures":0,"elapsedMs":...}`.

잘못된 시크릿으로 호출하면 401:
```bash
curl -s -X POST -H "Authorization: Bearer WRONG" https://routines.soritune.com/api/cron/cleanup-recordings
```
Expected: `{"error":"Unauthorized"}`.

- [ ] **Step 5: /root/.routines-cron-env 업데이트**

Edit `/root/.routines-cron-env` — 기존 env 에 추가 (파일이 없거나 포맷이 다르면 확인 필요):
```
CLEANUP_CRON_SECRET=<SECRET>
```

- [ ] **Step 6: crontab 에 정리 잡 등록**

Run: `crontab -e` (root 사용자).

추가 라인:
```
0 4 * * * . /root/.routines-cron-env && curl -sS -X POST -H "Authorization: Bearer $CLEANUP_CRON_SECRET" https://routines.soritune.com/api/cron/cleanup-recordings >> /var/log/routines-cleanup.log 2>&1
```

- [ ] **Step 7: 로그 파일 준비**

Run:
```bash
touch /var/log/routines-cleanup.log && chmod 644 /var/log/routines-cleanup.log
```

- [ ] **Step 8: 크론 라인 테스트 (즉시 실행 검증)**

Run (크론 줄을 셸에서 그대로 실행):
```bash
. /root/.routines-cron-env && curl -sS -X POST -H "Authorization: Bearer $CLEANUP_CRON_SECRET" https://routines.soritune.com/api/cron/cleanup-recordings
```
Expected: 성공 JSON 반환.

---

## Task 23: uploads 디렉토리 생성 + SELinux 컨텍스트

⚠️ 서버 인프라 설정.

- [ ] **Step 1: 디렉토리 생성 + 소유권**

Run:
```bash
mkdir -p /var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines/uploads/recordings
chown -R $(stat -c '%U:%G' /var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines/prisma) \
      /var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines/uploads
```

- [ ] **Step 2: SELinux 쓰기 컨텍스트 (메모리 feedback 참조)**

참고: 메모리 `feedback_selinux_upload.md` 에 따라 PHP/Node 런타임이 파일 쓰기를 하려면 `httpd_sys_rw_content_t` 필요.

Run:
```bash
chcon -R -t httpd_sys_rw_content_t /var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines/uploads
# 영구 적용
semanage fcontext -a -t httpd_sys_rw_content_t "/var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines/uploads(/.*)?"
restorecon -Rv /var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines/uploads
```

- [ ] **Step 3: PM2 실행 user 확인**

Run: `pm2 jlist | grep -oE '"user":"[^"]+"' | head -1`
Expected: 예) `"user":"root"`. 값을 `PM2_USER` 로 사용.

- [ ] **Step 4: 쓰기 권한 확인**

Run:
```bash
sudo -u "$PM2_USER" touch /var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines/uploads/recordings/.probe \
  && sudo -u "$PM2_USER" rm /var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines/uploads/recordings/.probe
```
Expected: 에러 없음. (root 가 PM2 를 실행 중이면 sudo 없이 직접 실행해도 됨.)

---

## Task 24: 전체 플로우 스모크 테스트

- [ ] **Step 1: 빌드 + 재기동**

Run:
```bash
cd /var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines
pnpm build
pm2 restart routines --update-env
pm2 logs routines --lines 30
```
Expected: `Ready in ...` 로그, 에러 없음.

- [ ] **Step 2: 브라우저 테스트 (PC)**

`https://routines.soritune.com/` 로그인 → 오늘의 콘텐츠 → Step 5 Interview.
- 질문 1건 답변 제출 → 한국어 피드백 표시, 영어 예시는 `"...."` 형태로 보존, `🎤 녹음할 추천 문장` 섹션 보임.
- 질문 2건째에서 "이 질문 건너뛰기" → DB 에 해당 row 없음을 확인.
- 모든 질문 완료 → "녹음하러 가기" 클릭 → Speaking 페이지 이동.

Speaking 페이지:
- 답변한 질문만 카드로 보임.
- "🔴 녹음 시작" → 마이크 권한 허용 → 3~5초 말하고 ⏹ 중지.
- 카드 하단에 `<audio controls>` 표시 + "다운로드" / "카페에 올리기" / "다시 녹음" / "삭제" 버튼.
- ▶ 재생 OK.
- 다운로드 클릭 → `soritune-{contentId}-q{idx}-{YYYYMMDD}.webm` 파일 저장.
- "카페에 올리기" 클릭 → 새 탭에서 `https://cafe.naver.com/f-e/cafes/23243775/menus/1` 열림 + 안내 문구 표시.
- "다시 녹음" 으로 재녹음 → 기존 파일이 디스크에서 사라지고 새 파일만 남는지 확인:
  ```bash
  ls /var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines/uploads/recordings/<userId>/
  ```
- "스텝 완료" → `/complete` 이동 + `user_progress` 테이블에 `step=speaking, completed=true` row 확인.

- [ ] **Step 3: 브라우저 테스트 (모바일)**

실제 iPhone/Android (또는 DevTools 모바일 에뮬레이션) 에서:
- 카페 링크 클릭 시 `https://m.cafe.naver.com/ca-fe/web/cafes/23243775/menus/1` 로 이동하는지 확인.
- MediaRecorder 동작 (Safari 는 audio/mp4 가 될 수 있음) → 업로드 파일이 `.mp4` 확장자로 저장되는지 DB 확인:
  ```bash
  mysql -u root SORITUNECOM_ROUTINES -e "SELECT id, file_ext, mime_type FROM recordings ORDER BY id DESC LIMIT 5;"
  ```

- [ ] **Step 4: 크론 만료 테스트 (수동)**

DB 에서 한 Recording 의 `expires_at` 을 과거로 당긴 뒤 크론 호출:
```bash
mysql -u root SORITUNECOM_ROUTINES -e "UPDATE recordings SET expires_at = NOW() - INTERVAL 1 HOUR WHERE id = <test_id>;"
. /root/.routines-cron-env && curl -sS -X POST -H "Authorization: Bearer $CLEANUP_CRON_SECRET" https://routines.soritune.com/api/cron/cleanup-recordings
```
Expected: `{"deletedCount":1,...}`. 파일이 디스크에서 사라지고 DB row 도 삭제된 것을 확인.

- [ ] **Step 5: 완료**

모든 체크 통과 시:
```bash
git log --oneline main ^origin/main
```
Expected: 이번 작업 커밋들이 쭉 나열. push 할지 여부는 사용자에게 확인.

---

## Spec 커버리지 체크

| Spec 항목 | 구현 Task |
|-----------|-----------|
| 1.2 시스템 프롬프트 한글화 | Task 7 |
| 1.3 응답 스키마 (5필드) | Task 7 |
| 1.4 Graceful degrade | Task 7 (answer fallback) |
| 2.1 InterviewAnswer 모델 | Task 6 |
| 2.1 Recording 모델 | Task 6 |
| 2.2 User/Content 역관계 | Task 6 |
| 2.3 마이그레이션 | Task 6 |
| 2.4 디스크 레이아웃 | Task 5 |
| 2.5 `mimeToExt()` | Task 2 |
| 3.1 Interview API 수정 | Task 8 |
| 3.2 Recording upload | Task 10 |
| 3.3 Recording file serve | Task 11 |
| 3.4 Interview-answer listing | Task 9 |
| 3.5 Recording delete | Task 12 |
| 3.6 Cleanup cron | Task 13 |
| 4.1 InterviewChat 수정 | Task 15 |
| 4.2 RecordingStudio | Task 17 |
| 4.3 useMediaRecorder | Task 14 |
| 4.4 cafe-link | Task 3 |
| 4.5 SpeechContext 리팩토링 | Task 19 |
| 4.6 string-similarity 삭제 | Task 20 |
| 5 진도/스트릭 (스킵 정책) | Task 15/18 (서버 미기록) |
| 6 환경 변수 | Task 22 |
| 7.1 수동 검증 | Task 24 |
| 7.2 자동 테스트 | Task 2/3/4 |
| 8 롤아웃 | Task 21/22/23/24 |

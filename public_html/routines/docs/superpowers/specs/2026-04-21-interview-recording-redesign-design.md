# 인터뷰/녹음 기능 재설계 — 설계 문서

- 작성일: 2026-04-21
- 프로젝트: routines.soritune.com
- 스택: Next.js (App Router) + NextAuth.js + Prisma + pnpm

## 배경

현재 routines 의 학습 플로우(6단계) 중 **Step 5 Interview** 와 **Step 6 Speaking** 은 다음과 같이 동작한다.

- Interview: Claude/OpenAI 기반 텍스트 Q&A. 4개 필드 피드백(relevance, grammar, nativeExpression, encouragement)을 반환하나, `encouragement` 외 3개는 영어라 영어 초보 학습자가 이해하기 어려움.
- Speaking: 브라우저 Web Speech API(SpeechRecognition)로 지정 문장을 발음하게 하고 Levenshtein 거리로 점수를 매김. 오디오 파일은 남지 않음.

## 목표

1. **인터뷰 피드백을 한국어로** 제공하되, 영어 표현/예시는 영어 그대로 보존.
2. **녹음 기능의 목적 변경**: 발음 점수화 → 인터뷰에서 AI 가 제안한 추천 문장(사용자 답변을 다듬은 버전)을 사용자가 녹음.
3. 녹음 완료 후 **재생 / 다운로드 / 소리튠영어 네이버 카페 이동** 세 기능 제공.

## 비목표 (Out of Scope)

- Whisper / Google STT 연동 (발음 자동 평가 재구현 안 함).
- "내 녹음 보관함" 같은 글로벌 녹음 갤러리 페이지.
- 네이버 카페 API 연동 업로드 (사용자가 파일 다운로드 후 수동 첨부).
- InterviewAnswer 레벨 TTL / 프라이버시 대시보드.

## 핵심 결정

| 항목 | 결정 |
|------|------|
| 녹음 대상 | AI 가 반환하는 단일 `recommendedSentence` (영어, 권장 25단어 이내, 여러 문장 허용) |
| Interview ↔ Speaking 연결 | Interview 응답을 서버 DB 에 저장, Speaking 에서 읽어옴 |
| 녹음 파일 저장 | 서버 파일시스템, TTL 7일, 매일 새벽 4시 크론 일괄 삭제 |
| 재녹음 정책 | **한 InterviewAnswer 당 Recording 1개 유지.** 재녹음 시 이전 파일·row 즉시 삭제 후 새로 생성. "삭제" 버튼은 해당 질문의 녹음 1건을 제거. |
| 인증 | 기존 NextAuth 세션 기반 (`requireAuth()`) |
| InterviewAnswer 보관 | 영구 보관 (YAGNI, 추후 필요 시 TTL 추가) |
| 스킵 정책 | 인터뷰 질문별 스킵 가능, 녹음 카드별 스킵 가능, 부분 완료 허용 |
| 네이버 카페 링크 | 클라이언트 UA 로 PC/모바일 분기, 새 탭으로 이동 + 안내 토스트 |

---

## 1. AI 피드백 스키마 변경

### 1.1 파일
- `src/lib/ai-service.ts` — 시스템 프롬프트 + 호출 시그니처
- `src/app/api/ai/interview/route.ts` — 요청/응답 스키마 + DB 저장

### 1.2 시스템 프롬프트 (개정)

핵심 지시사항:
- 모든 설명(`relevance`, `grammar`, `nativeExpression`)은 **한국어** 로 작성한다.
- 단, 영어 표현·예시·단어는 **영어 그대로** 보존하며 이중따옴표로 감싼다. 예: `"I went to the cafe"`
- `encouragement` 는 기존처럼 한국어.
- `recommendedSentence` 는 사용자 답변의 의도를 반영한 자연스러운 영어 표현. 녹음 연습에 적합하도록 **권장 25단어 이내, 필요시 여러 문장 허용**. 순수 영어(따옴표 없이).
- 응답은 순수 JSON (마크다운 코드블록 금지).

### 1.3 응답 스키마

```json
{
  "relevance": "한국어 설명 (영어 예시는 \"like this\")",
  "grammar": "한국어 설명 (예: 과거 시제는 \"went\"로)",
  "nativeExpression": "한국어 설명 (예: \"hang out\" 이 자연스러움)",
  "encouragement": "한국어 격려",
  "recommendedSentence": "I went to the cafe and studied English for two hours."
}
```

### 1.4 Graceful Degrade
- AI 가 `recommendedSentence` 를 누락하면 서버에서 `userAnswer` 를 fallback 으로 사용 (500 대신).
- Claude / OpenAI 양측 모두 동일 프롬프트로 동작하도록 테스트.

---

## 2. Prisma 스키마

### 2.1 신규 모델

```prisma
model InterviewAnswer {
  id                   Int       @id @default(autoincrement())
  userId               String    @db.VarChar(36)
  contentId            Int
  questionIndex        Int
  level                ContentLevel
  question             String    @db.Text
  userAnswer           String    @db.Text
  recommendedSentence  String    @db.Text
  feedback             Json
  createdAt            DateTime  @default(now())
  updatedAt            DateTime  @updatedAt

  user       User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  content    Content     @relation(fields: [contentId], references: [id], onDelete: Cascade)
  recordings Recording[]

  @@unique([userId, contentId, level, questionIndex])
  @@index([userId, contentId, level])
}

model Recording {
  id                 Int      @id @default(autoincrement())
  userId             String   @db.VarChar(36)
  interviewAnswerId  Int
  targetSentence     String   @db.Text  // 녹음 시점의 recommendedSentence 스냅샷 — 인터뷰 재답변 시 디스플레이 mismatch 방지
  filePath           String   // 실제 저장된 파일 상대 경로 (실제 포맷의 확장자 포함)
  fileExt            String   // "webm" | "ogg" | "mp4" — MIME 에서 파생, 확장자/파일명 생성에 사용
  mimeType           String
  sizeBytes          Int
  durationMs         Int?
  createdAt          DateTime @default(now())
  expiresAt          DateTime

  user            User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  interviewAnswer InterviewAnswer  @relation(fields: [interviewAnswerId], references: [id], onDelete: Cascade)

  @@index([userId, interviewAnswerId])
  @@index([expiresAt])
}
```

### 2.2 기존 모델 영향
- `User` / `Content` 에 `@relation` 역방향 추가 (`interviewAnswers InterviewAnswer[]`, `recordings Recording[]`).
- `LearningStep` enum 변경 없음 (speaking 유지, 의미만 바뀜).
- `UserProgress.score` 는 이제 nullable 로 사용 (녹음은 점수 산정 안 함). 스키마상 이미 `Int?`.

### 2.3 마이그레이션
- 명령: `pnpm prisma migrate dev --name add_interview_answer_and_recording`
- 영향: 신규 테이블 2개 추가, 기존 데이터 손실 없음.

### 2.4 디스크 레이아웃
```
<repo root>/uploads/recordings/{userId}/{recordingId}.{fileExt}
```
- 확장자는 업로드 MIME 에서 파생 (`audio/webm;*` → `webm`, `audio/ogg` → `ogg`, `audio/mp4` → `mp4`). `Recording.fileExt` 컬럼에도 동일 값 저장.
- public 폴더 밖 → 정적 접근 불가.
- 서빙은 인증 거친 API 라우트를 통해서만 (`GET /api/recording/[id]/file`).

### 2.5 MIME ↔ 확장자 매핑 함수
`src/lib/audio-mime.ts` (신규) 에 순수 함수로 분리 (단위 테스트 대상).

```ts
export function mimeToExt(mime: string): "webm" | "ogg" | "mp4" {
  const m = mime.toLowerCase();
  if (m.startsWith("audio/webm")) return "webm";
  if (m.startsWith("audio/ogg"))  return "ogg";
  if (m.startsWith("audio/mp4") || m.startsWith("audio/mpeg")) return "mp4";
  throw new Error(`Unsupported audio MIME: ${mime}`);
}
```

---

## 3. API 엔드포인트

모든 엔드포인트는 `src/lib/auth-helpers.ts` 의 `requireAuth()` 를 사용해 세션 검증한다.

### 3.1 `POST /api/ai/interview` (기존 수정)

**요청**
```ts
{ contentId: number, questionIndex: number, question: string, answer: string, level: ContentLevel }
```

**처리**
1. `requireAuth()` → `userId` 획득.
2. AI 호출 (`claudeInterview` / `openaiInterview`) → 5개 필드 JSON 파싱.
3. `recommendedSentence` 누락 시 `answer` 로 fallback.
4. `prisma.interviewAnswer.upsert({ where: { userId_contentId_level_questionIndex: { userId, contentId, level, questionIndex } }, ... })` — Prisma 가 `@@unique([userId, contentId, level, questionIndex])` 로부터 생성하는 composite key 이름 사용.
5. 응답 반환.

**응답**
```ts
{ feedback: { relevance, grammar, nativeExpression, encouragement }, recommendedSentence: string }
```

### 3.2 `POST /api/recording/upload` (신규)

**입력**: `multipart/form-data`
- `interviewAnswerId: number`
- `audio: File` (audio/webm, audio/ogg, audio/mp4 허용)
- `durationMs?: number`

**제약**
- 파일 크기 최대 **10 MiB**.
- `InterviewAnswer.userId` 가 세션 userId 와 일치해야 함.

**처리** (재녹음 안전성을 위해 선-파일저장 → 후-기존삭제 순서)
1. `requireAuth()` + `InterviewAnswer` 조회 + 소유권 검증. 현재 `recommendedSentence` 를 `targetSentence` 스냅샷으로 사용.
2. 업로드 파일 MIME 을 `mimeToExt()` 로 확장자 결정 (지원하지 않으면 400).
3. 새 파일을 임시 경로 `uploads/recordings/{userId}/.tmp-{randomId}.{fileExt}` 에 저장.
4. Prisma 트랜잭션:
   - (a) 기존 Recording row 조회 (나중에 파일 삭제할 경로들 확보).
   - (b) 기존 row 들 삭제.
   - (c) 새 Recording row 생성 (`expiresAt = now + 7일`, `targetSentence`, `fileExt`, `mimeType`, `filePath` 포함).
5. 임시 파일을 최종 경로 `uploads/recordings/{userId}/{newRecordingId}.{fileExt}` 로 rename.
6. (트랜잭션 밖) 기존 파일들 `fs.unlink` — 실패는 로그만, 크론이 최종 정리.
7. 임의 단계에서 실패 시:
   - 3 실패: 400/500 반환, 기존 데이터 무사.
   - 4 실패: 임시 파일 unlink, 기존 데이터 무사.
   - 5 실패: 트랜잭션을 되돌릴 수 없으므로 새 row 의 `filePath` 를 임시 경로로 유지 → 다음 요청 시 덮어쓰기 안 됨. 드물지만 크론이 expire 후 정리. 로그 경고.

**응답**
```ts
{ id: number, createdAt: string, expiresAt: string, durationMs: number | null }
```

### 3.3 `GET /api/recording/[id]/file` (신규)

**쿼리**: `?download=1` (선택)

**처리**
1. `requireAuth()`.
2. `Recording` 조회 + `userId` 소유권 검증.
3. `expiresAt < now` 면 **404 만 반환** (실제 정리는 크론이 담당 — Next route handler 의 fire-and-forget 은 프로세스 생명주기 보장이 약함).
4. 파일 스트림 응답.
5. 헤더:
   - `Content-Type`: `Recording.mimeType`
   - `Content-Length`: `Recording.sizeBytes`
   - `Content-Disposition`:
     - 기본: `inline`
     - `?download=1`: `attachment; filename="soritune-{contentId}-q{idx}-{YYYYMMDD}.{Recording.fileExt}"` — 실제 포맷과 확장자 일치 보장

### 3.4 `GET /api/interview-answer?contentId={id}&level={level}` (신규)

**처리**
1. `requireAuth()`.
2. 해당 사용자의 `(contentId, level)` 조합 InterviewAnswer 전체 + 각 최신 Recording 1개 조회.

**응답**
```ts
{
  answers: Array<{
    id: number,
    questionIndex: number,
    question: string,
    recommendedSentence: string,
    latestRecording: { id: number, targetSentence: string, createdAt: string, expiresAt: string, durationMs: number | null } | null
  }>
}
```

### 3.5 `DELETE /api/recording/[id]` (신규)

**의미**: 해당 질문의 녹음 1건 (유일한 녹음) 을 완전히 제거. 재녹음 정책상 한 답변당 Recording 은 1개이므로 "이 질문의 녹음 삭제" 와 동의어.

**처리**
1. `requireAuth()` + 소유권 검증.
2. 파일 삭제 (try/catch, 실패해도 DB 는 삭제 — 고아 파일은 크론이 처리).
3. Prisma row 삭제.

**응답**: `{ ok: true }`

### 3.6 `POST /api/cron/cleanup-recordings` (신규)

**인증**: `Authorization: Bearer $CLEANUP_CRON_SECRET`
- 신규 env 변수 `CLEANUP_CRON_SECRET` 추가 (기존 `GENERATION_CRON_SECRET` 과 분리).

**처리**
1. `expiresAt < now` 인 Recording 조회.
2. 각 파일 `fs.unlink` (실패는 로그 후 계속).
3. `prisma.recording.deleteMany({ where: { id: { in: expiredIds } } })`.

**응답**
```ts
{ deletedCount: number, fileDeleteFailures: number, elapsedMs: number }
```

**스케줄** (crontab):
```
0 4 * * * curl -X POST -H "Authorization: Bearer $CLEANUP_CRON_SECRET" https://routines.soritune.com/api/cron/cleanup-recordings >> /var/log/routines-cleanup.log 2>&1
```

---

## 4. UI / 컴포넌트

### 4.1 `src/components/learning/interview-chat.tsx` (수정)

- `Feedback` 타입 확장: `recommendedSentence: string` 추가.
- `/api/ai/interview` 호출 시 바디에 `questionIndex`, `level` 포함.
- 피드백 렌더링에 **"🎤 녹음할 추천 문장"** 섹션을 별도 강조(배경색·보더)로 표시.
- 질문 스킵 버튼 추가 (UI 이동만, API 호출 없음).
- 모든 질문 완료 시 CTA: "다음: 녹음하기" → `/learn/{contentId}/speaking` 이동.

### 4.2 `src/components/learning/recording-studio.tsx` (신규, `speaking-recorder.tsx` 대체)

- 파일명 리네임: `speaking-recorder.tsx` → `recording-studio.tsx` (의미 변경 반영).
- 마운트 시 `GET /api/interview-answer?contentId&level` 호출.
- InterviewAnswer 0개: "아직 답변한 질문이 없어요. 인터뷰로 돌아가서 답변하거나 이 스텝을 스킵할 수 있어요." + [인터뷰로] [스킵] 버튼.
- InterviewAnswer ≥ 1: 카드 리스트 렌더.

**카드 상태 머신**
```
idle (녹음 없음)
  ↓ [녹음 시작]
recording
  ↓ [중지]
uploading (API 호출 중)
  ↓ 성공
done
  ↓ [다시 녹음] → idle
  ↓ [삭제] → idle (DELETE 호출)
```

**카드 구성 요소**
- 질문 (영어, 회색)
- 녹음할 문장 (영어, 하이라이트) — 현재 `InterviewAnswer.recommendedSentence`
- 녹음 컨트롤: [🔴 녹음 시작] / [⏹ 중지 00:23] / [▶ 재생] [다시 녹음] [삭제]
- 완료 상태 액션 2개: **[⬇ 다운로드]**, **[📮 카페에 올리기]**
- 만료 안내: "7일 후 자동 삭제 (YYYY-MM-DD)"
- 재답변으로 `recommendedSentence` 가 바뀌었는데 이전 녹음의 `targetSentence` 가 다르면 작은 경고 문구 표시: "이 녹음은 이전 추천 문장(\"...\")으로 제작되었습니다. 다시 녹음을 권장합니다."

**하단 전체 액션**
- [스텝 완료] — 녹음 개수와 무관하게 항상 활성. 누르면 `POST /api/progress/[contentId]` (`step: "speaking"`) → `/learn/{id}/complete` 이동.
- [스텝 스킵] — 녹음 없이 완료 처리 (`skipped: true`).

### 4.3 `src/hooks/use-media-recorder.ts` (신규)

MediaRecorder 추상화 훅.

```ts
export function useMediaRecorder(): {
  status: "idle" | "requesting" | "recording" | "stopped" | "error",
  start: () => Promise<void>,
  stop: () => Promise<Blob>,
  reset: () => void,
  durationMs: number,
  error: Error | null,
}
```

- MIME 우선순위: `audio/webm;codecs=opus` → `audio/webm` → `audio/mp4`.
- 권한 거부 시 `error` 설정 + `status: "error"`.
- 언마운트 시 스트림 트랙 정리.

### 4.4 `src/lib/cafe-link.ts` (신규)

```ts
const CAFE_URL_PC = "https://cafe.naver.com/f-e/cafes/23243775/menus/1";
const CAFE_URL_MOBILE = "https://m.cafe.naver.com/ca-fe/web/cafes/23243775/menus/1";

export function getCafeUrl(): string {
  if (typeof window === "undefined") return CAFE_URL_PC;
  const ua = navigator.userAgent;
  const isMobile = /mobile|android|iphone|ipad|ipod/i.test(ua);
  return isMobile ? CAFE_URL_MOBILE : CAFE_URL_PC;
}
```

버튼 클릭 핸들러:
```ts
window.open(getCafeUrl(), "_blank", "noopener,noreferrer");
toast.info("다운받은 녹음 파일을 카페 게시글에 첨부해주세요!");
```

### 4.5 `src/contexts/speech-context.tsx` (리팩토링)

- 현재: TTS (SpeechSynthesis) + STT (SpeechRecognition) 둘 다 감지.
- 변경: STT 감지 제거 (리스닝/인터뷰에서 사용 안 함). TTS 감지만 유지.
- `speaking-recorder.tsx` 삭제와 함께 STT 관련 상태·검사 코드 제거.

### 4.6 `src/lib/string-similarity.ts` (삭제)

- Levenshtein 거리로 발음 점수 계산에만 사용됨.
- 다른 참조 없으면 파일 삭제.

---

## 5. 진도 & 스트릭 시스템

- `UserProgress.score` 는 녹음 스텝에서 전송하지 않음 (DB 에선 `null`).
- 스킵 시 `skipped: true, completed: false` → 기존 로직대로 스트릭 카운트에 포함.
- 일부만 녹음한 경우에도 "스텝 완료" 가능 (사용자 선택).
- **질문별 스킵은 서버에 기록하지 않음**. "미응답" = "의도적 스킵" = InterviewAnswer row 없음.
  - 근거: 콘텐츠의 `interview` 배열은 `ContentVariant` 에 고정되어 있어 질문 셋이 사후 변경되지 않음. 따라서 "없음 = 아직 안 함" 으로 해석 가능.
  - 향후 두 상태 구분이 필요해지면 `AnalyticsEvent` 에 `type: "interview_skip"` 이벤트 추가로 해결 (테이블 변경 없이).

---

## 6. 환경 변수 변경

| 변수 | 상태 | 설명 |
|------|------|------|
| `CLEANUP_CRON_SECRET` | **신규** | 녹음 파일 정리 크론 인증용 |
| `GENERATION_CRON_SECRET` | 유지 | 기존 콘텐츠 생성 크론용 |

`.env.local` 및 PM2 `ecosystem.config.js` 반영.

---

## 7. 검증 계획

### 7.1 수동 검증
- [ ] 인터뷰 답변 시 한국어 피드백이 정상 렌더링되고, 영어 예시는 따옴표로 구분되어 남는다.
- [ ] `recommendedSentence` 가 녹음할 문장 섹션에 표시된다.
- [ ] `/api/ai/interview` 응답 후 DB 의 `InterviewAnswer` 테이블에 row 가 upsert 된다.
- [ ] Speaking 페이지에서 마이크 권한 허용 → 녹음 → 중지 → 업로드 성공 → 카드 상태 `done`.
- [ ] 업로드된 파일을 재생 / 다운로드 / 카페 이동 버튼 각각 정상 동작.
- [ ] PC / 모바일 UA 로 카페 URL 분기 확인.
- [ ] 재녹음 시 새 Recording row 생성, UI 는 최신 1개만 노출.
- [ ] 삭제 버튼 클릭 시 파일·row 모두 사라지고 카드 상태 `idle`.
- [ ] 인터뷰·녹음 모두 일부만 완료하고 "스텝 완료" 눌러도 다음 단계로 진행.
- [ ] 인터뷰 0개 답변한 상태에서 Speaking 진입 → 안내 메시지 + 스킵 버튼 노출.
- [ ] 크론 엔드포인트 수동 호출 시 7일 지난 파일이 모두 삭제된다.

### 7.2 자동화 (가벼운 단위 테스트)
파일럿 단계이지만 **브라우저 포맷·키 구성처럼 조용히 깨지기 쉬운 로직**은 최소한의 단위 테스트를 추가한다. 테스트 러너는 `vitest` (Next.js 호환) 또는 `node:test`.

- `src/lib/audio-mime.test.ts` — `mimeToExt()` 의 각 MIME 입력 → 확장자 매핑 / 미지원 MIME 에 대한 throw.
- `src/lib/cafe-link.test.ts` — `getCafeUrl()` 의 UA 분기 (PC UA / iPhone UA / Android UA / SSR).
- `src/lib/interview-answer-key.test.ts` (신규 헬퍼) — upsert composite key 객체를 만드는 유틸의 반환 형태 확인 (`userId_contentId_level_questionIndex` 순서·필드 존재).

테스트 범위는 순수 함수로 한정한다 (I/O·Prisma 는 수동 검증에 맡김).

---

## 8. 롤아웃

routines 는 `main` 단일 브랜치 + 단일 디렉토리 구조 (dev/prod 분리 없음).

1. feature 브랜치 또는 `main` 에서 작업.
2. 마이그레이션 + 환경변수 추가 먼저 배포.
3. 코드 배포 → PM2 재기동 (`pm2 restart routines`).
4. 크론 등록.
5. 스모크 테스트 (인터뷰 1건 → 녹음 1건 → 다운로드 / 카페 링크).

기존 Speaking 데이터(Web Speech 기반 점수)는 `UserProgress.score` 컬럼에 남지만 새 로직과 무관. 별도 마이그레이션 불필요.

---

## 9. 향후 고려사항 (Non-blocking)

- InterviewAnswer 볼륨 증가 시 사용자별 보관 기간 도입.
- 녹음 파일 S3 오프로딩 (트래픽 증가 시).
- 네이버 카페 게시글 자동 생성 (카페 open API 있을 경우).
- 녹음 간 전/후 비교 기능 (같은 문장 며칠간 녹음 비교).

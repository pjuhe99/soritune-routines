# 인터뷰/녹음 재설계 — 세션 간 진행 상황

**Last saved**: 2026-04-21 evening
**Plan file**: `docs/superpowers/plans/2026-04-21-interview-recording-redesign.md`
**Spec file**: `docs/superpowers/specs/2026-04-21-interview-recording-redesign-design.md`

---

## 전체 진행률: 15 / 24 완료 (62.5%)

### ✅ 완료된 Task (1~15) — 모두 코드 커밋 + main push + PM2 배포까지 완료

| # | Task | Commit(s) |
|---|------|-----------|
| 1 | vitest 테스트 러너 셋업 | `bce817b` |
| 2 | mimeToExt 순수함수 (TDD) | `6b94f01` |
| 3 | pickCafeUrl 순수함수 (TDD) | `45c158f` |
| 4 | buildInterviewAnswerUniqueKey (TDD) | `8087bba` |
| 5 | upload-paths 유틸 | `e4e6272` |
| 6 | Prisma 스키마 + 마이그레이션 (⚠️ DB 적용 완료) | `002d61a` |
| 7 | AI service Korean prompt + recommendedSentence | `0195aea` + `3fafcd1` (fix: Korean sentinel) |
| 8 | Interview API upsert (체크포인트 A) | `ff00e9d` |
| 9 | GET /api/interview-answer | `943e682` |
| 10 | POST /api/recording/upload | `e90d879` + `fa36e3e` + `ed87779` (2 fixes) |
| 11 | GET /api/recording/[id]/file | `86c37b7` |
| 12 | DELETE /api/recording/[id] | `153a7e6` |
| 13 | POST /api/cron/cleanup-recordings (체크포인트 B) | `de4c9d8` |
| 14 | useMediaRecorder 훅 | `e897b59` + `2405986` (fix: guards) |
| 15 | InterviewChat 한글 UI + 스킵 | `4549eb9` |

### ⏳ 남은 Task (16~24)

| # | Task | 상태 |
|---|------|------|
| 16 | RecordingCard 컴포넌트 | pending — 다음 시작 |
| 17 | RecordingStudio 컴포넌트 | pending |
| 18 | Speaking 페이지 교체 | pending |
| 19-20 | SpeechContext STT 제거 + 구 파일 삭제 (합침) | pending |
| 21 | 빌드/린트/테스트 (체크포인트 C) | pending |
| 22 | 환경변수 `CLEANUP_CRON_SECRET` + crontab 등록 | pending |
| 23 | uploads 디렉토리 + SELinux `httpd_sys_rw_content_t` | pending |
| 24 | 전체 플로우 스모크 테스트 (사용자 필요) | pending |

---

## 현재 환경 상태

### Git
- **브랜치**: `main` (routines 는 main 단일 브랜치 운영)
- **Remote**: `github-routines` → `pjuhe99/soritune-routines`
- **마지막 push**: `de4c9d8a` (Task 13 까지). **Task 14, 15 의 3 개 커밋이 unpushed** → 세션 저장 직후 push 예정

### DB (SORITUNECOM_ROUTINES, 운영 DB — pre-launch)
- 마이그레이션 `20260421080445_add_interview_answer_and_recording` 적용 완료
- 테이블 `interview_answers`, `recordings` 생성됨, 모두 비어있음
- P3014 (shadow DB 권한 부족) 워크어라운드: `prisma migrate diff` → `db execute` → `migrate resolve --applied` 로 적용. 다음 마이그레이션부터도 동일 패턴 사용.

### PM2 / 배포
- `pm2 restart routines --update-env` 로 Task 13 까지는 배포 완료
- 체크포인트 B 수동 검증: 모든 신규 엔드포인트 401/503 정상 응답 확인됨
- Task 14, 15 는 프론트엔드라 pm2 재기동 필요 (아직 안 함)

### 환경변수
- `CLEANUP_CRON_SECRET` — **아직 미설정** (Task 22 에서 생성 + `.env.local` 추가 예정)
- 현재 `/api/cron/cleanup-recordings` 호출 시 503 반환 (의도된 safe default)

### Uploads 디렉토리
- `<repo>/uploads/recordings/` — **아직 생성 안 함** (Task 23)
- SELinux 컨텍스트 `httpd_sys_rw_content_t` 설정 필요 (Task 23)
- `.gitignore` 에는 이미 `/uploads/` 추가됨

### 테스트 / 빌드
- 14개 단위 테스트 통과 (`pnpm test`)
- Next.js 프로덕션 빌드 통과 (`pnpm build`)

---

## 다음 세션 재개 가이드

### 1. 컨텍스트 로드
다음 파일을 순서대로 읽으면 전체 맥락 파악 가능:
1. `docs/superpowers/specs/2026-04-21-interview-recording-redesign-design.md` — 설계 문서
2. `docs/superpowers/plans/2026-04-21-interview-recording-redesign.md` — 24-task 구현 계획
3. `docs/superpowers/plans/2026-04-21-interview-recording-PROGRESS.md` — 이 파일 (진행 상황)
4. `git log --oneline -20` — 최근 커밋 확인

### 2. 실행 방식
Subagent-Driven Development (superpowers 스킬) 사용 중. 각 task 마다:
- implementer subagent → 구현 + 커밋
- spec reviewer subagent → 스펙 준수 확인
- code-reviewer subagent → 품질 검토
- 문제 있으면 fix 디스패치

### 3. 체크포인트 정책
- **체크포인트 A** (Task 8 완료): ✅ 통과
- **체크포인트 B** (Task 13 완료): ✅ 통과
- **체크포인트 C** (Task 21 완료): 전체 코드 완성 후 사용자 확인 예정
- 매 체크포인트마다 push 확인 받음

### 4. 다음 즉시 할 일
**Task 16 (RecordingCard 컴포넌트)** 부터 시작.
- 플랜에 전체 코드 있음 (plan 파일 "## Task 16" 섹션)
- useMediaRecorder 훅, mimeToExt, getCafeUrl 모두 이미 준비됨
- 카드 상태머신: idle → recording → uploading → done
- 액션 버튼: 재생, 다시 녹음, 삭제, 다운로드, 카페에 올리기

### 5. 알려진 한계 (사용자 합의된 스코프 외)
- **동시 업로드 race condition**: 같은 InterviewAnswer 에 동시 2건 업로드하면 Recording 2개 생성 가능. 단일 유저 UI 흐름에선 불가능. 파일럿 외 스코프로 문서화만.

### 6. 원복/롤백 지점
- 커밋은 모두 작고 독립적이라 `git revert <sha>` 로 개별 롤백 가능
- DB 마이그레이션은 신규 테이블만 추가 — 필요 시 `DROP TABLE recordings; DROP TABLE interview_answers;` 로 원복 (기존 데이터 영향 없음)

---

## 사용자 최종 검증 (Task 24 시점)

서비스 오픈 전이고, 실제 로그인 세션으로 테스트가 필요한 시나리오:
- [ ] 인터뷰 답변 시 한국어 피드백이 표시되고 영어 예시는 `"..."` 로 보존됨
- [ ] `recommendedSentence` 가 녹음할 문장 섹션에 강조됨
- [ ] Speaking 페이지에서 마이크 권한 → 녹음 → 업로드 → 재생/다운로드/카페 이동 모두 동작
- [ ] PC/모바일 UA 에 따라 올바른 네이버 카페 URL 열림
- [ ] 재녹음 시 서버에 파일 1개만 유지 (이전 파일 삭제됨)
- [ ] 인터뷰/녹음 부분 완료 상태에서 "스텝 완료" 작동
- [ ] Interview 0건 답변한 상태로 Speaking 진입 시 안내 메시지 표시
- [ ] 크론 호출 시 7일 지난 파일이 일괄 정리됨 (DB 의 expires_at 을 과거로 조작해서 검증)

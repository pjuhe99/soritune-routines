# Routines — Daily English Routine Service Design Spec

## Overview

Routines는 매일 하나의 영어 콘텐츠를 중심으로 6단계 학습 루틴(읽기 → 듣기 → 표현 → 퀴즈 → AI 인터뷰 → 말하기)을 제공하는 구독형 서비스. 스트릭과 공유를 통해 습관을 형성하고, 구독으로 전환하는 구조.

- **도메인**: routines.soritune.com
- **DB**: SORITUNECOM_ROUTINES (MariaDB, 프로비저닝 완료)
- **디자인**: design.md 기반 Framer 스타일 다크 테마, Pretendard 단일 폰트

---

## 1. System Architecture

```
[Browser]
    ↕ HTTPS
[Apache Reverse Proxy] (routines.soritune.com → localhost:3000)
    ↕
[Next.js 15 App (App Router)]
    ├── Pages (SSR/CSR)
    ├── API Route Handlers
    ├── NextAuth.js (JWT session)
    ├── Prisma ORM
    └── AI Service Layer (Claude / OpenAI, server-only)
    ↕
[MariaDB 10.5] (SORITUNECOM_ROUTINES)
```

- Next.js App Router로 프론트엔드 + 백엔드 통합
- PM2로 Node 프로세스 관리
- Apache mod_proxy로 리버스 프록시
- AI API 키는 서버에만 존재, 프론트 노출 금지

---

## 2. Tech Stack

| Area | Technology | Notes |
|------|-----------|-------|
| Framework | Next.js 15 | App Router, TypeScript strict |
| Language | TypeScript | strict mode |
| ORM | Prisma | MariaDB connector |
| DB | MariaDB 10.5 | existing provisioned DB |
| Auth | NextAuth.js (Auth.js v5) | JWT strategy, email credentials |
| AI (Interview) | Claude API + OpenAI API | dual provider, server-only, admin switchable |
| TTS | Web Speech API | browser built-in |
| STT | Web Speech API | phase 1, may switch to Whisper later |
| Styling | Tailwind CSS | design.md custom tokens |
| Font | Pretendard Variable | CDN, Korean + Latin |
| Process Manager | PM2 | Node process |
| Reverse Proxy | Apache mod_proxy | → localhost:3000 |
| Package Manager | pnpm | |

---

## 3. Database Schema

### Users
| Column | Type | Constraints |
|--------|------|-------------|
| id | VARCHAR(36) | PK, UUID |
| email | VARCHAR(255) | UNIQUE, NOT NULL |
| password_hash | VARCHAR(255) | NOT NULL |
| name | VARCHAR(100) | NULL |
| role | ENUM('user','admin') | DEFAULT 'user' |
| subscription_status | ENUM('free','active','expired') | DEFAULT 'free' |
| subscription_expires_at | DATETIME | NULL — NULL for free users, set when subscribed |
| created_at | DATETIME | DEFAULT NOW() |
| last_login_at | DATETIME | NULL |

**Subscription logic**:
- `free`: default, can access today's content only
- `active`: subscription_expires_at > NOW(), can access all archive content
- `expired`: subscription_expires_at <= NOW(), treated same as free
- MVP has no payment integration — admin manually sets subscription_status/expires_at for testing
- Archive API returns content to all users (UI-only lock in MVP), but includes `user.subscription_status` in session so frontend can gate access. Server-side enforcement deferred to post-MVP payment integration.

### PasswordResets
| Column | Type | Constraints |
|--------|------|-------------|
| id | INT | PK, AUTO_INCREMENT |
| user_id | VARCHAR(36) | FK → Users, NOT NULL |
| token | VARCHAR(64) | UNIQUE, NOT NULL — crypto-random hex |
| expires_at | DATETIME | NOT NULL — created_at + 1 hour |
| used | BOOLEAN | DEFAULT false |
| created_at | DATETIME | DEFAULT NOW() |

**Password reset flow**:
1. `POST /api/auth/reset-password` with email → generate token, store in PasswordResets, send email with link containing token
2. `POST /api/auth/reset-password/confirm` with token + new password → validate: token exists, not used, not expired → hash new password, update Users.password_hash, mark token as used
3. Rate limit: max 3 reset requests per email per hour (checked at API level)
4. Tokens are single-use — once used or expired, cannot be reused

### Contents
| Column | Type | Constraints |
|--------|------|-------------|
| id | INT | PK, AUTO_INCREMENT |
| genre | VARCHAR(50) | NOT NULL |
| title | VARCHAR(255) | NOT NULL |
| subtitle | VARCHAR(255) | NULL |
| key_phrase | VARCHAR(255) | NOT NULL |
| key_ko | VARCHAR(255) | NOT NULL |
| paragraphs | JSON | NOT NULL |
| sentences | JSON | NOT NULL |
| expressions | JSON | NOT NULL |
| quiz | JSON | NOT NULL |
| interview | JSON | NOT NULL |
| speak_sentences | JSON | NOT NULL |
| published_at | DATE | NULL, indexed — date-based "today's content" |
| priority | INT | DEFAULT 0 — higher = shown first when multiple share same date |
| is_active | BOOLEAN | DEFAULT true |
| created_at | DATETIME | DEFAULT NOW() |
| updated_at | DATETIME | DEFAULT NOW() ON UPDATE |

**published_at logic**:
- Today's content: `WHERE published_at = CURDATE() AND is_active = true ORDER BY priority DESC LIMIT 1`
- Multiple contents can share the same published_at — priority determines which is the "main" today content
- NULL = draft. Future date = scheduled. No daily boolean flip needed.
- All date comparisons use `Asia/Seoul` timezone (set in app config, not relying on DB server timezone). Prisma queries convert to KST before comparing.

### UserProgress
| Column | Type | Constraints |
|--------|------|-------------|
| id | INT | PK, AUTO_INCREMENT |
| user_id | VARCHAR(36) | FK → Users, NOT NULL |
| content_id | INT | FK → Contents, NOT NULL |
| step | ENUM('reading','listening','expressions','quiz','interview','speaking') | NOT NULL |
| completed | BOOLEAN | DEFAULT false |
| skipped | BOOLEAN | DEFAULT false — true when step skipped due to browser limitation |
| score | INT | NULL (quiz: correctness %, speaking: string similarity %) |
| completed_at | DATETIME | NULL |
| | | UNIQUE(user_id, content_id, step) |

**Step completion rules**:
- A step is "done" if `completed = true` OR `skipped = true`
- Skippable steps: listening (TTS unavailable), speaking (STT unavailable) — see Web Speech API fallback section
- Score for speaking: Levenshtein-based string similarity percentage between target sentence and STT result

### Streaks
| Column | Type | Constraints |
|--------|------|-------------|
| id | INT | PK, AUTO_INCREMENT |
| user_id | VARCHAR(36) | FK → Users, UNIQUE |
| current_streak | INT | DEFAULT 0 |
| longest_streak | INT | DEFAULT 0 |
| last_completed | DATE | NULL |
| updated_at | DATETIME | DEFAULT NOW() ON UPDATE |

**Streak update logic** (triggered when all 6 steps are done — completed or skipped — for a content):
- Entire check + update runs inside a single DB transaction with row-level lock (`SELECT ... FOR UPDATE` on Streaks row)
- The POST /api/progress/[contentId] endpoint is idempotent: re-submitting the same step returns success but does not re-trigger streak logic
- Before streak update, re-count completed/skipped steps inside the transaction to prevent race conditions
- `last_completed = yesterday (KST)` → current_streak += 1
- `last_completed = today (KST)` → no change (idempotent)
- otherwise → current_streak = 1
- Update longest_streak = MAX(current_streak, longest_streak)
- All date comparisons in KST (Asia/Seoul)

### AnalyticsEvents
| Column | Type | Constraints |
|--------|------|-------------|
| id | BIGINT | PK, AUTO_INCREMENT |
| user_id | VARCHAR(36) | FK → Users, NULL (allows anonymous) |
| type | ENUM('view','share','complete','signup') | NOT NULL |
| content_id | INT | FK → Contents, NULL |
| metadata | JSON | NULL |
| created_at | DATETIME | DEFAULT NOW(), indexed |

### Shares
| Column | Type | Constraints |
|--------|------|-------------|
| id | INT | PK, AUTO_INCREMENT |
| user_id | VARCHAR(36) | FK → Users, NULL |
| content_id | INT | FK → Contents, NOT NULL |
| channel | ENUM('copy','kakao','twitter','other') | NOT NULL |
| created_at | DATETIME | DEFAULT NOW() |

### AISettings
| Column | Type | Constraints |
|--------|------|-------------|
| id | INT | PK, AUTO_INCREMENT |
| provider | ENUM('claude','openai') | NOT NULL |
| api_key | VARCHAR(500) | NOT NULL, encrypted at app level |
| model | VARCHAR(100) | NOT NULL |
| is_active | BOOLEAN | DEFAULT true |
| created_at | DATETIME | DEFAULT NOW() |
| updated_at | DATETIME | DEFAULT NOW() ON UPDATE |

---

## 4. API Structure

All routes under `app/api/`.

### Public
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/content/today` | Today's content (published_at = today) |

### Auth
| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/auth/signup` | Email registration |
| * | `/api/auth/[...nextauth]` | NextAuth handlers (login/logout/session) |
| POST | `/api/auth/reset-password` | Password reset request (send email) |
| POST | `/api/auth/reset-password/confirm` | Password reset confirm (token + new password) |

### Authenticated (user)
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/content` | Content list (archive) |
| GET | `/api/content/[id]` | Content detail (archive access check) |
| GET | `/api/progress` | My learning progress overview |
| GET | `/api/progress/[contentId]` | Progress for specific content |
| POST | `/api/progress/[contentId]` | Record step completion → auto streak update on all-6 |
| GET | `/api/streak` | My streak info |
| POST | `/api/share` | Record share event |
| POST | `/api/ai/interview` | AI interview: send answer, get feedback |
| POST | `/api/events` | Record analytics event |

### Admin only (role = admin)
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/admin/content` | Content list with management info |
| POST | `/api/admin/content` | Create content |
| GET | `/api/admin/content/[id]` | Content detail for editing |
| PUT | `/api/admin/content/[id]` | Update content |
| DELETE | `/api/admin/content/[id]` | Delete content |
| GET | `/api/admin/users` | User list with activity metrics |
| GET | `/api/admin/dashboard` | Dashboard metrics (DAU, signups, completions, shares, streak retention) |
| GET | `/api/admin/ai-settings` | AI settings list |
| POST | `/api/admin/ai-settings` | Register AI provider key |
| PUT | `/api/admin/ai-settings/[id]` | Update AI setting |
| DELETE | `/api/admin/ai-settings/[id]` | Delete AI setting |

### Auth middleware
- Public routes: no auth required
- Authenticated routes: NextAuth session required
- Admin routes: session + `role === 'admin'` check via middleware

---

## 5. Frontend Page Structure

### Root
```
app/
├── layout.tsx          -- Root layout (Pretendard font, dark theme globals)
├── page.tsx            -- Landing/home (today's content preview, CTA)
```

### Auth Pages
```
app/(auth)/
├── login/page.tsx
├── signup/page.tsx
└── reset-password/page.tsx
```

### Main (authenticated user)
```
app/(main)/
├── layout.tsx              -- Nav bar, streak display
├── today/page.tsx          -- Today's content hub (6-step progress cards)
├── learn/[contentId]/
│   ├── reading/page.tsx
│   ├── listening/page.tsx
│   ├── expressions/page.tsx
│   ├── quiz/page.tsx
│   ├── interview/page.tsx
│   ├── speaking/page.tsx
│   └── complete/page.tsx   -- Completion (streak animation, share)
├── archive/page.tsx        -- Past content list (lock UI for non-subscribers)
└── profile/page.tsx        -- My streak, learning history
```

### Admin
```
app/(admin)/admin/
├── layout.tsx              -- Admin sidebar, role gate
├── page.tsx                -- Dashboard
├── content/
│   ├── page.tsx            -- Content list
│   ├── new/page.tsx        -- Create content form
│   └── [id]/edit/page.tsx  -- Edit content form
├── users/page.tsx          -- User list
└── settings/page.tsx       -- AI API key management
```

### Learning Flow UX
1. `today/` shows 6 steps as cards — completed steps show checkmark
2. Steps unlock sequentially (previous step must be completed)
3. After speaking (final step) → redirect to `complete/` → streak update + celebration + share buttons

### Archive Access Control
- Today's content (published_at = today, highest priority): accessible to all logged-in users
- Past content: list visible to all, detail API returns content to all users (no server-side block in MVP)
- Frontend checks `session.user.subscription_status`: if not `active`, shows lock overlay with subscription prompt on archive content detail pages
- Server-side enforcement (reject archive API for non-subscribers) deferred to post-MVP payment integration
- Subscription status is included in NextAuth JWT session for frontend gating

---

## 6. Admin Page Details

### Dashboard Metrics
| Section | Metrics |
|---------|---------|
| Overview Cards | Today's DAU, New signups, Learning completions, Share count |
| Chart | Daily DAU trend (last 30 days) |
| Content | Content view count ranking, completion rate per content |
| Streak | Average streak, 7-day+ retention rate |

### Content Form Fields
- Basic: genre, title, subtitle, key_phrase, key_ko
- Body: paragraphs (array of text blocks)
- Sentences: sentences (ordered array for TTS)
- Expressions: expressions (repeating fields: expression/meaning/explanation/example)
- Quiz: quiz (repeating fields: question/answer/hint)
- Interview: interview (question array)
- Speaking: speak_sentences (sentence array)
- Publishing: published_at date picker (null = draft, future = scheduled)

---

## 7. AI Interview Design

### Flow
1. Content has pre-defined interview questions (stored in `Contents.interview` JSON)
2. User sees question → types answer in English
3. `POST /api/ai/interview` sends: question, user answer, content context
4. Server selects active AI provider from AISettings
5. AI returns structured feedback:
   - **Content relevance**: Is the answer appropriate to the question?
   - **Grammar correction**: Specific grammar fixes with explanations
   - **Native expression**: How a native speaker would say it
   - **Encouragement**: Positive reinforcement

### Provider Switching
- AISettings stores multiple providers but **exactly one** must have `is_active = true` at any time
- DB enforcement: application-level check — when activating a provider, deactivate all others in the same transaction
- Admin UI: radio-style toggle (activate one = deactivate others), not independent checkboxes
- AI service layer queries `WHERE is_active = true LIMIT 1` — if no active provider found, return 503 with clear error message ("AI provider not configured")
- If active provider API call fails, return error to user with message to try again — no automatic fallback to another provider

### Prompt Structure (server-side only)
System prompt defines: role (English tutor), output format (JSON with 4 feedback fields), difficulty calibration based on content level.

---

## 8. Web Speech API Fallback

TTS (listening step) and STT (speaking step) depend on browser support. Graceful degradation is required.

### Detection
- On page load, check `window.speechSynthesis` (TTS) and `window.SpeechRecognition || window.webkitSpeechRecognition` (STT)
- Store availability in React context for the learning flow

### Listening Step (TTS unavailable)
- Show banner: "이 브라우저에서는 음성 재생이 지원되지 않습니다"
- Display sentences as text-only with "읽기로 대체" option
- User can mark step as complete manually (recorded as `skipped = true` in UserProgress)

### Speaking Step (STT unavailable or permission denied)
- Show banner: "음성 인식을 사용할 수 없습니다. 이 단계를 건너뛸 수 있습니다."
- Show "건너뛰기" button → records step as `skipped = true`, no score
- Flow continues to complete page normally

### Permission Denied (STT)
- If user denies microphone permission, same behavior as STT unavailable — show skip option

---

## 9. Implementation Phases

| Phase | Scope | Deliverable |
|-------|-------|-------------|
| 1. Project Setup | Next.js init, Tailwind + design.md tokens, Prisma + MariaDB, PM2 + Apache proxy | Buildable empty project, DB connection verified |
| 2. DB Schema | Prisma schema, migration, seed data (1 test content) | All tables created |
| 3. Auth | NextAuth.js config, email signup/login/logout, role separation, session middleware | Auth pages working |
| 4. Content System | Content APIs (today, list, detail), today page, archive list (lock UI) | Content display working |
| 5. Learning Flow | 6-step pages (reading→listening→expressions→quiz→interview→speaking), progress API, sequential unlock | Full learning flow working |
| 6. Streak | Streak API, auto-update on all-6 completion, profile page display | Streak increment/reset working |
| 7. Admin | Content CRUD, user list, AI settings, dashboard | All admin features working |
| 8. AI Features | AI interview API (Claude/OpenAI switching), feedback generation | Interview Q→A→feedback working |
| 9. Share + Analytics | Share API (link copy, Kakao), event collection, dashboard metrics integration | Share + analytics working |
| 10. Polish | Responsive check, error handling, performance optimization, SEO meta | Production ready |

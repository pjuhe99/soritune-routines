# Routines Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a daily English learning routine service with 6-step learning flow, streak system, admin panel, and AI interview — deployed at routines.soritune.com.

**Architecture:** Next.js 15 App Router serves both frontend and API. Prisma ORM connects to existing MariaDB. NextAuth.js handles JWT auth. Apache reverse proxies to localhost:3000. PM2 manages the Node process. AI interview uses dual-provider (Claude/OpenAI) with server-side key management.

**Tech Stack:** Next.js 15, TypeScript, Prisma, MariaDB 10.5, NextAuth.js v5, Tailwind CSS, Pretendard font, PM2, Apache mod_proxy, pnpm

**Spec:** `docs/superpowers/specs/2026-04-14-routines-design.md`
**Design System:** `design.md`

---

## File Structure

```
routines/                          # Next.js project root (inside public_html/)
├── package.json
├── tsconfig.json
├── next.config.ts
├── tailwind.config.ts
├── postcss.config.mjs
├── .env.local                     # DB credentials, NextAuth secret, AI keys
├── middleware.ts                   # NextAuth + admin route protection
├── ecosystem.config.js            # PM2 config
├── prisma/
│   ├── schema.prisma
│   └── seed.ts                    # Test content + admin user
├── src/
│   ├── lib/
│   │   ├── prisma.ts              # Prisma client singleton
│   │   ├── auth.ts                # NextAuth config (providers, callbacks, JWT)
│   │   ├── auth-helpers.ts        # getSession, requireAuth, requireAdmin helpers
│   │   ├── ai-service.ts          # Dual provider AI service (Claude/OpenAI)
│   │   ├── date.ts                # KST timezone helpers (todayKST, isYesterdayKST)
│   │   ├── string-similarity.ts   # Levenshtein distance for speaking score
│   │   └── encryption.ts          # AES encrypt/decrypt for AI API keys
│   ├── contexts/
│   │   └── speech-context.tsx     # Web Speech API availability detection
│   ├── components/
│   │   ├── ui/
│   │   │   ├── button.tsx         # Frosted Pill, Solid White Pill, Ghost variants
│   │   │   ├── card.tsx           # Dark Surface Card, Elevated Card
│   │   │   ├── input.tsx          # Dark themed input with blue focus ring
│   │   │   └── badge.tsx          # Status badges (create if needed)
│   │   ├── nav.tsx                # Top navigation bar
│   │   ├── streak-display.tsx     # Streak counter with flame icon
│   │   ├── step-card.tsx          # Learning step card (locked/active/complete states)
│   │   ├── learning/
│   │   │   ├── reading-view.tsx       # Paragraph display with highlights
│   │   │   ├── listening-player.tsx   # TTS controls per sentence + fallback
│   │   │   ├── expression-list.tsx    # Expression cards with TTS
│   │   │   ├── quiz-form.tsx          # Fill-in-the-blank quiz
│   │   │   ├── interview-chat.tsx     # AI interview Q&A with feedback
│   │   │   └── speaking-recorder.tsx  # STT recorder with score + fallback
│   │   └── admin/
│   │       ├── sidebar.tsx            # Admin navigation sidebar
│   │       └── content-form.tsx       # Content create/edit form with JSON array fields
│   └── app/
│       ├── layout.tsx                 # Root layout (Pretendard, dark theme)
│       ├── page.tsx                   # Landing page (today's content preview, CTA)
│       ├── globals.css                # Tailwind imports + design system globals
│       ├── (auth)/
│       │   ├── login/page.tsx
│       │   ├── signup/page.tsx
│       │   └── reset-password/page.tsx
│       ├── (main)/
│       │   ├── layout.tsx             # Authenticated layout (nav, streak)
│       │   ├── today/page.tsx         # Today's content hub with 6 step cards
│       │   ├── learn/[contentId]/
│       │   │   ├── layout.tsx         # Learning flow layout (progress bar)
│       │   │   ├── reading/page.tsx
│       │   │   ├── listening/page.tsx
│       │   │   ├── expressions/page.tsx
│       │   │   ├── quiz/page.tsx
│       │   │   ├── interview/page.tsx
│       │   │   ├── speaking/page.tsx
│       │   │   └── complete/page.tsx
│       │   ├── archive/page.tsx
│       │   └── profile/page.tsx
│       ├── (admin)/admin/
│       │   ├── layout.tsx
│       │   ├── page.tsx               # Dashboard
│       │   ├── content/
│       │   │   ├── page.tsx           # Content list
│       │   │   ├── new/page.tsx
│       │   │   └── [id]/edit/page.tsx
│       │   ├── users/page.tsx
│       │   └── settings/page.tsx      # AI API key management
│       └── api/
│           ├── auth/
│           │   ├── [...nextauth]/route.ts
│           │   ├── signup/route.ts
│           │   └── reset-password/
│           │       ├── route.ts           # Request reset
│           │       └── confirm/route.ts   # Confirm reset
│           ├── content/
│           │   ├── route.ts               # GET list
│           │   ├── today/route.ts         # GET today
│           │   └── [id]/route.ts          # GET detail
│           ├── progress/
│           │   ├── route.ts               # GET overview
│           │   └── [contentId]/route.ts   # GET/POST per content
│           ├── streak/route.ts
│           ├── share/route.ts
│           ├── events/route.ts
│           ├── ai/
│           │   └── interview/route.ts
│           └── admin/
│               ├── content/
│               │   ├── route.ts           # GET list, POST create
│               │   └── [id]/route.ts      # GET/PUT/DELETE
│               ├── users/route.ts
│               ├── dashboard/route.ts
│               └── ai-settings/
│                   ├── route.ts           # GET list, POST create
│                   └── [id]/route.ts      # PUT/DELETE
```

---

## Task 1: Project Setup & Infrastructure

**Files:**
- Create: `public_html/routines/package.json`
- Create: `public_html/routines/tsconfig.json`
- Create: `public_html/routines/next.config.ts`
- Create: `public_html/routines/tailwind.config.ts`
- Create: `public_html/routines/postcss.config.mjs`
- Create: `public_html/routines/.env.local`
- Create: `public_html/routines/src/app/layout.tsx`
- Create: `public_html/routines/src/app/globals.css`
- Create: `public_html/routines/src/app/page.tsx`
- Create: `public_html/routines/ecosystem.config.js`

- [ ] **Step 1: Initialize Next.js project**

```bash
cd /var/www/html/_______site_SORITUNECOM_ROUTINES/public_html
pnpm create next-app routines --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-pnpm
```

Expected: Project scaffolded at `public_html/routines/`

- [ ] **Step 2: Configure Tailwind with design.md tokens**

Replace `tailwind.config.ts`:

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "void-black": "#000000",
        "near-black": "#090909",
        "framer-blue": "#0099ff",
        "muted-silver": "#a6a6a6",
        "frosted-white": "rgba(255, 255, 255, 0.1)",
        "subtle-white": "rgba(255, 255, 255, 0.5)",
        "ghost-white": "rgba(255, 255, 255, 0.6)",
        "blue-glow": "rgba(0, 153, 255, 0.15)",
      },
      fontFamily: {
        pretendard: [
          "Pretendard Variable",
          "Pretendard",
          "-apple-system",
          "BlinkMacSystemFont",
          "system-ui",
          "Helvetica Neue",
          "sans-serif",
        ],
      },
      borderRadius: {
        "pill": "100px",
        "pill-sm": "40px",
      },
      boxShadow: {
        "ring-blue": "rgba(0, 153, 255, 0.15) 0px 0px 0px 1px",
        "ring-dark": "rgb(9, 9, 9) 0px 0px 0px 2px",
        "elevated": "rgba(255, 255, 255, 0.1) 0px 0.5px 0px 0.5px, rgba(0, 0, 0, 0.25) 0px 10px 30px",
      },
      maxWidth: {
        "container": "1200px",
      },
    },
  },
  plugins: [],
};
export default config;
```

- [ ] **Step 3: Create globals.css with Pretendard CDN and dark theme base**

Replace `src/app/globals.css`:

```css
@import "tailwindcss";

@theme {
  --color-void-black: #000000;
  --color-near-black: #090909;
  --color-framer-blue: #0099ff;
  --color-muted-silver: #a6a6a6;
  --color-frosted-white: rgba(255, 255, 255, 0.1);
  --color-subtle-white: rgba(255, 255, 255, 0.5);
  --color-ghost-white: rgba(255, 255, 255, 0.6);
  --color-blue-glow: rgba(0, 153, 255, 0.15);

  --font-pretendard: "Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, system-ui, "Helvetica Neue", sans-serif;

  --radius-pill: 100px;
  --radius-pill-sm: 40px;

  --shadow-ring-blue: rgba(0, 153, 255, 0.15) 0px 0px 0px 1px;
  --shadow-ring-dark: rgb(9, 9, 9) 0px 0px 0px 2px;
  --shadow-elevated: rgba(255, 255, 255, 0.1) 0px 0.5px 0px 0.5px, rgba(0, 0, 0, 0.25) 0px 10px 30px;

  --width-container: 1200px;
}

html {
  background-color: #000000;
  color: #ffffff;
}

body {
  font-family: var(--font-pretendard);
  background-color: #000000;
  color: #ffffff;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* Focus ring utility */
*:focus-visible {
  outline: 1px solid #0099ff;
  outline-offset: 2px;
}

/* Placeholder styling */
::placeholder {
  color: rgba(255, 255, 255, 0.4);
}
```

- [ ] **Step 4: Create root layout with Pretendard font**

Replace `src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Routines — Daily English Routine",
  description: "매일 하나의 영어 콘텐츠로 학습 루틴을 만드세요",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css"
        />
      </head>
      <body className="font-pretendard bg-void-black text-white min-h-screen">
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 5: Create placeholder landing page**

Replace `src/app/page.tsx`:

```tsx
export default function Home() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen">
      <h1 className="text-[110px] font-bold leading-[0.85] tracking-[-5.5px] text-white text-center">
        Routines
      </h1>
      <p className="mt-6 text-lg text-muted-silver tracking-[-0.01px] leading-[1.6]">
        매일 하나의 영어 콘텐츠로 학습 루틴을 만드세요
      </p>
      <button className="mt-10 bg-white text-black px-6 py-3 rounded-pill text-[15px] font-medium tracking-[-0.15px] hover:opacity-90 transition-opacity">
        시작하기
      </button>
    </main>
  );
}
```

- [ ] **Step 6: Create .env.local with DB credentials and NextAuth secret**

```bash
cd /var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines
cat > .env.local << 'ENVEOF'
# Database
DATABASE_URL="mysql://SORITUNECOM_ROUTINES:fj6eNiUqlCa7k/dh3ZU+a1Yg@localhost:3306/SORITUNECOM_ROUTINES"

# NextAuth
NEXTAUTH_URL="https://routines.soritune.com"
NEXTAUTH_SECRET="<generate-with-openssl-rand-base64-32>"

# AI Keys (set via admin panel, stored encrypted in DB)
# No AI env vars needed — keys come from AISettings table

# Timezone
TZ="Asia/Seoul"

# Encryption key for AI API keys in DB
ENCRYPTION_KEY="<generate-with-openssl-rand-hex-32>"
ENVEOF
```

Then generate secrets:

```bash
cd /var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines
NEXTAUTH_SECRET=$(openssl rand -base64 32)
ENCRYPTION_KEY=$(openssl rand -hex 32)
sed -i "s|<generate-with-openssl-rand-base64-32>|${NEXTAUTH_SECRET}|" .env.local
sed -i "s|<generate-with-openssl-rand-hex-32>|${ENCRYPTION_KEY}|" .env.local
```

- [ ] **Step 7: Create PM2 ecosystem config**

Create `ecosystem.config.js`:

```js
module.exports = {
  apps: [
    {
      name: "routines",
      script: "node_modules/.bin/next",
      args: "start",
      cwd: "/var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
  ],
};
```

- [ ] **Step 8: Configure Apache reverse proxy**

Create Apache config (requires root):

```bash
cat > /etc/httpd/conf.d/routines.soritune.com.conf << 'APACHEEOF'
<VirtualHost *:443>
    ServerName routines.soritune.com

    SSLEngine on
    SSLCertificateFile /etc/letsencrypt/live/routines.soritune.com/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/routines.soritune.com/privkey.pem

    ProxyPreserveHost On
    ProxyPass / http://127.0.0.1:3000/
    ProxyPassReverse / http://127.0.0.1:3000/

    # WebSocket support for HMR in dev
    RewriteEngine On
    RewriteCond %{HTTP:Upgrade} websocket [NC]
    RewriteCond %{HTTP:Connection} upgrade [NC]
    RewriteRule ^/?(.*) ws://127.0.0.1:3000/$1 [P,L]
</VirtualHost>
APACHEEOF
```

Check if SSL cert exists; if not, generate with certbot. Then reload Apache:

```bash
httpd -t && systemctl reload httpd
```

- [ ] **Step 9: Verify dev server starts**

```bash
cd /var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines
pnpm dev
```

Expected: Server starts on localhost:3000, landing page shows "Routines" hero text with Pretendard font on pure black background.

- [ ] **Step 10: Commit**

```bash
cd /var/www/html/_______site_SORITUNECOM_ROUTINES
git add public_html/routines/
git commit -m "feat: initialize Next.js project with Tailwind design tokens and infrastructure"
```

---

## Task 2: Database Schema (Prisma)

**Files:**
- Create: `public_html/routines/prisma/schema.prisma`
- Create: `public_html/routines/prisma/seed.ts`
- Create: `public_html/routines/src/lib/prisma.ts`

- [ ] **Step 1: Install Prisma**

```bash
cd /var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines
pnpm add prisma @prisma/client
pnpm add -D ts-node
npx prisma init --datasource-provider mysql
```

- [ ] **Step 2: Write Prisma schema**

Replace `prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

model User {
  id                     String    @id @default(uuid()) @db.VarChar(36)
  email                  String    @unique @db.VarChar(255)
  passwordHash           String    @map("password_hash") @db.VarChar(255)
  name                   String?   @db.VarChar(100)
  role                   UserRole  @default(user)
  subscriptionStatus     SubStatus @default(free) @map("subscription_status")
  subscriptionExpiresAt  DateTime? @map("subscription_expires_at")
  createdAt              DateTime  @default(now()) @map("created_at")
  lastLoginAt            DateTime? @map("last_login_at")

  progress       UserProgress[]
  streak         Streak?
  analyticsEvents AnalyticsEvent[]
  shares         Share[]
  passwordResets PasswordReset[]

  @@map("users")
}

model PasswordReset {
  id        Int      @id @default(autoincrement())
  userId    String   @map("user_id") @db.VarChar(36)
  token     String   @unique @db.VarChar(64)
  expiresAt DateTime @map("expires_at")
  used      Boolean  @default(false)
  createdAt DateTime @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("password_resets")
}

model Content {
  id             Int      @id @default(autoincrement())
  genre          String   @db.VarChar(50)
  title          String   @db.VarChar(255)
  subtitle       String?  @db.VarChar(255)
  keyPhrase      String   @map("key_phrase") @db.VarChar(255)
  keyKo          String   @map("key_ko") @db.VarChar(255)
  paragraphs     Json
  sentences      Json
  expressions    Json
  quiz           Json
  interview      Json
  speakSentences Json     @map("speak_sentences")
  publishedAt    DateTime? @map("published_at") @db.Date
  priority       Int      @default(0)
  isActive       Boolean  @default(true) @map("is_active")
  createdAt      DateTime @default(now()) @map("created_at")
  updatedAt      DateTime @updatedAt @map("updated_at")

  progress       UserProgress[]
  analyticsEvents AnalyticsEvent[]
  shares         Share[]

  @@index([publishedAt, isActive, priority])
  @@map("contents")
}

model UserProgress {
  id          Int       @id @default(autoincrement())
  userId      String    @map("user_id") @db.VarChar(36)
  contentId   Int       @map("content_id")
  step        LearningStep
  completed   Boolean   @default(false)
  skipped     Boolean   @default(false)
  score       Int?
  completedAt DateTime? @map("completed_at")

  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  content Content @relation(fields: [contentId], references: [id], onDelete: Cascade)

  @@unique([userId, contentId, step])
  @@map("user_progress")
}

model Streak {
  id             Int      @id @default(autoincrement())
  userId         String   @unique @map("user_id") @db.VarChar(36)
  currentStreak  Int      @default(0) @map("current_streak")
  longestStreak  Int      @default(0) @map("longest_streak")
  lastCompleted  DateTime? @map("last_completed") @db.Date
  updatedAt      DateTime @updatedAt @map("updated_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("streaks")
}

model AnalyticsEvent {
  id        BigInt    @id @default(autoincrement())
  userId    String?   @map("user_id") @db.VarChar(36)
  type      EventType
  contentId Int?      @map("content_id")
  metadata  Json?
  createdAt DateTime  @default(now()) @map("created_at")

  user    User?    @relation(fields: [userId], references: [id], onDelete: SetNull)
  content Content? @relation(fields: [contentId], references: [id], onDelete: SetNull)

  @@index([createdAt])
  @@index([type, createdAt])
  @@map("analytics_events")
}

model Share {
  id        Int          @id @default(autoincrement())
  userId    String?      @map("user_id") @db.VarChar(36)
  contentId Int          @map("content_id")
  channel   ShareChannel
  createdAt DateTime     @default(now()) @map("created_at")

  user    User?   @relation(fields: [userId], references: [id], onDelete: SetNull)
  content Content @relation(fields: [contentId], references: [id], onDelete: Cascade)

  @@map("shares")
}

model AISetting {
  id        Int        @id @default(autoincrement())
  provider  AIProvider
  apiKey    String     @map("api_key") @db.VarChar(500)
  model     String     @db.VarChar(100)
  isActive  Boolean    @default(true) @map("is_active")
  createdAt DateTime   @default(now()) @map("created_at")
  updatedAt DateTime   @updatedAt @map("updated_at")

  @@map("ai_settings")
}

enum UserRole {
  user
  admin
}

enum SubStatus {
  free
  active
  expired
}

enum LearningStep {
  reading
  listening
  expressions
  quiz
  interview
  speaking
}

enum EventType {
  view
  share
  complete
  signup
}

enum ShareChannel {
  copy
  kakao
  twitter
  other
}

enum AIProvider {
  claude
  openai
}
```

- [ ] **Step 3: Create Prisma client singleton**

Create `src/lib/prisma.ts`:

```ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

- [ ] **Step 4: Run migration**

```bash
cd /var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines
npx prisma migrate dev --name init
```

Expected: All tables created in SORITUNECOM_ROUTINES database.

- [ ] **Step 5: Create seed data**

Create `prisma/seed.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Admin user
  const adminPassword = await hash("admin1234!", 12);
  const admin = await prisma.user.upsert({
    where: { email: "admin@soritune.com" },
    update: {},
    create: {
      email: "admin@soritune.com",
      passwordHash: adminPassword,
      name: "Admin",
      role: "admin",
    },
  });

  // Test user
  const userPassword = await hash("test1234!", 12);
  const testUser = await prisma.user.upsert({
    where: { email: "test@soritune.com" },
    update: {},
    create: {
      email: "test@soritune.com",
      passwordHash: userPassword,
      name: "Test User",
      role: "user",
    },
  });

  // Initialize streak for test user
  await prisma.streak.upsert({
    where: { userId: testUser.id },
    update: {},
    create: { userId: testUser.id },
  });

  // Today's content
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await prisma.content.upsert({
    where: { id: 1 },
    update: {},
    create: {
      genre: "Daily Life",
      title: "Morning Routines That Change Your Day",
      subtitle: "How successful people start their mornings",
      keyPhrase: "make a habit of",
      keyKo: "~을 습관으로 만들다",
      paragraphs: [
        "Many successful people swear by their morning routines. They wake up early, exercise, and plan their day before the world demands their attention.",
        "Research shows that having a consistent morning routine can reduce stress and increase productivity. The key is to make a habit of doing the same things each morning.",
        "Whether it's meditation, journaling, or a simple cup of coffee in silence, finding what works for you is the first step toward a more productive day.",
      ],
      sentences: [
        "Many successful people swear by their morning routines.",
        "They wake up early, exercise, and plan their day.",
        "Research shows that having a consistent morning routine can reduce stress.",
        "The key is to make a habit of doing the same things each morning.",
        "Finding what works for you is the first step toward a more productive day.",
      ],
      expressions: [
        {
          expression: "swear by",
          meaning: "to strongly believe in the effectiveness of",
          explanation: "Used when someone trusts something completely based on experience.",
          example: "I swear by this coffee — it's the best way to start the day.",
        },
        {
          expression: "make a habit of",
          meaning: "to do something regularly until it becomes automatic",
          explanation: "Describes the process of turning an action into a routine behavior.",
          example: "She made a habit of reading for 30 minutes before bed.",
        },
        {
          expression: "the key is",
          meaning: "the most important factor is",
          explanation: "Used to highlight the crucial element of a situation.",
          example: "The key is consistency — doing it every single day.",
        },
      ],
      quiz: [
        {
          question: "Many successful people _____ their morning routines.",
          answer: "swear by",
          hint: "to strongly believe in something",
        },
        {
          question: "The key is to _____ doing the same things each morning.",
          answer: "make a habit of",
          hint: "to do regularly until automatic",
        },
        {
          question: "Finding what works for you is the _____ toward a more productive day.",
          answer: "first step",
          hint: "the beginning of a process",
        },
      ],
      interview: [
        "What does your morning routine look like?",
        "Do you think morning routines are important? Why or why not?",
        "What habit would you like to make a part of your daily routine?",
      ],
      speakSentences: [
        "Many successful people swear by their morning routines.",
        "The key is to make a habit of doing the same things each morning.",
        "Finding what works for you is the first step toward a more productive day.",
      ],
      publishedAt: today,
      priority: 0,
      isActive: true,
    },
  });

  console.log("Seed complete:", { admin: admin.email, testUser: testUser.email });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

- [ ] **Step 6: Install bcryptjs and configure seed command**

```bash
cd /var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines
pnpm add bcryptjs
pnpm add -D @types/bcryptjs
```

Add to `package.json`:

```json
{
  "prisma": {
    "seed": "ts-node --compiler-options {\"module\":\"CommonJS\"} prisma/seed.ts"
  }
}
```

- [ ] **Step 7: Run seed**

```bash
cd /var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines
npx prisma db seed
```

Expected: "Seed complete: { admin: 'admin@soritune.com', testUser: 'test@soritune.com' }"

- [ ] **Step 8: Verify DB tables exist**

```bash
mysql -u SORITUNECOM_ROUTINES -p'fj6eNiUqlCa7k/dh3ZU+a1Yg' SORITUNECOM_ROUTINES -e "SHOW TABLES;"
```

Expected: tables `users`, `password_resets`, `contents`, `user_progress`, `streaks`, `analytics_events`, `shares`, `ai_settings`, `_prisma_migrations`

- [ ] **Step 9: Commit**

```bash
cd /var/www/html/_______site_SORITUNECOM_ROUTINES
git add public_html/routines/prisma/ public_html/routines/src/lib/prisma.ts public_html/routines/package.json public_html/routines/pnpm-lock.yaml
git commit -m "feat: add Prisma schema with all tables and seed data"
```

---

## Task 3: Authentication (NextAuth.js)

**Files:**
- Create: `public_html/routines/src/lib/auth.ts`
- Create: `public_html/routines/src/lib/auth-helpers.ts`
- Create: `public_html/routines/src/app/api/auth/[...nextauth]/route.ts`
- Create: `public_html/routines/src/app/api/auth/signup/route.ts`
- Create: `public_html/routines/src/app/api/auth/reset-password/route.ts`
- Create: `public_html/routines/src/app/api/auth/reset-password/confirm/route.ts`
- Create: `public_html/routines/middleware.ts`
- Create: `public_html/routines/src/app/(auth)/login/page.tsx`
- Create: `public_html/routines/src/app/(auth)/signup/page.tsx`
- Create: `public_html/routines/src/app/(auth)/reset-password/page.tsx`
- Create: `public_html/routines/src/components/ui/button.tsx`
- Create: `public_html/routines/src/components/ui/input.tsx`

- [ ] **Step 1: Install auth dependencies**

```bash
cd /var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines
pnpm add next-auth@beta @auth/prisma-adapter
```

- [ ] **Step 2: Create NextAuth config**

Create `src/lib/auth.ts`:

```ts
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { prisma } from "./prisma";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user) return null;

        const isValid = await compare(
          credentials.password as string,
          user.passwordHash
        );
        if (!isValid) return null;

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          subscriptionStatus: user.subscriptionStatus,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role: string }).role;
        token.subscriptionStatus = (user as { subscriptionStatus: string }).subscriptionStatus;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as { role: string }).role = token.role as string;
        (session.user as { subscriptionStatus: string }).subscriptionStatus =
          token.subscriptionStatus as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
});
```

- [ ] **Step 3: Create auth type augmentation**

Create `src/types/next-auth.d.ts`:

```ts
import "next-auth";

declare module "next-auth" {
  interface User {
    role: string;
    subscriptionStatus: string;
  }

  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      role: string;
      subscriptionStatus: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
    subscriptionStatus: string;
  }
}
```

- [ ] **Step 4: Create NextAuth route handler**

Create `src/app/api/auth/[...nextauth]/route.ts`:

```ts
import { handlers } from "@/lib/auth";
export const { GET, POST } = handlers;
```

- [ ] **Step 5: Create auth helper functions**

Create `src/lib/auth-helpers.ts`:

```ts
import { auth } from "./auth";
import { NextResponse } from "next/server";

export async function getSession() {
  return await auth();
}

export async function requireAuth() {
  const session = await auth();
  if (!session?.user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }), session: null };
  }
  return { error: null, session };
}

export async function requireAdmin() {
  const session = await auth();
  if (!session?.user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }), session: null };
  }
  if (session.user.role !== "admin") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }), session: null };
  }
  return { error: null, session };
}
```

- [ ] **Step 6: Create middleware for route protection**

Create `middleware.ts` (project root):

```ts
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Admin routes require admin role
  if (pathname.startsWith("/admin")) {
    if (!req.auth?.user) {
      return NextResponse.redirect(new URL("/login", req.url));
    }
    if ((req.auth.user as { role: string }).role !== "admin") {
      return NextResponse.redirect(new URL("/", req.url));
    }
  }

  // Main app routes require authentication
  if (
    pathname.startsWith("/today") ||
    pathname.startsWith("/learn") ||
    pathname.startsWith("/archive") ||
    pathname.startsWith("/profile")
  ) {
    if (!req.auth?.user) {
      return NextResponse.redirect(new URL("/login", req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/admin/:path*", "/today/:path*", "/learn/:path*", "/archive/:path*", "/profile/:path*"],
};
```

- [ ] **Step 7: Create signup API**

Create `src/app/api/auth/signup/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const { email, password, name } = await req.json();

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password required" }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Email already registered" }, { status: 409 });
  }

  const passwordHash = await hash(password, 12);
  const user = await prisma.user.create({
    data: { email, passwordHash, name: name || null },
  });

  // Initialize streak
  await prisma.streak.create({ data: { userId: user.id } });

  // Record signup event
  await prisma.analyticsEvent.create({
    data: { userId: user.id, type: "signup" },
  });

  return NextResponse.json({ success: true, userId: user.id }, { status: 201 });
}
```

- [ ] **Step 8: Create password reset API (request)**

Create `src/app/api/auth/reset-password/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const { email } = await req.json();

  if (!email) {
    return NextResponse.json({ error: "Email required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    // Don't reveal whether email exists
    return NextResponse.json({ success: true });
  }

  // Rate limit: max 3 per hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentCount = await prisma.passwordReset.count({
    where: { userId: user.id, createdAt: { gte: oneHourAgo } },
  });
  if (recentCount >= 3) {
    return NextResponse.json({ error: "Too many reset requests. Try again later." }, { status: 429 });
  }

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await prisma.passwordReset.create({
    data: { userId: user.id, token, expiresAt },
  });

  // TODO: Send email with reset link (integrate email service in production)
  // For now, log the token for testing
  console.log(`Password reset token for ${email}: ${token}`);
  console.log(`Reset URL: ${process.env.NEXTAUTH_URL}/reset-password?token=${token}`);

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 9: Create password reset API (confirm)**

Create `src/app/api/auth/reset-password/confirm/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const { token, password } = await req.json();

  if (!token || !password) {
    return NextResponse.json({ error: "Token and password required" }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  const reset = await prisma.passwordReset.findUnique({ where: { token } });

  if (!reset || reset.used || reset.expiresAt < new Date()) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 400 });
  }

  const passwordHash = await hash(password, 12);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: reset.userId },
      data: { passwordHash },
    }),
    prisma.passwordReset.update({
      where: { id: reset.id },
      data: { used: true },
    }),
  ]);

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 10: Create UI components (Button, Input)**

Create `src/components/ui/button.tsx`:

```tsx
import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "solid" | "frosted" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  fullWidth?: boolean;
}

const variantStyles: Record<Variant, string> = {
  solid:
    "bg-white text-black rounded-pill hover:opacity-90",
  frosted:
    "bg-frosted-white text-white rounded-pill-sm hover:bg-subtle-white",
  ghost:
    "bg-transparent text-white hover:bg-frosted-white rounded-pill-sm",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "solid", fullWidth, className = "", children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={`px-6 py-3 text-[15px] font-medium tracking-[-0.15px] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
          fullWidth ? "w-full" : ""
        } ${variantStyles[variant]} ${className}`}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
```

Create `src/components/ui/input.tsx`:

```tsx
import { InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = "", ...props }, ref) => {
    return (
      <div className="flex flex-col gap-2">
        {label && (
          <label className="text-[13px] font-medium text-muted-silver tracking-normal leading-[1.6]">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={`bg-near-black border border-white/10 rounded-lg px-4 py-3 text-[15px] text-white tracking-[-0.01px] leading-[1.6] placeholder:text-white/40 focus:border-framer-blue focus:outline-none transition-colors ${
            error ? "border-red-500" : ""
          } ${className}`}
          {...props}
        />
        {error && (
          <span className="text-[12px] text-red-400">{error}</span>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
```

- [ ] **Step 11: Create login page**

Create `src/app/(auth)/login/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("이메일 또는 비밀번호가 올바르지 않습니다.");
      return;
    }

    router.push("/today");
    router.refresh();
  }

  return (
    <main className="flex items-center justify-center min-h-screen px-4">
      <div className="w-full max-w-[400px]">
        <h1 className="text-[32px] font-semibold tracking-[-1px] leading-[1.13] text-center mb-2">
          로그인
        </h1>
        <p className="text-muted-silver text-[15px] tracking-[-0.01px] leading-[1.6] text-center mb-8">
          매일 영어 루틴을 시작하세요
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="이메일"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@example.com"
            required
          />
          <Input
            label="비밀번호"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="8자 이상"
            required
          />

          {error && (
            <p className="text-red-400 text-[13px] text-center">{error}</p>
          )}

          <Button type="submit" fullWidth disabled={loading}>
            {loading ? "로그인 중..." : "로그인"}
          </Button>
        </form>

        <div className="mt-6 flex flex-col items-center gap-3 text-[14px] text-muted-silver">
          <Link href="/signup" className="text-framer-blue hover:underline">
            회원가입
          </Link>
          <Link href="/reset-password" className="hover:text-white transition-colors">
            비밀번호를 잊으셨나요?
          </Link>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 12: Create signup page**

Create `src/app/(auth)/signup/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error);
      setLoading(false);
      return;
    }

    // Auto login after signup
    await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    router.push("/today");
    router.refresh();
  }

  return (
    <main className="flex items-center justify-center min-h-screen px-4">
      <div className="w-full max-w-[400px]">
        <h1 className="text-[32px] font-semibold tracking-[-1px] leading-[1.13] text-center mb-2">
          회원가입
        </h1>
        <p className="text-muted-silver text-[15px] tracking-[-0.01px] leading-[1.6] text-center mb-8">
          무료로 시작하세요
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="이름"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="홍길동"
          />
          <Input
            label="이메일"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@example.com"
            required
          />
          <Input
            label="비밀번호"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="8자 이상"
            required
            minLength={8}
          />

          {error && (
            <p className="text-red-400 text-[13px] text-center">{error}</p>
          )}

          <Button type="submit" fullWidth disabled={loading}>
            {loading ? "가입 중..." : "가입하기"}
          </Button>
        </form>

        <p className="mt-6 text-[14px] text-muted-silver text-center">
          이미 계정이 있으신가요?{" "}
          <Link href="/login" className="text-framer-blue hover:underline">
            로그인
          </Link>
        </p>
      </div>
    </main>
  );
}
```

- [ ] **Step 13: Create reset password page**

Create `src/app/(auth)/reset-password/page.tsx`:

```tsx
"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRequest(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error);
      return;
    }

    setMessage("비밀번호 재설정 링크가 이메일로 전송되었습니다.");
  }

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    const res = await fetch("/api/auth/reset-password/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error);
      return;
    }

    setMessage("비밀번호가 변경되었습니다. 로그인해주세요.");
  }

  if (token) {
    return (
      <form onSubmit={handleConfirm} className="flex flex-col gap-4">
        <Input
          label="새 비밀번호"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="8자 이상"
          required
          minLength={8}
        />
        {error && <p className="text-red-400 text-[13px] text-center">{error}</p>}
        {message && <p className="text-green-400 text-[13px] text-center">{message}</p>}
        <Button type="submit" fullWidth disabled={loading}>
          {loading ? "변경 중..." : "비밀번호 변경"}
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={handleRequest} className="flex flex-col gap-4">
      <Input
        label="가입한 이메일"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="email@example.com"
        required
      />
      {error && <p className="text-red-400 text-[13px] text-center">{error}</p>}
      {message && <p className="text-green-400 text-[13px] text-center">{message}</p>}
      <Button type="submit" fullWidth disabled={loading}>
        {loading ? "전송 중..." : "재설정 링크 보내기"}
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="flex items-center justify-center min-h-screen px-4">
      <div className="w-full max-w-[400px]">
        <h1 className="text-[32px] font-semibold tracking-[-1px] leading-[1.13] text-center mb-2">
          비밀번호 재설정
        </h1>
        <p className="text-muted-silver text-[15px] tracking-[-0.01px] leading-[1.6] text-center mb-8">
          가입한 이메일로 재설정 링크를 보내드립니다
        </p>

        <Suspense fallback={<div className="text-center text-muted-silver">로딩 중...</div>}>
          <ResetPasswordForm />
        </Suspense>

        <p className="mt-6 text-[14px] text-muted-silver text-center">
          <Link href="/login" className="text-framer-blue hover:underline">
            로그인으로 돌아가기
          </Link>
        </p>
      </div>
    </main>
  );
}
```

- [ ] **Step 14: Verify auth flow works**

```bash
cd /var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines
pnpm dev
```

Test manually:
1. Visit `/signup` — create account
2. Auto-redirected to `/today` (should show 404 for now, but redirect works)
3. Visit `/login` — login with created account
4. Visit `/admin` — should redirect to `/login` for non-admin, show page for admin

- [ ] **Step 15: Commit**

```bash
cd /var/www/html/_______site_SORITUNECOM_ROUTINES
git add public_html/routines/src/lib/auth.ts public_html/routines/src/lib/auth-helpers.ts public_html/routines/src/types/ public_html/routines/src/app/api/auth/ public_html/routines/middleware.ts public_html/routines/src/app/\(auth\)/ public_html/routines/src/components/ui/
git commit -m "feat: add NextAuth.js authentication with signup, login, reset-password"
```

---

## Task 4: Content System

**Files:**
- Create: `public_html/routines/src/lib/date.ts`
- Create: `public_html/routines/src/app/api/content/today/route.ts`
- Create: `public_html/routines/src/app/api/content/route.ts`
- Create: `public_html/routines/src/app/api/content/[id]/route.ts`
- Create: `public_html/routines/src/components/ui/card.tsx`
- Create: `public_html/routines/src/components/nav.tsx`
- Create: `public_html/routines/src/app/(main)/layout.tsx`
- Create: `public_html/routines/src/app/(main)/today/page.tsx`
- Create: `public_html/routines/src/app/(main)/archive/page.tsx`
- Modify: `public_html/routines/src/app/page.tsx`

- [ ] **Step 1: Create KST date helpers**

Create `src/lib/date.ts`:

```ts
export function nowKST(): Date {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" })
  );
}

export function todayKST(): Date {
  const now = nowKST();
  now.setHours(0, 0, 0, 0);
  return now;
}

export function yesterdayKST(): Date {
  const d = todayKST();
  d.setDate(d.getDate() - 1);
  return d;
}

export function isSameDateKST(a: Date, b: Date): boolean {
  const aKST = new Date(a.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  const bKST = new Date(b.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  return (
    aKST.getFullYear() === bKST.getFullYear() &&
    aKST.getMonth() === bKST.getMonth() &&
    aKST.getDate() === bKST.getDate()
  );
}

export function formatDateKST(date: Date): string {
  return new Date(date.toLocaleString("en-US", { timeZone: "Asia/Seoul" }))
    .toISOString()
    .split("T")[0];
}
```

- [ ] **Step 2: Create content APIs**

Create `src/app/api/content/today/route.ts`:

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { todayKST } from "@/lib/date";

export async function GET() {
  const today = todayKST();

  const content = await prisma.content.findFirst({
    where: {
      publishedAt: today,
      isActive: true,
    },
    orderBy: { priority: "desc" },
  });

  if (!content) {
    return NextResponse.json({ error: "No content for today" }, { status: 404 });
  }

  return NextResponse.json(content);
}
```

Create `src/app/api/content/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";

export async function GET(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  const page = parseInt(req.nextUrl.searchParams.get("page") || "1");
  const limit = 20;

  const [contents, total] = await Promise.all([
    prisma.content.findMany({
      where: { isActive: true, publishedAt: { not: null } },
      select: {
        id: true,
        genre: true,
        title: true,
        subtitle: true,
        keyPhrase: true,
        keyKo: true,
        publishedAt: true,
      },
      orderBy: { publishedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.content.count({
      where: { isActive: true, publishedAt: { not: null } },
    }),
  ]);

  return NextResponse.json({
    contents,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}
```

Create `src/app/api/content/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  const content = await prisma.content.findUnique({
    where: { id: parseInt(id), isActive: true },
  });

  if (!content) {
    return NextResponse.json({ error: "Content not found" }, { status: 404 });
  }

  return NextResponse.json(content);
}
```

- [ ] **Step 3: Create Card UI component**

Create `src/components/ui/card.tsx`:

```tsx
import { HTMLAttributes, forwardRef } from "react";

type Variant = "surface" | "elevated";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: Variant;
}

const variantStyles: Record<Variant, string> = {
  surface: "bg-near-black shadow-ring-blue rounded-xl",
  elevated: "bg-near-black shadow-elevated rounded-xl",
};

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant = "surface", className = "", children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`p-6 ${variantStyles[variant]} ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = "Card";
```

- [ ] **Step 4: Create navigation component**

Create `src/components/nav.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

export function Nav() {
  const { data: session } = useSession();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-void-black/80 backdrop-blur-sm border-b border-white/5">
      <div className="max-w-container mx-auto px-6 h-16 flex items-center justify-between">
        <Link
          href="/"
          className="text-[20px] font-semibold tracking-[-0.8px] text-white"
        >
          Routines
        </Link>

        <div className="flex items-center gap-6">
          {session?.user ? (
            <>
              <Link
                href="/today"
                className="text-[15px] font-medium text-white/80 hover:text-white tracking-[-0.15px] transition-colors"
              >
                오늘의 학습
              </Link>
              <Link
                href="/archive"
                className="text-[15px] font-medium text-white/80 hover:text-white tracking-[-0.15px] transition-colors"
              >
                아카이브
              </Link>
              <Link
                href="/profile"
                className="text-[15px] font-medium text-white/80 hover:text-white tracking-[-0.15px] transition-colors"
              >
                프로필
              </Link>
              {session.user.role === "admin" && (
                <Link
                  href="/admin"
                  className="text-[15px] font-medium text-framer-blue tracking-[-0.15px]"
                >
                  관리자
                </Link>
              )}
              <Button
                variant="ghost"
                className="text-[13px] px-3 py-2"
                onClick={() => signOut({ callbackUrl: "/" })}
              >
                로그아웃
              </Button>
            </>
          ) : (
            <Link href="/login">
              <Button variant="frosted" className="text-[13px] px-4 py-2">
                로그인
              </Button>
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
```

- [ ] **Step 5: Create SessionProvider wrapper and main layout**

Create `src/components/session-provider.tsx`:

```tsx
"use client";

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";

export function SessionProvider({ children }: { children: React.ReactNode }) {
  return <NextAuthSessionProvider>{children}</NextAuthSessionProvider>;
}
```

Update `src/app/layout.tsx` to wrap with SessionProvider:

```tsx
import type { Metadata } from "next";
import { SessionProvider } from "@/components/session-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Routines — Daily English Routine",
  description: "매일 하나의 영어 콘텐츠로 학습 루틴을 만드세요",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css"
        />
      </head>
      <body className="font-pretendard bg-void-black text-white min-h-screen">
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
```

Create `src/app/(main)/layout.tsx`:

```tsx
import { Nav } from "@/components/nav";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Nav />
      <main className="pt-16 min-h-screen">{children}</main>
    </>
  );
}
```

- [ ] **Step 6: Create today's content page**

Create `src/components/step-card.tsx`:

```tsx
type StepStatus = "locked" | "active" | "completed" | "skipped";

interface StepCardProps {
  label: string;
  description: string;
  status: StepStatus;
  href?: string;
}

const statusStyles: Record<StepStatus, string> = {
  locked: "opacity-40 cursor-not-allowed",
  active: "shadow-ring-blue cursor-pointer hover:bg-white/5",
  completed: "border border-green-500/30 bg-green-500/5",
  skipped: "border border-yellow-500/30 bg-yellow-500/5 opacity-70",
};

export function StepCard({ label, description, status, href }: StepCardProps) {
  const Wrapper = status === "active" && href ? "a" : "div";
  const wrapperProps = status === "active" && href ? { href } : {};

  return (
    <Wrapper
      {...wrapperProps}
      className={`block bg-near-black rounded-xl p-5 transition-all ${statusStyles[status]}`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[15px] font-medium text-white tracking-[-0.15px]">
          {label}
        </span>
        {status === "completed" && (
          <span className="text-green-400 text-[13px]">&#10003; 완료</span>
        )}
        {status === "skipped" && (
          <span className="text-yellow-400 text-[13px]">건너뜀</span>
        )}
        {status === "locked" && (
          <span className="text-white/30 text-[13px]">&#128274;</span>
        )}
      </div>
      <p className="text-[13px] text-muted-silver leading-[1.6]">
        {description}
      </p>
    </Wrapper>
  );
}
```

Create `src/app/(main)/today/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Card } from "@/components/ui/card";
import { StepCard } from "@/components/step-card";

interface Content {
  id: number;
  title: string;
  subtitle: string;
  genre: string;
  keyPhrase: string;
  keyKo: string;
}

interface Progress {
  step: string;
  completed: boolean;
  skipped: boolean;
}

const STEPS = [
  { key: "reading", label: "읽기", description: "오늘의 콘텐츠를 읽어보세요" },
  { key: "listening", label: "듣기", description: "문장을 들어보세요" },
  { key: "expressions", label: "표현", description: "핵심 표현을 학습하세요" },
  { key: "quiz", label: "퀴즈", description: "배운 표현을 테스트하세요" },
  { key: "interview", label: "AI 인터뷰", description: "AI와 영어로 대화하세요" },
  { key: "speaking", label: "말하기", description: "직접 발음해보세요" },
];

export default function TodayPage() {
  const { data: session } = useSession();
  const [content, setContent] = useState<Content | null>(null);
  const [progress, setProgress] = useState<Progress[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [contentRes, progressRes] = await Promise.all([
        fetch("/api/content/today"),
        fetch("/api/progress"),
      ]);

      if (contentRes.ok) {
        const contentData = await contentRes.json();
        setContent(contentData);

        if (progressRes.ok) {
          const progressData = await progressRes.json();
          const contentProgress = progressData.filter(
            (p: Progress & { contentId: number }) => p.contentId === contentData.id
          );
          setProgress(contentProgress);
        }
      }
      setLoading(false);
    }

    if (session?.user) load();
  }, [session]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-silver">로딩 중...</p>
      </div>
    );
  }

  if (!content) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-silver">오늘의 콘텐츠가 아직 없습니다.</p>
      </div>
    );
  }

  function getStepStatus(stepKey: string, index: number) {
    const p = progress.find((pr) => pr.step === stepKey);
    if (p?.completed) return "completed" as const;
    if (p?.skipped) return "skipped" as const;

    // First incomplete step is active
    const firstIncomplete = STEPS.findIndex((s) => {
      const sp = progress.find((pr) => pr.step === s.key);
      return !sp?.completed && !sp?.skipped;
    });

    if (index === firstIncomplete) return "active" as const;
    return "locked" as const;
  }

  const allDone = STEPS.every((s) => {
    const p = progress.find((pr) => pr.step === s.key);
    return p?.completed || p?.skipped;
  });

  return (
    <div className="max-w-container mx-auto px-6 py-12">
      <div className="mb-10">
        <span className="text-[12px] font-semibold text-framer-blue tracking-[2px] uppercase">
          {content.genre}
        </span>
        <h1 className="text-[62px] font-bold tracking-[-3.1px] leading-[1] mt-2 mb-3">
          {content.title}
        </h1>
        {content.subtitle && (
          <p className="text-[18px] text-muted-silver tracking-[-0.01px] leading-[1.6]">
            {content.subtitle}
          </p>
        )}
        <Card variant="surface" className="mt-6 inline-block">
          <p className="text-[15px]">
            <span className="text-framer-blue font-medium">{content.keyPhrase}</span>
            <span className="text-muted-silver ml-3">{content.keyKo}</span>
          </p>
        </Card>
      </div>

      <div className="grid gap-3">
        {STEPS.map((step, i) => (
          <StepCard
            key={step.key}
            label={step.label}
            description={step.description}
            status={allDone ? "completed" : getStepStatus(step.key, i)}
            href={
              getStepStatus(step.key, i) === "active"
                ? `/learn/${content.id}/${step.key}`
                : undefined
            }
          />
        ))}
      </div>

      {allDone && (
        <div className="mt-8 text-center">
          <a
            href={`/learn/${content.id}/complete`}
            className="inline-block bg-white text-black px-8 py-4 rounded-pill text-[15px] font-medium hover:opacity-90 transition-opacity"
          >
            오늘의 학습 완료! 🎉
          </a>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 7: Create archive page**

Create `src/app/(main)/archive/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Card } from "@/components/ui/card";
import Link from "next/link";

interface ContentItem {
  id: number;
  genre: string;
  title: string;
  subtitle: string;
  keyPhrase: string;
  keyKo: string;
  publishedAt: string;
}

export default function ArchivePage() {
  const { data: session } = useSession();
  const [contents, setContents] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);

  const isSubscriber = session?.user?.subscriptionStatus === "active";

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/content");
      if (res.ok) {
        const data = await res.json();
        setContents(data.contents);
      }
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-silver">로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="max-w-container mx-auto px-6 py-12">
      <h1 className="text-[32px] font-semibold tracking-[-1px] leading-[1.13] mb-8">
        아카이브
      </h1>

      <div className="grid gap-4">
        {contents.map((content) => {
          const isToday =
            content.publishedAt &&
            new Date(content.publishedAt).toDateString() === new Date().toDateString();

          return (
            <div key={content.id} className="relative">
              <Link href={isToday || isSubscriber ? `/learn/${content.id}/reading` : "#"}>
                <Card
                  variant="surface"
                  className={`transition-all ${
                    !isToday && !isSubscriber ? "opacity-60" : "hover:bg-white/5"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[12px] text-framer-blue font-medium tracking-[1px] uppercase">
                        {content.genre}
                      </span>
                      <h2 className="text-[20px] font-semibold tracking-[-0.8px] leading-[1.2] mt-1">
                        {content.title}
                      </h2>
                      {content.subtitle && (
                        <p className="text-[14px] text-muted-silver mt-1 leading-[1.4]">
                          {content.subtitle}
                        </p>
                      )}
                    </div>
                    <span className="text-[12px] text-muted-silver shrink-0 ml-4">
                      {content.publishedAt?.split("T")[0]}
                    </span>
                  </div>
                </Card>
              </Link>

              {!isToday && !isSubscriber && (
                <div className="absolute inset-0 flex items-center justify-center bg-void-black/60 rounded-xl">
                  <div className="text-center">
                    <p className="text-[14px] text-white/80 mb-2">구독 회원 전용 콘텐츠</p>
                    <span className="text-[13px] text-framer-blue">구독하기 →</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Update landing page with today's content preview**

Replace `src/app/page.tsx`:

```tsx
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { todayKST } from "@/lib/date";
import { Nav } from "@/components/nav";
import { Button } from "@/components/ui/button";

export default async function Home() {
  const today = todayKST();
  const content = await prisma.content.findFirst({
    where: { publishedAt: today, isActive: true },
    orderBy: { priority: "desc" },
    select: { title: true, subtitle: true, genre: true, keyPhrase: true, keyKo: true },
  });

  return (
    <>
      <Nav />
      <main className="flex flex-col items-center justify-center min-h-screen px-6">
        <h1 className="text-[110px] font-bold leading-[0.85] tracking-[-5.5px] text-white text-center max-md:text-[62px] max-md:tracking-[-3.1px]">
          Routines
        </h1>
        <p className="mt-6 text-[18px] text-muted-silver tracking-[-0.01px] leading-[1.6] text-center">
          매일 하나의 영어 콘텐츠로 학습 루틴을 만드세요
        </p>

        {content && (
          <div className="mt-12 bg-near-black shadow-ring-blue rounded-xl p-8 max-w-[600px] w-full text-center">
            <span className="text-[12px] font-semibold text-framer-blue tracking-[2px] uppercase">
              오늘의 콘텐츠
            </span>
            <h2 className="text-[24px] font-semibold tracking-[-0.01px] leading-[1.3] mt-3">
              {content.title}
            </h2>
            {content.subtitle && (
              <p className="text-[15px] text-muted-silver mt-2 leading-[1.6]">
                {content.subtitle}
              </p>
            )}
            <p className="mt-4 text-[15px]">
              <span className="text-framer-blue">{content.keyPhrase}</span>
              <span className="text-muted-silver ml-2">{content.keyKo}</span>
            </p>
          </div>
        )}

        <Link href="/signup" className="mt-10">
          <Button>무료로 시작하기</Button>
        </Link>
      </main>
    </>
  );
}
```

- [ ] **Step 9: Verify content system**

```bash
cd /var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines
pnpm dev
```

Test:
1. Landing page shows today's content preview
2. `/api/content/today` returns seed content
3. After login, `/today` shows 6 step cards
4. `/archive` shows content list with lock UI for non-subscribers

- [ ] **Step 10: Commit**

```bash
cd /var/www/html/_______site_SORITUNECOM_ROUTINES
git add public_html/routines/src/
git commit -m "feat: add content system with today's content, archive, and navigation"
```

---

## Task 5: Learning Flow (6 Steps)

**Files:**
- Create: `public_html/routines/src/app/api/progress/route.ts`
- Create: `public_html/routines/src/app/api/progress/[contentId]/route.ts`
- Create: `public_html/routines/src/contexts/speech-context.tsx`
- Create: `public_html/routines/src/lib/string-similarity.ts`
- Create: `public_html/routines/src/app/(main)/learn/[contentId]/layout.tsx`
- Create: `public_html/routines/src/app/(main)/learn/[contentId]/reading/page.tsx`
- Create: `public_html/routines/src/app/(main)/learn/[contentId]/listening/page.tsx`
- Create: `public_html/routines/src/app/(main)/learn/[contentId]/expressions/page.tsx`
- Create: `public_html/routines/src/app/(main)/learn/[contentId]/quiz/page.tsx`
- Create: `public_html/routines/src/app/(main)/learn/[contentId]/interview/page.tsx`
- Create: `public_html/routines/src/app/(main)/learn/[contentId]/speaking/page.tsx`
- Create: `public_html/routines/src/app/(main)/learn/[contentId]/complete/page.tsx`
- Create: `public_html/routines/src/components/learning/reading-view.tsx`
- Create: `public_html/routines/src/components/learning/listening-player.tsx`
- Create: `public_html/routines/src/components/learning/expression-list.tsx`
- Create: `public_html/routines/src/components/learning/quiz-form.tsx`
- Create: `public_html/routines/src/components/learning/interview-chat.tsx`
- Create: `public_html/routines/src/components/learning/speaking-recorder.tsx`

This is the largest task. Steps proceed component by component.

- [ ] **Step 1: Create progress API**

Create `src/app/api/progress/route.ts`:

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";

export async function GET() {
  const { error, session } = await requireAuth();
  if (error) return error;

  const progress = await prisma.userProgress.findMany({
    where: { userId: session!.user.id },
    select: {
      contentId: true,
      step: true,
      completed: true,
      skipped: true,
      score: true,
      completedAt: true,
    },
  });

  return NextResponse.json(progress);
}
```

Create `src/app/api/progress/[contentId]/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { todayKST, yesterdayKST, isSameDateKST } from "@/lib/date";
import { LearningStep } from "@prisma/client";

const ALL_STEPS: LearningStep[] = [
  "reading", "listening", "expressions", "quiz", "interview", "speaking",
];

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ contentId: string }> }
) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const { contentId } = await params;

  const progress = await prisma.userProgress.findMany({
    where: {
      userId: session!.user.id,
      contentId: parseInt(contentId),
    },
  });

  return NextResponse.json(progress);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ contentId: string }> }
) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const { contentId } = await params;
  const { step, score, skipped } = await req.json() as {
    step: LearningStep;
    score?: number;
    skipped?: boolean;
  };

  if (!ALL_STEPS.includes(step)) {
    return NextResponse.json({ error: "Invalid step" }, { status: 400 });
  }

  const userId = session!.user.id;
  const cId = parseInt(contentId);

  // Upsert progress (idempotent)
  await prisma.userProgress.upsert({
    where: {
      userId_contentId_step: { userId, contentId: cId, step },
    },
    update: {},  // No update if already exists — idempotent
    create: {
      userId,
      contentId: cId,
      step,
      completed: !skipped,
      skipped: skipped || false,
      score: score ?? null,
      completedAt: new Date(),
    },
  });

  // Check if all 6 steps are done
  const allProgress = await prisma.userProgress.findMany({
    where: { userId, contentId: cId },
  });

  const allDone = ALL_STEPS.every((s) => {
    const p = allProgress.find((pr) => pr.step === s);
    return p && (p.completed || p.skipped);
  });

  if (allDone) {
    // Update streak in a transaction with row lock
    await prisma.$transaction(async (tx) => {
      // Re-verify all steps inside transaction
      const verified = await tx.userProgress.findMany({
        where: { userId, contentId: cId },
      });
      const verifiedDone = ALL_STEPS.every((s) => {
        const p = verified.find((pr) => pr.step === s);
        return p && (p.completed || p.skipped);
      });
      if (!verifiedDone) return;

      // Get or create streak with row-level lock (SELECT ... FOR UPDATE)
      const streakRows = await tx.$queryRaw<Array<{
        id: number;
        user_id: string;
        current_streak: number;
        longest_streak: number;
        last_completed: Date | null;
      }>>`SELECT * FROM streaks WHERE user_id = ${userId} FOR UPDATE`;

      let streak = streakRows[0];
      if (!streak) {
        await tx.streak.create({
          data: { userId, currentStreak: 0, longestStreak: 0 },
        });
        const newRows = await tx.$queryRaw<typeof streakRows>`SELECT * FROM streaks WHERE user_id = ${userId} FOR UPDATE`;
        streak = newRows[0];
      }

      const today = todayKST();
      const yesterday = yesterdayKST();

      if (streak.last_completed && isSameDateKST(streak.last_completed, today)) {
        // Already completed today — no change (idempotent)
        return;
      }

      let newStreak: number;
      if (streak.last_completed && isSameDateKST(streak.last_completed, yesterday)) {
        newStreak = streak.current_streak + 1;
      } else {
        newStreak = 1;
      }

      await tx.streak.update({
        where: { userId },
        data: {
          currentStreak: newStreak,
          longestStreak: Math.max(newStreak, streak.longest_streak),
          lastCompleted: today,
        },
      });

      // Record complete event
      await tx.analyticsEvent.create({
        data: { userId, type: "complete", contentId: cId },
      });
    });
  }

  return NextResponse.json({ success: true, allDone });
}
```

- [ ] **Step 2: Create Speech API context**

Create `src/contexts/speech-context.tsx`:

```tsx
"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

interface SpeechCapabilities {
  ttsAvailable: boolean;
  sttAvailable: boolean;
}

const SpeechContext = createContext<SpeechCapabilities>({
  ttsAvailable: false,
  sttAvailable: false,
});

export function SpeechProvider({ children }: { children: ReactNode }) {
  const [caps, setCaps] = useState<SpeechCapabilities>({
    ttsAvailable: false,
    sttAvailable: false,
  });

  useEffect(() => {
    setCaps({
      ttsAvailable: typeof window !== "undefined" && "speechSynthesis" in window,
      sttAvailable:
        typeof window !== "undefined" &&
        ("SpeechRecognition" in window || "webkitSpeechRecognition" in window),
    });
  }, []);

  return (
    <SpeechContext.Provider value={caps}>{children}</SpeechContext.Provider>
  );
}

export function useSpeech() {
  return useContext(SpeechContext);
}
```

- [ ] **Step 3: Create string similarity utility**

Create `src/lib/string-similarity.ts`:

```ts
export function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array(n + 1).fill(0)
  );

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }

  return dp[m][n];
}

export function similarityPercent(target: string, input: string): number {
  const a = target.toLowerCase().trim();
  const b = input.toLowerCase().trim();
  if (a === b) return 100;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 100;
  const dist = levenshteinDistance(a, b);
  return Math.round(((maxLen - dist) / maxLen) * 100);
}
```

- [ ] **Step 4: Create learning flow layout**

Create `src/app/(main)/learn/[contentId]/layout.tsx`:

```tsx
import { SpeechProvider } from "@/contexts/speech-context";

export default function LearnLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SpeechProvider>{children}</SpeechProvider>;
}
```

- [ ] **Step 5: Create reading step**

Create `src/components/learning/reading-view.tsx`:

```tsx
interface ReadingViewProps {
  paragraphs: string[];
  keyPhrase: string;
}

export function ReadingView({ paragraphs, keyPhrase }: ReadingViewProps) {
  return (
    <div className="space-y-6">
      {paragraphs.map((p, i) => {
        // Highlight key phrase in text
        const parts = p.split(new RegExp(`(${keyPhrase})`, "gi"));
        return (
          <p key={i} className="text-[15px] text-white/90 leading-[1.7] tracking-[-0.01px]">
            {parts.map((part, j) =>
              part.toLowerCase() === keyPhrase.toLowerCase() ? (
                <span key={j} className="text-framer-blue font-medium">
                  {part}
                </span>
              ) : (
                <span key={j}>{part}</span>
              )
            )}
          </p>
        );
      })}
    </div>
  );
}
```

Create `src/app/(main)/learn/[contentId]/reading/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ReadingView } from "@/components/learning/reading-view";
import { Button } from "@/components/ui/button";

interface Content {
  id: number;
  title: string;
  paragraphs: string[];
  keyPhrase: string;
  keyKo: string;
}

export default function ReadingPage() {
  const params = useParams();
  const router = useRouter();
  const contentId = params.contentId as string;
  const [content, setContent] = useState<Content | null>(null);

  useEffect(() => {
    fetch(`/api/content/${contentId}`)
      .then((r) => r.json())
      .then(setContent);
  }, [contentId]);

  async function handleComplete() {
    await fetch(`/api/progress/${contentId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: "reading" }),
    });
    router.push(`/learn/${contentId}/listening`);
  }

  if (!content) return <div className="p-6 text-muted-silver">로딩 중...</div>;

  return (
    <div className="max-w-[800px] mx-auto px-6 py-12">
      <span className="text-[12px] font-semibold text-framer-blue tracking-[2px] uppercase">
        Step 1 · 읽기
      </span>
      <h1 className="text-[32px] font-semibold tracking-[-1px] leading-[1.13] mt-2 mb-8">
        {content.title}
      </h1>

      <ReadingView paragraphs={content.paragraphs} keyPhrase={content.keyPhrase} />

      <div className="mt-6 bg-near-black shadow-ring-blue rounded-xl p-4">
        <p className="text-[15px]">
          <span className="text-framer-blue font-medium">{content.keyPhrase}</span>
          <span className="text-muted-silver ml-3">{content.keyKo}</span>
        </p>
      </div>

      <div className="mt-10 flex justify-end">
        <Button onClick={handleComplete}>다음: 듣기 →</Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Create listening step**

Create `src/components/learning/listening-player.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useSpeech } from "@/contexts/speech-context";
import { Button } from "@/components/ui/button";

interface ListeningPlayerProps {
  sentences: string[];
}

export function ListeningPlayer({ sentences }: ListeningPlayerProps) {
  const { ttsAvailable } = useSpeech();
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);

  function speak(text: string, index: number) {
    if (!ttsAvailable) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 0.9;
    utterance.onstart = () => setPlayingIndex(index);
    utterance.onend = () => setPlayingIndex(null);
    window.speechSynthesis.speak(utterance);
  }

  function playAll() {
    if (!ttsAvailable) return;
    window.speechSynthesis.cancel();
    sentences.forEach((s, i) => {
      const utterance = new SpeechSynthesisUtterance(s);
      utterance.lang = "en-US";
      utterance.rate = 0.9;
      utterance.onstart = () => setPlayingIndex(i);
      if (i === sentences.length - 1) {
        utterance.onend = () => setPlayingIndex(null);
      }
      window.speechSynthesis.speak(utterance);
    });
  }

  if (!ttsAvailable) {
    return (
      <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 text-[14px] text-yellow-300 leading-[1.6]">
        이 브라우저에서는 음성 재생이 지원되지 않습니다. 아래 문장을 직접 읽어주세요.
      </div>
    );
  }

  return (
    <div>
      <Button variant="frosted" onClick={playAll} className="mb-6 text-[13px]">
        ▶ 전체 재생
      </Button>
      <div className="space-y-3">
        {sentences.map((s, i) => (
          <button
            key={i}
            onClick={() => speak(s, i)}
            className={`w-full text-left p-4 rounded-xl transition-all text-[15px] leading-[1.6] ${
              playingIndex === i
                ? "bg-framer-blue/10 shadow-ring-blue text-white"
                : "bg-near-black hover:bg-white/5 text-white/80"
            }`}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
```

Create `src/app/(main)/learn/[contentId]/listening/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSpeech } from "@/contexts/speech-context";
import { ListeningPlayer } from "@/components/learning/listening-player";
import { Button } from "@/components/ui/button";

export default function ListeningPage() {
  const params = useParams();
  const router = useRouter();
  const contentId = params.contentId as string;
  const { ttsAvailable } = useSpeech();
  const [sentences, setSentences] = useState<string[]>([]);

  useEffect(() => {
    fetch(`/api/content/${contentId}`)
      .then((r) => r.json())
      .then((data) => setSentences(data.sentences));
  }, [contentId]);

  async function handleComplete(skipped = false) {
    await fetch(`/api/progress/${contentId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: "listening", skipped }),
    });
    router.push(`/learn/${contentId}/expressions`);
  }

  if (!sentences.length) return <div className="p-6 text-muted-silver">로딩 중...</div>;

  return (
    <div className="max-w-[800px] mx-auto px-6 py-12">
      <span className="text-[12px] font-semibold text-framer-blue tracking-[2px] uppercase">
        Step 2 · 듣기
      </span>
      <h2 className="text-[32px] font-semibold tracking-[-1px] leading-[1.13] mt-2 mb-8">
        문장을 들어보세요
      </h2>

      <ListeningPlayer sentences={sentences} />

      <div className="mt-10 flex justify-end gap-3">
        {!ttsAvailable && (
          <Button variant="ghost" onClick={() => handleComplete(true)}>
            건너뛰기
          </Button>
        )}
        <Button onClick={() => handleComplete(false)}>다음: 표현 →</Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Create expressions step**

Create `src/components/learning/expression-list.tsx`:

```tsx
"use client";

import { useSpeech } from "@/contexts/speech-context";

interface Expression {
  expression: string;
  meaning: string;
  explanation: string;
  example: string;
}

interface ExpressionListProps {
  expressions: Expression[];
}

export function ExpressionList({ expressions }: ExpressionListProps) {
  const { ttsAvailable } = useSpeech();

  function speak(text: string) {
    if (!ttsAvailable) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    u.rate = 0.9;
    window.speechSynthesis.speak(u);
  }

  return (
    <div className="space-y-4">
      {expressions.map((exp, i) => (
        <div key={i} className="bg-near-black shadow-ring-blue rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[20px] font-semibold text-framer-blue tracking-[-0.8px]">
              {exp.expression}
            </h3>
            {ttsAvailable && (
              <button
                onClick={() => speak(exp.expression)}
                className="text-white/40 hover:text-white text-[18px] transition-colors"
                title="발음 듣기"
              >
                🔊
              </button>
            )}
          </div>
          <p className="text-[15px] text-white leading-[1.6] mb-1">{exp.meaning}</p>
          <p className="text-[14px] text-muted-silver leading-[1.7] mb-3">{exp.explanation}</p>
          <div className="bg-void-black rounded-lg p-3">
            <p className="text-[14px] text-white/80 leading-[1.6] italic">"{exp.example}"</p>
          </div>
        </div>
      ))}
    </div>
  );
}
```

Create `src/app/(main)/learn/[contentId]/expressions/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ExpressionList } from "@/components/learning/expression-list";
import { Button } from "@/components/ui/button";

interface Expression {
  expression: string;
  meaning: string;
  explanation: string;
  example: string;
}

export default function ExpressionsPage() {
  const params = useParams();
  const router = useRouter();
  const contentId = params.contentId as string;
  const [expressions, setExpressions] = useState<Expression[]>([]);

  useEffect(() => {
    fetch(`/api/content/${contentId}`)
      .then((r) => r.json())
      .then((data) => setExpressions(data.expressions));
  }, [contentId]);

  async function handleComplete() {
    await fetch(`/api/progress/${contentId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: "expressions" }),
    });
    router.push(`/learn/${contentId}/quiz`);
  }

  if (!expressions.length) return <div className="p-6 text-muted-silver">로딩 중...</div>;

  return (
    <div className="max-w-[800px] mx-auto px-6 py-12">
      <span className="text-[12px] font-semibold text-framer-blue tracking-[2px] uppercase">
        Step 3 · 표현
      </span>
      <h2 className="text-[32px] font-semibold tracking-[-1px] leading-[1.13] mt-2 mb-8">
        핵심 표현을 학습하세요
      </h2>

      <ExpressionList expressions={expressions} />

      <div className="mt-10 flex justify-end">
        <Button onClick={handleComplete}>다음: 퀴즈 →</Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Create quiz step**

Create `src/components/learning/quiz-form.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";

interface QuizItem {
  question: string;
  answer: string;
  hint: string;
}

interface QuizFormProps {
  items: QuizItem[];
  onComplete: (score: number) => void;
}

export function QuizForm({ items, onComplete }: QuizFormProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState("");
  const [showResult, setShowResult] = useState(false);
  const [correct, setCorrect] = useState(0);
  const [isCorrect, setIsCorrect] = useState(false);

  const current = items[currentIndex];
  const isLast = currentIndex === items.length - 1;

  function handleCheck() {
    const match =
      userAnswer.trim().toLowerCase() === current.answer.toLowerCase();
    setIsCorrect(match);
    if (match) setCorrect((c) => c + 1);
    setShowResult(true);
  }

  function handleNext() {
    if (isLast) {
      const finalCorrect = correct + (isCorrect ? 0 : 0); // already counted
      const score = Math.round((finalCorrect / items.length) * 100);
      onComplete(score);
      return;
    }
    setCurrentIndex((i) => i + 1);
    setUserAnswer("");
    setShowResult(false);
    setIsCorrect(false);
  }

  // Render question with blank
  const parts = current.question.split("_____");

  return (
    <div>
      <div className="mb-2 text-[13px] text-muted-silver">
        {currentIndex + 1} / {items.length}
      </div>

      <div className="bg-near-black shadow-ring-blue rounded-xl p-6 mb-6">
        <p className="text-[18px] text-white leading-[1.6]">
          {parts[0]}
          <span className="text-framer-blue border-b-2 border-framer-blue px-1">
            {showResult ? current.answer : "______"}
          </span>
          {parts[1]}
        </p>
        {!showResult && (
          <p className="text-[13px] text-muted-silver mt-3">힌트: {current.hint}</p>
        )}
      </div>

      {!showResult ? (
        <div className="flex gap-3">
          <Input
            value={userAnswer}
            onChange={(e) => setUserAnswer(e.target.value)}
            placeholder="답을 입력하세요"
            onKeyDown={(e) => e.key === "Enter" && userAnswer.trim() && handleCheck()}
            className="flex-1"
          />
          <button
            onClick={handleCheck}
            disabled={!userAnswer.trim()}
            className="bg-white text-black px-6 py-3 rounded-pill text-[15px] font-medium disabled:opacity-50 transition-opacity"
          >
            확인
          </button>
        </div>
      ) : (
        <div>
          <div
            className={`rounded-xl p-4 mb-4 ${
              isCorrect
                ? "bg-green-500/10 border border-green-500/20"
                : "bg-red-500/10 border border-red-500/20"
            }`}
          >
            <p className={`text-[15px] font-medium ${isCorrect ? "text-green-400" : "text-red-400"}`}>
              {isCorrect ? "정답입니다!" : `오답 — 정답: ${current.answer}`}
            </p>
          </div>
          <button
            onClick={handleNext}
            className="bg-white text-black px-6 py-3 rounded-pill text-[15px] font-medium hover:opacity-90 transition-opacity"
          >
            {isLast ? "완료" : "다음 문제"}
          </button>
        </div>
      )}
    </div>
  );
}
```

Create `src/app/(main)/learn/[contentId]/quiz/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { QuizForm } from "@/components/learning/quiz-form";

interface QuizItem {
  question: string;
  answer: string;
  hint: string;
}

export default function QuizPage() {
  const params = useParams();
  const router = useRouter();
  const contentId = params.contentId as string;
  const [quiz, setQuiz] = useState<QuizItem[]>([]);

  useEffect(() => {
    fetch(`/api/content/${contentId}`)
      .then((r) => r.json())
      .then((data) => setQuiz(data.quiz));
  }, [contentId]);

  async function handleComplete(score: number) {
    await fetch(`/api/progress/${contentId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: "quiz", score }),
    });
    router.push(`/learn/${contentId}/interview`);
  }

  if (!quiz.length) return <div className="p-6 text-muted-silver">로딩 중...</div>;

  return (
    <div className="max-w-[800px] mx-auto px-6 py-12">
      <span className="text-[12px] font-semibold text-framer-blue tracking-[2px] uppercase">
        Step 4 · 퀴즈
      </span>
      <h2 className="text-[32px] font-semibold tracking-[-1px] leading-[1.13] mt-2 mb-8">
        배운 표현을 테스트하세요
      </h2>

      <QuizForm items={quiz} onComplete={handleComplete} />
    </div>
  );
}
```

- [ ] **Step 9: Create interview step (AI placeholder — full AI in Task 8)**

Create `src/components/learning/interview-chat.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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

export function InterviewChat({ questions, contentId, onComplete }: InterviewChatProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [loading, setLoading] = useState(false);

  const isLast = currentIndex === questions.length - 1;

  async function handleSubmit() {
    setLoading(true);
    setFeedback(null);

    const res = await fetch("/api/ai/interview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contentId: parseInt(contentId),
        question: questions[currentIndex],
        answer,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      setFeedback(data.feedback);
    } else {
      setFeedback({
        relevance: "피드백을 받을 수 없습니다.",
        grammar: "",
        nativeExpression: "",
        encouragement: "다음 질문으로 넘어가주세요.",
      });
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
    setFeedback(null);
  }

  return (
    <div>
      <div className="mb-2 text-[13px] text-muted-silver">
        {currentIndex + 1} / {questions.length}
      </div>

      <div className="bg-near-black shadow-ring-blue rounded-xl p-6 mb-6">
        <p className="text-[18px] text-white leading-[1.6]">{questions[currentIndex]}</p>
      </div>

      {!feedback ? (
        <div className="space-y-4">
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="영어로 답변을 작성하세요..."
            className="w-full bg-near-black border border-white/10 rounded-xl px-4 py-3 text-[15px] text-white leading-[1.6] placeholder:text-white/40 focus:border-framer-blue focus:outline-none min-h-[120px] resize-none"
          />
          <Button onClick={handleSubmit} disabled={!answer.trim() || loading}>
            {loading ? "분석 중..." : "제출"}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {feedback.relevance && (
            <div className="bg-near-black rounded-xl p-4">
              <p className="text-[13px] text-framer-blue font-medium mb-1">내용 적절성</p>
              <p className="text-[14px] text-white/80 leading-[1.6]">{feedback.relevance}</p>
            </div>
          )}
          {feedback.grammar && (
            <div className="bg-near-black rounded-xl p-4">
              <p className="text-[13px] text-framer-blue font-medium mb-1">문법 교정</p>
              <p className="text-[14px] text-white/80 leading-[1.6]">{feedback.grammar}</p>
            </div>
          )}
          {feedback.nativeExpression && (
            <div className="bg-near-black rounded-xl p-4">
              <p className="text-[13px] text-framer-blue font-medium mb-1">원어민 표현</p>
              <p className="text-[14px] text-white/80 leading-[1.6]">{feedback.nativeExpression}</p>
            </div>
          )}
          {feedback.encouragement && (
            <div className="bg-green-500/5 border border-green-500/10 rounded-xl p-4">
              <p className="text-[14px] text-green-300 leading-[1.6]">{feedback.encouragement}</p>
            </div>
          )}
          <Button onClick={handleNext}>
            {isLast ? "완료" : "다음 질문"}
          </Button>
        </div>
      )}
    </div>
  );
}
```

Create `src/app/(main)/learn/[contentId]/interview/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { InterviewChat } from "@/components/learning/interview-chat";

export default function InterviewPage() {
  const params = useParams();
  const router = useRouter();
  const contentId = params.contentId as string;
  const [questions, setQuestions] = useState<string[]>([]);

  useEffect(() => {
    fetch(`/api/content/${contentId}`)
      .then((r) => r.json())
      .then((data) => setQuestions(data.interview));
  }, [contentId]);

  async function handleComplete() {
    await fetch(`/api/progress/${contentId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: "interview" }),
    });
    router.push(`/learn/${contentId}/speaking`);
  }

  if (!questions.length) return <div className="p-6 text-muted-silver">로딩 중...</div>;

  return (
    <div className="max-w-[800px] mx-auto px-6 py-12">
      <span className="text-[12px] font-semibold text-framer-blue tracking-[2px] uppercase">
        Step 5 · AI 인터뷰
      </span>
      <h2 className="text-[32px] font-semibold tracking-[-1px] leading-[1.13] mt-2 mb-8">
        AI와 영어로 대화하세요
      </h2>

      <InterviewChat
        questions={questions}
        contentId={contentId}
        onComplete={handleComplete}
      />
    </div>
  );
}
```

- [ ] **Step 10: Create speaking step**

Create `src/components/learning/speaking-recorder.tsx`:

```tsx
"use client";

import { useState, useRef } from "react";
import { useSpeech } from "@/contexts/speech-context";
import { similarityPercent } from "@/lib/string-similarity";
import { Button } from "@/components/ui/button";

interface SpeakingRecorderProps {
  sentences: string[];
  onComplete: (avgScore: number) => void;
  onSkip: () => void;
}

export function SpeakingRecorder({ sentences, onComplete, onSkip }: SpeakingRecorderProps) {
  const { sttAvailable } = useSpeech();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [score, setScore] = useState<number | null>(null);
  const [scores, setScores] = useState<number[]>([]);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const current = sentences[currentIndex];
  const isLast = currentIndex === sentences.length - 1;

  function startRecording() {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const result = event.results[0][0].transcript;
      setTranscript(result);
      const s = similarityPercent(current, result);
      setScore(s);
      setScores((prev) => [...prev, s]);
    };

    recognition.onerror = () => {
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
    setTranscript("");
    setScore(null);
  }

  function stopRecording() {
    recognitionRef.current?.stop();
    setIsRecording(false);
  }

  function handleNext() {
    if (isLast) {
      const avg =
        scores.length > 0
          ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
          : 0;
      onComplete(avg);
      return;
    }
    setCurrentIndex((i) => i + 1);
    setTranscript("");
    setScore(null);
  }

  if (!sttAvailable) {
    return (
      <div>
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 text-[14px] text-yellow-300 leading-[1.6] mb-6">
          음성 인식을 사용할 수 없습니다. 이 단계를 건너뛸 수 있습니다.
        </div>
        <Button variant="frosted" onClick={onSkip}>
          건너뛰기
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-2 text-[13px] text-muted-silver">
        {currentIndex + 1} / {sentences.length}
      </div>

      <div className="bg-near-black shadow-ring-blue rounded-xl p-6 mb-6">
        <p className="text-[18px] text-white leading-[1.6]">{current}</p>
      </div>

      {!score ? (
        <div className="flex gap-3">
          <Button
            variant={isRecording ? "frosted" : "solid"}
            onClick={isRecording ? stopRecording : startRecording}
          >
            {isRecording ? "⏹ 중지" : "🎤 녹음 시작"}
          </Button>
          {transcript && (
            <p className="text-[14px] text-muted-silver self-center">{transcript}</p>
          )}
        </div>
      ) : (
        <div>
          <div className="bg-near-black rounded-xl p-5 mb-4">
            <p className="text-[13px] text-muted-silver mb-2">내 발음</p>
            <p className="text-[15px] text-white leading-[1.6] mb-3">{transcript}</p>
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-void-black rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-framer-blue rounded-full transition-all"
                  style={{ width: `${score}%` }}
                />
              </div>
              <span
                className={`text-[20px] font-semibold ${
                  score >= 80 ? "text-green-400" : score >= 50 ? "text-yellow-400" : "text-red-400"
                }`}
              >
                {score}%
              </span>
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="frosted" onClick={startRecording}>
              다시 시도
            </Button>
            <Button onClick={handleNext}>{isLast ? "완료" : "다음 문장"}</Button>
          </div>
        </div>
      )}
    </div>
  );
}
```

Create `src/app/(main)/learn/[contentId]/speaking/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { SpeakingRecorder } from "@/components/learning/speaking-recorder";

export default function SpeakingPage() {
  const params = useParams();
  const router = useRouter();
  const contentId = params.contentId as string;
  const [sentences, setSentences] = useState<string[]>([]);

  useEffect(() => {
    fetch(`/api/content/${contentId}`)
      .then((r) => r.json())
      .then((data) => setSentences(data.speakSentences));
  }, [contentId]);

  async function handleComplete(score: number) {
    const res = await fetch(`/api/progress/${contentId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: "speaking", score }),
    });
    const data = await res.json();
    if (data.allDone) {
      router.push(`/learn/${contentId}/complete`);
    } else {
      router.push(`/today`);
    }
  }

  async function handleSkip() {
    const res = await fetch(`/api/progress/${contentId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: "speaking", skipped: true }),
    });
    const data = await res.json();
    if (data.allDone) {
      router.push(`/learn/${contentId}/complete`);
    } else {
      router.push(`/today`);
    }
  }

  if (!sentences.length) return <div className="p-6 text-muted-silver">로딩 중...</div>;

  return (
    <div className="max-w-[800px] mx-auto px-6 py-12">
      <span className="text-[12px] font-semibold text-framer-blue tracking-[2px] uppercase">
        Step 6 · 말하기
      </span>
      <h2 className="text-[32px] font-semibold tracking-[-1px] leading-[1.13] mt-2 mb-8">
        직접 발음해보세요
      </h2>

      <SpeakingRecorder
        sentences={sentences}
        onComplete={handleComplete}
        onSkip={handleSkip}
      />
    </div>
  );
}
```

- [ ] **Step 11: Create complete page**

Create `src/app/(main)/learn/[contentId]/complete/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function CompletePage() {
  const { data: session } = useSession();
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    fetch("/api/streak")
      .then((r) => r.json())
      .then((data) => setStreak(data.currentStreak));
  }, []);

  return (
    <div className="max-w-[600px] mx-auto px-6 py-20 text-center">
      <div className="text-[80px] mb-6">🎉</div>
      <h1 className="text-[62px] font-bold tracking-[-3.1px] leading-[1] mb-4">
        완료!
      </h1>
      <p className="text-[18px] text-muted-silver leading-[1.6] mb-8">
        오늘의 학습을 모두 마쳤습니다
      </p>

      <div className="bg-near-black shadow-ring-blue rounded-xl p-8 mb-8 inline-block">
        <p className="text-[13px] text-muted-silver mb-2">연속 학습</p>
        <p className="text-[62px] font-bold text-framer-blue tracking-[-3.1px] leading-[1]">
          {streak}일
        </p>
      </div>

      <div className="flex flex-col items-center gap-3">
        <Button
          variant="frosted"
          onClick={() => {
            navigator.clipboard.writeText(
              `오늘도 Routines에서 영어 학습 완료! 🔥 ${streak}일 연속 달성! https://routines.soritune.com`
            );
            alert("링크가 복사되었습니다!");
          }}
        >
          학습 결과 공유하기
        </Button>
        <Link href="/today">
          <Button variant="ghost">돌아가기</Button>
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 12: Add Web Speech API type declarations**

Create `src/types/speech.d.ts`:

```ts
interface SpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  readonly length: number;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

interface Window {
  SpeechRecognition: new () => SpeechRecognition;
  webkitSpeechRecognition: new () => SpeechRecognition;
}
```

- [ ] **Step 13: Verify full learning flow**

```bash
cd /var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines
pnpm dev
```

Test: Login → `/today` → click Reading → progress through all 6 steps → complete page shows streak.

- [ ] **Step 14: Commit**

```bash
cd /var/www/html/_______site_SORITUNECOM_ROUTINES
git add public_html/routines/src/
git commit -m "feat: add 6-step learning flow with progress tracking and streak"
```

---

## Task 6: Streak & Profile

**Files:**
- Create: `public_html/routines/src/app/api/streak/route.ts`
- Create: `public_html/routines/src/components/streak-display.tsx`
- Create: `public_html/routines/src/app/(main)/profile/page.tsx`

- [ ] **Step 1: Create streak API**

Create `src/app/api/streak/route.ts`:

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";

export async function GET() {
  const { error, session } = await requireAuth();
  if (error) return error;

  let streak = await prisma.streak.findUnique({
    where: { userId: session!.user.id },
  });

  if (!streak) {
    streak = await prisma.streak.create({
      data: { userId: session!.user.id },
    });
  }

  return NextResponse.json({
    currentStreak: streak.currentStreak,
    longestStreak: streak.longestStreak,
    lastCompleted: streak.lastCompleted,
  });
}
```

- [ ] **Step 2: Create streak display component**

Create `src/components/streak-display.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";

export function StreakDisplay() {
  const [streak, setStreak] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/streak")
      .then((r) => r.json())
      .then((data) => setStreak(data.currentStreak))
      .catch(() => {});
  }, []);

  if (streak === null) return null;

  return (
    <div className="flex items-center gap-1.5 text-[13px] font-medium">
      <span className="text-orange-400">🔥</span>
      <span className="text-white">{streak}</span>
    </div>
  );
}
```

- [ ] **Step 3: Add streak to nav**

Modify `src/components/nav.tsx` — add StreakDisplay next to profile link inside the logged-in section:

Add import at top: `import { StreakDisplay } from "@/components/streak-display";`

Add `<StreakDisplay />` before the 로그아웃 button in the nav.

- [ ] **Step 4: Create profile page**

Create `src/app/(main)/profile/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Card } from "@/components/ui/card";

interface StreakInfo {
  currentStreak: number;
  longestStreak: number;
  lastCompleted: string | null;
}

interface ProgressItem {
  contentId: number;
  step: string;
  completed: boolean;
  skipped: boolean;
  score: number | null;
  completedAt: string;
}

export default function ProfilePage() {
  const { data: session } = useSession();
  const [streak, setStreak] = useState<StreakInfo | null>(null);
  const [progress, setProgress] = useState<ProgressItem[]>([]);

  useEffect(() => {
    Promise.all([
      fetch("/api/streak").then((r) => r.json()),
      fetch("/api/progress").then((r) => r.json()),
    ]).then(([s, p]) => {
      setStreak(s);
      setProgress(p);
    });
  }, []);

  // Count unique completed contents
  const completedContents = new Set(
    progress
      .filter((p) => p.completed || p.skipped)
      .map((p) => p.contentId)
  );

  return (
    <div className="max-w-container mx-auto px-6 py-12">
      <h1 className="text-[32px] font-semibold tracking-[-1px] leading-[1.13] mb-8">
        프로필
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
        <Card variant="surface">
          <p className="text-[13px] text-muted-silver mb-2">현재 스트릭</p>
          <p className="text-[32px] font-bold text-framer-blue tracking-[-1px]">
            {streak?.currentStreak ?? 0}일
          </p>
        </Card>
        <Card variant="surface">
          <p className="text-[13px] text-muted-silver mb-2">최장 스트릭</p>
          <p className="text-[32px] font-bold text-white tracking-[-1px]">
            {streak?.longestStreak ?? 0}일
          </p>
        </Card>
        <Card variant="surface">
          <p className="text-[13px] text-muted-silver mb-2">학습한 콘텐츠</p>
          <p className="text-[32px] font-bold text-white tracking-[-1px]">
            {completedContents.size}개
          </p>
        </Card>
      </div>

      <h2 className="text-[20px] font-semibold tracking-[-0.8px] mb-4">계정 정보</h2>
      <Card variant="surface">
        <div className="space-y-3 text-[15px]">
          <div className="flex justify-between">
            <span className="text-muted-silver">이메일</span>
            <span>{session?.user?.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-silver">이름</span>
            <span>{session?.user?.name || "-"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-silver">구독</span>
            <span className={session?.user?.subscriptionStatus === "active" ? "text-green-400" : "text-muted-silver"}>
              {session?.user?.subscriptionStatus === "active" ? "구독 중" : "무료"}
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
}
```

- [ ] **Step 5: Verify and commit**

Test: profile page shows streak stats, nav shows streak fire icon.

```bash
cd /var/www/html/_______site_SORITUNECOM_ROUTINES
git add public_html/routines/src/
git commit -m "feat: add streak API, profile page, and streak display in nav"
```

---

## Task 7: Admin Panel

**Files:**
- Create: `public_html/routines/src/app/api/admin/content/route.ts`
- Create: `public_html/routines/src/app/api/admin/content/[id]/route.ts`
- Create: `public_html/routines/src/app/api/admin/users/route.ts`
- Create: `public_html/routines/src/app/api/admin/dashboard/route.ts`
- Create: `public_html/routines/src/app/api/admin/ai-settings/route.ts`
- Create: `public_html/routines/src/app/api/admin/ai-settings/[id]/route.ts`
- Create: `public_html/routines/src/lib/encryption.ts`
- Create: `public_html/routines/src/components/admin/sidebar.tsx`
- Create: `public_html/routines/src/app/(admin)/admin/layout.tsx`
- Create: `public_html/routines/src/app/(admin)/admin/page.tsx`
- Create: `public_html/routines/src/app/(admin)/admin/content/page.tsx`
- Create: `public_html/routines/src/app/(admin)/admin/content/new/page.tsx`
- Create: `public_html/routines/src/app/(admin)/admin/content/[id]/edit/page.tsx`
- Create: `public_html/routines/src/app/(admin)/admin/users/page.tsx`
- Create: `public_html/routines/src/app/(admin)/admin/settings/page.tsx`

This is a large task. Each admin sub-page follows the same pattern: API route + page component. Implementation proceeds API-first, then UI.

- [ ] **Step 1: Create encryption utility for AI keys**

Create `src/lib/encryption.ts`:

```ts
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-cbc";

function getKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) throw new Error("ENCRYPTION_KEY not set");
  return Buffer.from(key, "hex");
}

export function encrypt(text: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

export function decrypt(encryptedText: string): string {
  const [ivHex, encrypted] = encryptedText.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}
```

- [ ] **Step 2: Create admin content APIs**

Create `src/app/api/admin/content/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const contents = await prisma.content.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true, genre: true, title: true, publishedAt: true,
      priority: true, isActive: true, createdAt: true,
    },
  });

  return NextResponse.json(contents);
}

export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const data = await req.json();

  const content = await prisma.content.create({
    data: {
      genre: data.genre,
      title: data.title,
      subtitle: data.subtitle || null,
      keyPhrase: data.keyPhrase,
      keyKo: data.keyKo,
      paragraphs: data.paragraphs,
      sentences: data.sentences,
      expressions: data.expressions,
      quiz: data.quiz,
      interview: data.interview,
      speakSentences: data.speakSentences,
      publishedAt: data.publishedAt ? new Date(data.publishedAt) : null,
      priority: data.priority || 0,
      isActive: data.isActive ?? true,
    },
  });

  return NextResponse.json(content, { status: 201 });
}
```

Create `src/app/api/admin/content/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const content = await prisma.content.findUnique({
    where: { id: parseInt(id) },
  });

  if (!content) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(content);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const data = await req.json();

  const content = await prisma.content.update({
    where: { id: parseInt(id) },
    data: {
      genre: data.genre,
      title: data.title,
      subtitle: data.subtitle || null,
      keyPhrase: data.keyPhrase,
      keyKo: data.keyKo,
      paragraphs: data.paragraphs,
      sentences: data.sentences,
      expressions: data.expressions,
      quiz: data.quiz,
      interview: data.interview,
      speakSentences: data.speakSentences,
      publishedAt: data.publishedAt ? new Date(data.publishedAt) : null,
      priority: data.priority || 0,
      isActive: data.isActive ?? true,
    },
  });

  return NextResponse.json(content);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  await prisma.content.delete({ where: { id: parseInt(id) } });

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3: Create admin users API**

Create `src/app/api/admin/users/route.ts`:

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const users = await prisma.user.findMany({
    select: {
      id: true, email: true, name: true, role: true,
      subscriptionStatus: true, createdAt: true, lastLoginAt: true,
      streak: { select: { currentStreak: true, longestStreak: true } },
      _count: { select: { progress: { where: { completed: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(users);
}
```

- [ ] **Step 4: Create admin dashboard API**

Create `src/app/api/admin/dashboard/route.ts`:

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [
    todayDau,
    newSignups,
    todayCompletions,
    todayShares,
    totalUsers,
    avgStreak,
    streakOver7,
  ] = await Promise.all([
    prisma.analyticsEvent.groupBy({
      by: ["userId"],
      where: { createdAt: { gte: todayStart }, userId: { not: null } },
    }).then((r) => r.length),
    prisma.user.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.analyticsEvent.count({
      where: { type: "complete", createdAt: { gte: todayStart } },
    }),
    prisma.share.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.user.count(),
    prisma.streak.aggregate({ _avg: { currentStreak: true } }),
    prisma.streak.count({ where: { currentStreak: { gte: 7 } } }),
  ]);

  // Per-content metrics: view count ranking + completion rate
  const contentMetrics = await prisma.content.findMany({
    where: { isActive: true, publishedAt: { not: null } },
    select: {
      id: true,
      title: true,
      _count: {
        select: {
          analyticsEvents: { where: { type: "view" } },
          progress: { where: { completed: true } },
        },
      },
    },
    orderBy: { analyticsEvents: { _count: "desc" } },
    take: 10,
  });

  const contentRanking = contentMetrics.map((c) => ({
    id: c.id,
    title: c.title,
    views: c._count.analyticsEvents,
    completions: c._count.progress,
    completionRate:
      c._count.analyticsEvents > 0
        ? Math.round((c._count.progress / c._count.analyticsEvents) * 100)
        : 0,
  }));

  // 30-day DAU trend
  const dailyDau = await prisma.$queryRaw<Array<{ date: string; dau: bigint }>>`
    SELECT DATE(created_at) as date, COUNT(DISTINCT user_id) as dau
    FROM analytics_events
    WHERE created_at >= ${thirtyDaysAgo} AND user_id IS NOT NULL
    GROUP BY DATE(created_at)
    ORDER BY date ASC
  `;

  const dauTrend = dailyDau.map((d) => ({
    date: String(d.date),
    dau: Number(d.dau),
  }));

  return NextResponse.json({
    today: {
      dau: todayDau,
      newSignups,
      completions: todayCompletions,
      shares: todayShares,
    },
    totals: {
      users: totalUsers,
      avgStreak: Math.round(avgStreak._avg.currentStreak || 0),
      streakOver7,
    },
    contentRanking,
    dauTrend,
  });
}
```

- [ ] **Step 5: Create admin AI settings APIs**

Create `src/app/api/admin/ai-settings/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { encrypt } from "@/lib/encryption";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const settings = await prisma.aISetting.findMany({
    select: { id: true, provider: true, model: true, isActive: true, createdAt: true, updatedAt: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(settings);
}

export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { provider, apiKey, model, isActive } = await req.json();

  if (!provider || !apiKey || !model) {
    return NextResponse.json({ error: "provider, apiKey, model required" }, { status: 400 });
  }

  const encryptedKey = encrypt(apiKey);

  // If setting as active, deactivate all others
  if (isActive) {
    await prisma.$transaction([
      prisma.aISetting.updateMany({ data: { isActive: false } }),
      prisma.aISetting.create({
        data: { provider, apiKey: encryptedKey, model, isActive: true },
      }),
    ]);
  } else {
    await prisma.aISetting.create({
      data: { provider, apiKey: encryptedKey, model, isActive: false },
    });
  }

  return NextResponse.json({ success: true }, { status: 201 });
}
```

Create `src/app/api/admin/ai-settings/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { encrypt } from "@/lib/encryption";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const { provider, apiKey, model, isActive } = await req.json();

  const updateData: Record<string, unknown> = {};
  if (provider) updateData.provider = provider;
  if (apiKey) updateData.apiKey = encrypt(apiKey);
  if (model) updateData.model = model;
  if (typeof isActive === "boolean") updateData.isActive = isActive;

  // If activating, deactivate others in a transaction
  if (isActive) {
    await prisma.$transaction([
      prisma.aISetting.updateMany({ data: { isActive: false } }),
      prisma.aISetting.update({ where: { id: parseInt(id) }, data: updateData }),
    ]);
  } else {
    await prisma.aISetting.update({ where: { id: parseInt(id) }, data: updateData });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  await prisma.aISetting.delete({ where: { id: parseInt(id) } });

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 6: Create admin sidebar**

Create `src/components/admin/sidebar.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/admin", label: "대시보드" },
  { href: "/admin/content", label: "콘텐츠" },
  { href: "/admin/users", label: "회원" },
  { href: "/admin/settings", label: "AI 설정" },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-[220px] shrink-0 border-r border-white/5 min-h-screen py-8 px-4">
      <Link
        href="/admin"
        className="text-[20px] font-semibold tracking-[-0.8px] text-white block mb-8 px-3"
      >
        관리자
      </Link>
      <nav className="space-y-1">
        {links.map((link) => {
          const isActive =
            link.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(link.href);

          return (
            <Link
              key={link.href}
              href={link.href}
              className={`block px-3 py-2 rounded-lg text-[14px] transition-colors ${
                isActive
                  ? "bg-framer-blue/10 text-framer-blue font-medium"
                  : "text-muted-silver hover:text-white hover:bg-white/5"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-8 px-3">
        <Link
          href="/today"
          className="text-[13px] text-muted-silver hover:text-white transition-colors"
        >
          ← 사이트로 돌아가기
        </Link>
      </div>
    </aside>
  );
}
```

- [ ] **Step 7: Create admin layout**

Create `src/app/(admin)/admin/layout.tsx`:

```tsx
import { AdminSidebar } from "@/components/admin/sidebar";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
```

- [ ] **Step 8: Create admin dashboard page**

Create `src/app/(admin)/admin/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";

interface ContentRank {
  id: number;
  title: string;
  views: number;
  completions: number;
  completionRate: number;
}

interface DauPoint {
  date: string;
  dau: number;
}

interface Dashboard {
  today: { dau: number; newSignups: number; completions: number; shares: number };
  totals: { users: number; avgStreak: number; streakOver7: number };
  contentRanking: ContentRank[];
  dauTrend: DauPoint[];
}

export default function AdminDashboard() {
  const [data, setData] = useState<Dashboard | null>(null);

  useEffect(() => {
    fetch("/api/admin/dashboard")
      .then((r) => r.json())
      .then(setData);
  }, []);

  if (!data) return <div className="text-muted-silver">로딩 중...</div>;

  const cards = [
    { label: "오늘 DAU", value: data.today.dau },
    { label: "오늘 신규 가입", value: data.today.newSignups },
    { label: "오늘 학습 완료", value: data.today.completions },
    { label: "오늘 공유", value: data.today.shares },
    { label: "전체 회원", value: data.totals.users },
    { label: "평균 스트릭", value: `${data.totals.avgStreak}일` },
    { label: "7일+ 스트릭", value: data.totals.streakOver7 },
  ];

  const maxDau = Math.max(...data.dauTrend.map((d) => d.dau), 1);

  return (
    <div>
      <h1 className="text-[24px] font-semibold tracking-[-0.01px] mb-6">대시보드</h1>

      {/* Overview cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map((c) => (
          <Card key={c.label} variant="surface">
            <p className="text-[12px] text-muted-silver mb-1">{c.label}</p>
            <p className="text-[24px] font-semibold tracking-[-0.01px]">{c.value}</p>
          </Card>
        ))}
      </div>

      {/* 30-day DAU trend */}
      <h2 className="text-[20px] font-semibold tracking-[-0.8px] mb-4">일별 DAU (최근 30일)</h2>
      <Card variant="surface" className="mb-8">
        <div className="flex items-end gap-1 h-[120px]">
          {data.dauTrend.map((d) => (
            <div
              key={d.date}
              className="flex-1 bg-framer-blue/60 rounded-t hover:bg-framer-blue transition-colors"
              style={{ height: `${(d.dau / maxDau) * 100}%`, minHeight: "2px" }}
              title={`${d.date}: ${d.dau}`}
            />
          ))}
        </div>
        <div className="flex justify-between mt-2 text-[11px] text-muted-silver">
          <span>{data.dauTrend[0]?.date.slice(5)}</span>
          <span>{data.dauTrend[data.dauTrend.length - 1]?.date.slice(5)}</span>
        </div>
      </Card>

      {/* Content ranking */}
      <h2 className="text-[20px] font-semibold tracking-[-0.8px] mb-4">콘텐츠별 조회/완료율</h2>
      <Card variant="surface">
        <div className="space-y-3">
          {data.contentRanking.map((c, i) => (
            <div key={c.id} className="flex items-center justify-between text-[14px]">
              <div className="flex items-center gap-3">
                <span className="text-muted-silver w-5">{i + 1}</span>
                <span className="text-white truncate max-w-[300px]">{c.title}</span>
              </div>
              <div className="flex items-center gap-4 text-[13px] text-muted-silver shrink-0">
                <span>조회 {c.views}</span>
                <span>완료 {c.completions}</span>
                <span className="text-framer-blue font-medium">{c.completionRate}%</span>
              </div>
            </div>
          ))}
          {data.contentRanking.length === 0 && (
            <p className="text-muted-silver text-[14px]">아직 데이터가 없습니다.</p>
          )}
        </div>
      </Card>
    </div>
  );
}
```

- [ ] **Step 9: Create admin content list page**

Create `src/app/(admin)/admin/content/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface ContentItem {
  id: number;
  genre: string;
  title: string;
  publishedAt: string | null;
  priority: number;
  isActive: boolean;
}

export default function AdminContentList() {
  const [contents, setContents] = useState<ContentItem[]>([]);

  useEffect(() => {
    fetch("/api/admin/content")
      .then((r) => r.json())
      .then(setContents);
  }, []);

  async function handleDelete(id: number) {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    await fetch(`/api/admin/content/${id}`, { method: "DELETE" });
    setContents((c) => c.filter((i) => i.id !== id));
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[24px] font-semibold tracking-[-0.01px]">콘텐츠 관리</h1>
        <Link href="/admin/content/new">
          <Button>새 콘텐츠</Button>
        </Link>
      </div>

      <div className="space-y-2">
        {contents.map((c) => (
          <div
            key={c.id}
            className="bg-near-black rounded-xl p-4 flex items-center justify-between"
          >
            <div>
              <span className="text-[12px] text-framer-blue mr-2">{c.genre}</span>
              <span className="text-[15px] font-medium">{c.title}</span>
              <span className="text-[12px] text-muted-silver ml-3">
                {c.publishedAt ? c.publishedAt.split("T")[0] : "초안"}
              </span>
              {!c.isActive && (
                <span className="text-[11px] text-red-400 ml-2">비활성</span>
              )}
            </div>
            <div className="flex gap-2">
              <Link href={`/admin/content/${c.id}/edit`}>
                <Button variant="ghost" className="text-[13px] px-3 py-1">
                  수정
                </Button>
              </Link>
              <Button
                variant="ghost"
                className="text-[13px] px-3 py-1 text-red-400"
                onClick={() => handleDelete(c.id)}
              >
                삭제
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 10: Create admin content form (new + edit)**

Create `src/components/admin/content-form.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface ContentFormProps {
  initialData?: Record<string, unknown>;
  contentId?: number;
}

export function ContentForm({ initialData, contentId }: ContentFormProps) {
  const router = useRouter();
  const isEdit = !!contentId;

  const [form, setForm] = useState({
    genre: (initialData?.genre as string) || "",
    title: (initialData?.title as string) || "",
    subtitle: (initialData?.subtitle as string) || "",
    keyPhrase: (initialData?.keyPhrase as string) || "",
    keyKo: (initialData?.keyKo as string) || "",
    paragraphs: JSON.stringify(initialData?.paragraphs || [""], null, 2),
    sentences: JSON.stringify(initialData?.sentences || [""], null, 2),
    expressions: JSON.stringify(initialData?.expressions || [{ expression: "", meaning: "", explanation: "", example: "" }], null, 2),
    quiz: JSON.stringify(initialData?.quiz || [{ question: "", answer: "", hint: "" }], null, 2),
    interview: JSON.stringify(initialData?.interview || [""], null, 2),
    speakSentences: JSON.stringify(initialData?.speakSentences || [""], null, 2),
    publishedAt: (initialData?.publishedAt as string)?.split("T")[0] || "",
    priority: String(initialData?.priority || 0),
    isActive: initialData?.isActive !== false,
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);

    let body: Record<string, unknown>;
    try {
      body = {
        genre: form.genre,
        title: form.title,
        subtitle: form.subtitle || null,
        keyPhrase: form.keyPhrase,
        keyKo: form.keyKo,
        paragraphs: JSON.parse(form.paragraphs),
        sentences: JSON.parse(form.sentences),
        expressions: JSON.parse(form.expressions),
        quiz: JSON.parse(form.quiz),
        interview: JSON.parse(form.interview),
        speakSentences: JSON.parse(form.speakSentences),
        publishedAt: form.publishedAt || null,
        priority: parseInt(form.priority),
        isActive: form.isActive,
      };
    } catch {
      setError("JSON 형식이 올바르지 않습니다.");
      setSaving(false);
      return;
    }

    const url = isEdit ? `/api/admin/content/${contentId}` : "/api/admin/content";
    const method = isEdit ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "저장 실패");
      return;
    }

    router.push("/admin/content");
    router.refresh();
  }

  function updateField(key: string, value: string | boolean) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-[800px]">
      <div className="grid grid-cols-2 gap-4">
        <Input label="장르" value={form.genre} onChange={(e) => updateField("genre", e.target.value)} required />
        <Input label="제목" value={form.title} onChange={(e) => updateField("title", e.target.value)} required />
      </div>
      <Input label="부제목" value={form.subtitle} onChange={(e) => updateField("subtitle", e.target.value)} />
      <div className="grid grid-cols-2 gap-4">
        <Input label="핵심 표현 (영)" value={form.keyPhrase} onChange={(e) => updateField("keyPhrase", e.target.value)} required />
        <Input label="핵심 표현 (한)" value={form.keyKo} onChange={(e) => updateField("keyKo", e.target.value)} required />
      </div>

      {(["paragraphs", "sentences", "expressions", "quiz", "interview", "speakSentences"] as const).map((field) => (
        <div key={field}>
          <label className="text-[13px] font-medium text-muted-silver block mb-2">{field} (JSON)</label>
          <textarea
            value={form[field]}
            onChange={(e) => updateField(field, e.target.value)}
            className="w-full bg-near-black border border-white/10 rounded-xl px-4 py-3 text-[13px] text-white font-mono leading-[1.6] placeholder:text-white/40 focus:border-framer-blue focus:outline-none min-h-[150px] resize-y"
          />
        </div>
      ))}

      <div className="grid grid-cols-3 gap-4">
        <Input label="발행일 (YYYY-MM-DD)" type="date" value={form.publishedAt} onChange={(e) => updateField("publishedAt", e.target.value)} />
        <Input label="우선순위" type="number" value={form.priority} onChange={(e) => updateField("priority", e.target.value)} />
        <div className="flex items-end pb-1">
          <label className="flex items-center gap-2 text-[14px] text-white cursor-pointer">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => updateField("isActive", e.target.checked)}
              className="w-4 h-4"
            />
            활성
          </label>
        </div>
      </div>

      {error && <p className="text-red-400 text-[13px]">{error}</p>}

      <Button type="submit" disabled={saving}>
        {saving ? "저장 중..." : isEdit ? "수정" : "생성"}
      </Button>
    </form>
  );
}
```

Create `src/app/(admin)/admin/content/new/page.tsx`:

```tsx
import { ContentForm } from "@/components/admin/content-form";

export default function NewContentPage() {
  return (
    <div>
      <h1 className="text-[24px] font-semibold tracking-[-0.01px] mb-6">새 콘텐츠</h1>
      <ContentForm />
    </div>
  );
}
```

Create `src/app/(admin)/admin/content/[id]/edit/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ContentForm } from "@/components/admin/content-form";

export default function EditContentPage() {
  const params = useParams();
  const id = params.id as string;
  const [data, setData] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    fetch(`/api/admin/content/${id}`)
      .then((r) => r.json())
      .then(setData);
  }, [id]);

  if (!data) return <div className="text-muted-silver">로딩 중...</div>;

  return (
    <div>
      <h1 className="text-[24px] font-semibold tracking-[-0.01px] mb-6">콘텐츠 수정</h1>
      <ContentForm initialData={data} contentId={parseInt(id)} />
    </div>
  );
}
```

- [ ] **Step 11: Create admin users page**

Create `src/app/(admin)/admin/users/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";

interface User {
  id: string;
  email: string;
  name: string | null;
  role: string;
  subscriptionStatus: string;
  createdAt: string;
  lastLoginAt: string | null;
  streak: { currentStreak: number; longestStreak: number } | null;
  _count: { progress: number };
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    fetch("/api/admin/users")
      .then((r) => r.json())
      .then(setUsers);
  }, []);

  return (
    <div>
      <h1 className="text-[24px] font-semibold tracking-[-0.01px] mb-6">회원 관리</h1>

      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-white/10 text-muted-silver text-left">
              <th className="pb-3 font-medium">이메일</th>
              <th className="pb-3 font-medium">이름</th>
              <th className="pb-3 font-medium">역할</th>
              <th className="pb-3 font-medium">구독</th>
              <th className="pb-3 font-medium">스트릭</th>
              <th className="pb-3 font-medium">학습 완료</th>
              <th className="pb-3 font-medium">가입일</th>
              <th className="pb-3 font-medium">최근 접속</th>
            </tr>
          </thead>
          <tbody className="text-white">
            {users.map((u) => (
              <tr key={u.id} className="border-b border-white/5">
                <td className="py-3">{u.email}</td>
                <td className="py-3">{u.name || "-"}</td>
                <td className="py-3">
                  <span className={u.role === "admin" ? "text-framer-blue" : ""}>{u.role}</span>
                </td>
                <td className="py-3">{u.subscriptionStatus}</td>
                <td className="py-3">{u.streak?.currentStreak ?? 0}</td>
                <td className="py-3">{u._count.progress}</td>
                <td className="py-3 text-muted-silver">{u.createdAt.split("T")[0]}</td>
                <td className="py-3 text-muted-silver">
                  {u.lastLoginAt ? u.lastLoginAt.split("T")[0] : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 12: Create admin AI settings page**

Create `src/app/(admin)/admin/settings/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface AISetting {
  id: number;
  provider: string;
  model: string;
  isActive: boolean;
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<AISetting[]>([]);
  const [provider, setProvider] = useState<"claude" | "openai">("claude");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  function loadSettings() {
    fetch("/api/admin/ai-settings")
      .then((r) => r.json())
      .then(setSettings);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch("/api/admin/ai-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, apiKey, model, isActive: settings.length === 0 }),
    });
    setSaving(false);
    setApiKey("");
    setModel("");
    loadSettings();
  }

  async function handleActivate(id: number) {
    await fetch(`/api/admin/ai-settings/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: true }),
    });
    loadSettings();
  }

  async function handleDelete(id: number) {
    if (!confirm("삭제하시겠습니까?")) return;
    await fetch(`/api/admin/ai-settings/${id}`, { method: "DELETE" });
    loadSettings();
  }

  return (
    <div>
      <h1 className="text-[24px] font-semibold tracking-[-0.01px] mb-6">AI 설정</h1>

      <div className="space-y-3 mb-8">
        {settings.map((s) => (
          <div
            key={s.id}
            className={`bg-near-black rounded-xl p-4 flex items-center justify-between ${
              s.isActive ? "shadow-ring-blue" : ""
            }`}
          >
            <div>
              <span className="text-[15px] font-medium">{s.provider}</span>
              <span className="text-[13px] text-muted-silver ml-3">{s.model}</span>
              {s.isActive && (
                <span className="text-[11px] text-green-400 ml-2">활성</span>
              )}
            </div>
            <div className="flex gap-2">
              {!s.isActive && (
                <Button
                  variant="ghost"
                  className="text-[13px] px-3 py-1"
                  onClick={() => handleActivate(s.id)}
                >
                  활성화
                </Button>
              )}
              <Button
                variant="ghost"
                className="text-[13px] px-3 py-1 text-red-400"
                onClick={() => handleDelete(s.id)}
              >
                삭제
              </Button>
            </div>
          </div>
        ))}
      </div>

      <h2 className="text-[20px] font-semibold tracking-[-0.8px] mb-4">새 API 키 등록</h2>
      <form onSubmit={handleAdd} className="space-y-4 max-w-[500px]">
        <div>
          <label className="text-[13px] font-medium text-muted-silver block mb-2">Provider</label>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value as "claude" | "openai")}
            className="bg-near-black border border-white/10 rounded-lg px-4 py-3 text-[15px] text-white w-full focus:border-framer-blue focus:outline-none"
          >
            <option value="claude">Claude</option>
            <option value="openai">OpenAI</option>
          </select>
        </div>
        <Input label="API Key" type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} required />
        <Input label="Model" value={model} onChange={(e) => setModel(e.target.value)} placeholder="claude-sonnet-4-6 / gpt-4o" required />
        <Button type="submit" disabled={saving}>
          {saving ? "저장 중..." : "등록"}
        </Button>
      </form>
    </div>
  );
}
```

- [ ] **Step 13: Verify admin panel**

Test all admin pages: dashboard, content CRUD, users list, AI settings.

- [ ] **Step 14: Commit**

```bash
cd /var/www/html/_______site_SORITUNECOM_ROUTINES
git add public_html/routines/src/
git commit -m "feat: add admin panel with dashboard, content CRUD, users, AI settings"
```

---

## Task 8: AI Interview Integration

**Files:**
- Create: `public_html/routines/src/lib/ai-service.ts`
- Create: `public_html/routines/src/app/api/ai/interview/route.ts`

- [ ] **Step 1: Install AI SDKs**

```bash
cd /var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines
pnpm add @anthropic-ai/sdk openai
```

- [ ] **Step 2: Create AI service layer**

Create `src/lib/ai-service.ts`:

```ts
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { prisma } from "./prisma";
import { decrypt } from "./encryption";

interface InterviewFeedback {
  relevance: string;
  grammar: string;
  nativeExpression: string;
  encouragement: string;
}

const SYSTEM_PROMPT = `You are an English tutor helping Korean learners practice conversational English.

Given a question and the student's answer, provide feedback in the following JSON format:
{
  "relevance": "Brief assessment of whether the answer addresses the question appropriately",
  "grammar": "Specific grammar corrections with explanations. If no errors, say 'No grammar issues found.'",
  "nativeExpression": "How a native English speaker might express the same idea more naturally",
  "encouragement": "Positive, encouraging feedback in Korean to motivate the student"
}

Respond ONLY with valid JSON. No markdown, no code blocks, just the JSON object.
Be specific and helpful. Korean encouragement should feel warm and genuine.`;

async function getActiveProvider(): Promise<{
  provider: "claude" | "openai";
  apiKey: string;
  model: string;
} | null> {
  const setting = await prisma.aISetting.findFirst({
    where: { isActive: true },
  });

  if (!setting) return null;

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
): Promise<InterviewFeedback> {
  const config = await getActiveProvider();

  if (!config) {
    throw new Error("AI provider not configured");
  }

  const userMessage = `Content context: ${contentContext}

Question: ${question}

Student's answer: ${answer}`;

  if (config.provider === "claude") {
    const client = new Anthropic({ apiKey: config.apiKey });
    const response = await client.messages.create({
      model: config.model,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    return JSON.parse(text) as InterviewFeedback;
  }

  // OpenAI
  const client = new OpenAI({ apiKey: config.apiKey });
  const response = await client.chat.completions.create({
    model: config.model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
    max_tokens: 1024,
  });

  const text = response.choices[0]?.message?.content || "";
  return JSON.parse(text) as InterviewFeedback;
}
```

- [ ] **Step 3: Create interview API route**

Create `src/app/api/ai/interview/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { getInterviewFeedback } from "@/lib/ai-service";

export async function POST(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  const { contentId, question, answer } = await req.json();

  if (!contentId || !question || !answer) {
    return NextResponse.json(
      { error: "contentId, question, and answer are required" },
      { status: 400 }
    );
  }

  const content = await prisma.content.findUnique({
    where: { id: contentId },
    select: { title: true, keyPhrase: true, keyKo: true },
  });

  if (!content) {
    return NextResponse.json({ error: "Content not found" }, { status: 404 });
  }

  const contentContext = `Title: ${content.title}. Key phrase: ${content.keyPhrase} (${content.keyKo})`;

  try {
    const feedback = await getInterviewFeedback(question, answer, contentContext);
    return NextResponse.json({ feedback });
  } catch (e) {
    const message = e instanceof Error ? e.message : "AI service error";

    if (message === "AI provider not configured") {
      return NextResponse.json({ error: message }, { status: 503 });
    }

    return NextResponse.json({ error: "Failed to get feedback. Please try again." }, { status: 500 });
  }
}
```

- [ ] **Step 4: Verify AI interview works**

1. Go to admin settings, register an AI API key
2. Go through learning flow to interview step
3. Submit an answer, verify feedback is returned

- [ ] **Step 5: Commit**

```bash
cd /var/www/html/_______site_SORITUNECOM_ROUTINES
git add public_html/routines/src/lib/ai-service.ts public_html/routines/src/app/api/ai/ public_html/routines/package.json public_html/routines/pnpm-lock.yaml
git commit -m "feat: add AI interview with Claude/OpenAI dual provider support"
```

---

## Task 9: Share & Analytics

**Files:**
- Create: `public_html/routines/src/app/api/share/route.ts`
- Create: `public_html/routines/src/app/api/events/route.ts`
- Modify: `public_html/routines/src/app/(main)/learn/[contentId]/complete/page.tsx`

- [ ] **Step 1: Create share API**

Create `src/app/api/share/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { ShareChannel } from "@prisma/client";

export async function POST(req: NextRequest) {
  const session = await auth();
  const { contentId, channel } = await req.json();

  if (!contentId || !channel) {
    return NextResponse.json({ error: "contentId and channel required" }, { status: 400 });
  }

  const validChannels: ShareChannel[] = ["copy", "kakao", "twitter", "other"];
  if (!validChannels.includes(channel)) {
    return NextResponse.json({ error: "Invalid channel" }, { status: 400 });
  }

  await prisma.share.create({
    data: {
      userId: session?.user?.id || null,
      contentId,
      channel,
    },
  });

  await prisma.analyticsEvent.create({
    data: {
      userId: session?.user?.id || null,
      type: "share",
      contentId,
      metadata: { channel },
    },
  });

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 2: Create events API**

Create `src/app/api/events/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { EventType } from "@prisma/client";

export async function POST(req: NextRequest) {
  const session = await auth();
  const { type, contentId, metadata } = await req.json();

  const validTypes: EventType[] = ["view", "share", "complete", "signup"];
  if (!type || !validTypes.includes(type)) {
    return NextResponse.json({ error: "Invalid event type" }, { status: 400 });
  }

  await prisma.analyticsEvent.create({
    data: {
      userId: session?.user?.id || null,
      type,
      contentId: contentId || null,
      metadata: metadata || null,
    },
  });

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3: Update complete page with share tracking**

Modify `src/app/(main)/learn/[contentId]/complete/page.tsx` — update the share button to call the share API:

Replace the `onClick` for the share button:

```tsx
onClick={async () => {
  const text = `오늘도 Routines에서 영어 학습 완료! 🔥 ${streak}일 연속 달성! https://routines.soritune.com`;
  await navigator.clipboard.writeText(text);
  await fetch("/api/share", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contentId: parseInt(params.contentId as string), channel: "copy" }),
  });
  alert("링크가 복사되었습니다!");
}}
```

Note: add `const params = useParams();` at the top of the component.

- [ ] **Step 4: Add view event tracking to content pages**

Add to `src/app/(main)/today/page.tsx` — inside the useEffect after loading content, fire a view event:

```ts
if (contentRes.ok) {
  const contentData = await contentRes.json();
  setContent(contentData);
  // Track view event
  fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "view", contentId: contentData.id }),
  });
  // ... rest
}
```

- [ ] **Step 5: Verify and commit**

Test: complete a learning flow, share via copy, check admin dashboard shows updated metrics.

```bash
cd /var/www/html/_______site_SORITUNECOM_ROUTINES
git add public_html/routines/src/
git commit -m "feat: add share and analytics event tracking"
```

---

## Task 10: Polish & Deploy

**Files:**
- Modify: various files for responsive and error handling
- Create: Apache config (already in Task 1 Step 8)

- [ ] **Step 1: Add responsive styles to nav (mobile hamburger)**

Modify `src/components/nav.tsx` — add mobile toggle state:

```tsx
// Add to Nav component:
const [menuOpen, setMenuOpen] = useState(false);

// Mobile hamburger button (before the links div):
<button
  className="md:hidden text-white"
  onClick={() => setMenuOpen(!menuOpen)}
>
  {menuOpen ? "✕" : "☰"}
</button>

// Wrap links div with responsive classes:
<div className={`${menuOpen ? "flex" : "hidden"} md:flex flex-col md:flex-row items-center gap-6 absolute md:relative top-16 md:top-0 left-0 right-0 bg-void-black md:bg-transparent p-6 md:p-0 border-b border-white/5 md:border-0`}>
```

- [ ] **Step 2: Add responsive hero text**

Verify `src/app/page.tsx` hero has responsive classes: `max-md:text-[62px] max-md:tracking-[-3.1px]` — already added in Task 4.

- [ ] **Step 3: Add SEO metadata to key pages**

Add metadata exports to key pages:

`src/app/(main)/today/page.tsx` doesn't support metadata (client component), but `src/app/page.tsx` (server component) already has it via root layout.

Add to `src/app/layout.tsx` metadata:

```ts
export const metadata: Metadata = {
  title: "Routines — Daily English Routine",
  description: "매일 하나의 영어 콘텐츠로 학습 루틴을 만드세요",
  openGraph: {
    title: "Routines — Daily English Routine",
    description: "매일 하나의 영어 콘텐츠로 학습 루틴을 만드세요",
    url: "https://routines.soritune.com",
    siteName: "Routines",
    type: "website",
  },
};
```

- [ ] **Step 4: Build and test production build**

```bash
cd /var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines
pnpm build
```

Expected: Build succeeds with no errors.

- [ ] **Step 5: Start with PM2**

```bash
cd /var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines
pm2 start ecosystem.config.js
pm2 save
```

Expected: `pm2 list` shows "routines" as "online"

- [ ] **Step 6: Verify Apache proxy works**

```bash
curl -I https://routines.soritune.com
```

Expected: HTTP 200 with HTML response from Next.js.

- [ ] **Step 7: Test full user flow end-to-end**

1. Visit https://routines.soritune.com — landing page with today's content
2. Sign up → redirected to `/today`
3. Complete 6 learning steps
4. See completion page with streak
5. Share link copies to clipboard
6. Check `/profile` — streak and stats
7. Check `/archive` — past content with lock UI
8. Login as admin → `/admin` dashboard shows metrics
9. Create new content via admin
10. AI interview responds with feedback (if API key configured)

- [ ] **Step 8: Final commit**

```bash
cd /var/www/html/_______site_SORITUNECOM_ROUTINES
git add .
git commit -m "feat: polish responsive UI, SEO, and production deployment"
```

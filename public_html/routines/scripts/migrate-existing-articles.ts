import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import * as readline from "node:readline";

const START = new Date("2026-04-20T00:00:00Z");
const END = new Date("2026-04-25T00:00:00Z");

const PINNED: Array<{ date: string; category: string; subtopicKo: string }> = [
  { date: "2026-04-20", category: "웰빙", subtopicKo: "아침 산책 습관" },
  { date: "2026-04-21", category: "교육", subtopicKo: "자녀와 소통" },
  { date: "2026-04-22", category: "자기개발", subtopicKo: "은퇴 준비" },
  { date: "2026-04-23", category: "환경", subtopicKo: "플라스틱 줄이기" },
  { date: "2026-04-24", category: "일상", subtopicKo: "부모님 안부 전화" },
  { date: "2026-04-25", category: "웰빙", subtopicKo: "깊은 숙면" },
];

async function confirm(question: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(`${question} (type YES to continue) `, (answer) => {
      rl.close();
      resolve(answer === "YES");
    });
  });
}

async function main() {
  console.log("=== Routines: existing-article migration ===");
  console.log(`Date range: ${START.toISOString().slice(0, 10)} .. ${END.toISOString().slice(0, 10)}`);

  const targets = await prisma.content.findMany({
    where: { publishedAt: { gte: START, lte: END } },
    select: { id: true, publishedAt: true, genre: true, title: true },
    orderBy: { publishedAt: "asc" },
  });

  console.log(`Found ${targets.length} contents in range:`);
  for (const t of targets) {
    const iso = t.publishedAt?.toISOString().slice(0, 10) ?? "null";
    console.log(`  id=${t.id} date=${iso} genre=${t.genre} title="${t.title}"`);
  }
  if (targets.length > 6) {
    console.error("Aborting: more than 6 rows matched. Investigate before proceeding.");
    process.exit(1);
  }
  if (targets.length === 0) {
    console.log("No existing content in range. Skipping delete; will still seed upcoming_topics.");
  }

  if (!(await confirm(`Delete these ${targets.length} contents and all dependent rows?`))) {
    console.log("Cancelled.");
    process.exit(0);
  }

  const ids = targets.map((t) => t.id);

  await prisma.$transaction(async (tx) => {
    if (ids.length > 0) {
      // analyticsEvent and share have onDelete: SetNull / Cascade respectively —
      // delete them explicitly to avoid FK violations before content delete.
      await tx.analyticsEvent.deleteMany({ where: { contentId: { in: ids } } });
      await tx.share.deleteMany({ where: { contentId: { in: ids } } });
      await tx.userProgress.deleteMany({ where: { contentId: { in: ids } } });
      // interviewAnswer has onDelete: Cascade from content, and recording has
      // onDelete: Cascade from interviewAnswer — delete interviewAnswers explicitly
      // here so recordings are cascade-deleted along with them.
      await tx.interviewAnswer.deleteMany({ where: { contentId: { in: ids } } });
      await tx.generationLog.updateMany({ where: { contentId: { in: ids } }, data: { contentId: null } });
      await tx.contentVariant.deleteMany({ where: { contentId: { in: ids } } });
      await tx.content.deleteMany({ where: { id: { in: ids } } });
    }
  });
  console.log(`Deleted ${ids.length} contents + dependent rows.`);

  console.log("\nSeeding upcoming_topics for the 6 dates…");
  for (const p of PINNED) {
    const pool = await prisma.topicPool.findFirst({
      where: { category: p.category, subtopicKo: p.subtopicKo },
    });
    if (!pool) {
      console.error(`Pool row missing for ${p.category} / ${p.subtopicKo}. Aborting.`);
      process.exit(1);
    }
    await prisma.upcomingTopic.upsert({
      where: { date: new Date(`${p.date}T00:00:00Z`) },
      create: {
        date: new Date(`${p.date}T00:00:00Z`),
        genre: p.category,
        keyPhrase: pool.keyPhraseEn,
        keyKo: pool.keyKo,
        hint: p.subtopicKo,
      },
      update: {
        genre: p.category,
        keyPhrase: pool.keyPhraseEn,
        keyKo: pool.keyKo,
        hint: p.subtopicKo,
      },
    });
    console.log(`  ${p.date}: ${p.category} / ${p.subtopicKo} / "${pool.keyPhraseEn}"`);
  }

  console.log("\nDone. Next step: trigger generation for each of the 6 dates via /admin/content.");
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});

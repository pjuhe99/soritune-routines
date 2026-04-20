import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Create admin user
  const adminPassword = await bcrypt.hash("admin1234!", 12);
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
  console.log("Created admin user:", admin.email);

  // Create test user
  const testPassword = await bcrypt.hash("test1234!", 12);
  const testUser = await prisma.user.upsert({
    where: { email: "test@soritune.com" },
    update: {},
    create: {
      email: "test@soritune.com",
      passwordHash: testPassword,
      name: "Test User",
      role: "user",
    },
  });
  console.log("Created test user:", testUser.email);

  // Create streak for test user
  await prisma.streak.upsert({
    where: { userId: testUser.id },
    update: {},
    create: {
      userId: testUser.id,
      currentStreak: 3,
      longestStreak: 7,
      lastCompleted: new Date(),
    },
  });
  console.log("Created streak for test user");

  // Create content (topic) + 3 variants.
  // Date represents UTC midnight of today's KST calendar date so it
  // matches the /api/content/today query after MySQL DATE truncation.
  const kstDateStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
  const today = new Date(kstDateStr);

  const topic = await prisma.content.upsert({
    where: { id: 1 },
    update: {
      genre: "Daily Life",
      title: "Morning Routines That Change Your Day",
      subtitle: "How successful people start their mornings",
      keyPhrase: "make a habit of",
      keyKo: "~을 습관으로 만들다",
      publishedAt: today,
      priority: 0,
      isActive: true,
    },
    create: {
      id: 1,
      genre: "Daily Life",
      title: "Morning Routines That Change Your Day",
      subtitle: "How successful people start their mornings",
      keyPhrase: "make a habit of",
      keyKo: "~을 습관으로 만들다",
      publishedAt: today,
      priority: 0,
      isActive: true,
    },
  });
  console.log("Created topic:", topic.title);

  const variantsData = [
    {
      level: "beginner" as const,
      paragraphs: [
        "Many people have morning routines. They do the same things every morning. This helps them feel ready for the day.",
        "Some people wake up early. They make a habit of planning the day. They drink water, stretch, and read a little.",
        "The key is to do it every day. Small actions become big results over time.",
      ],
      sentences: [
        "Many people have morning routines.",
        "They make a habit of planning the day.",
        "The key is to do it every day.",
        "Small actions become big results.",
        "I want to start a good morning routine.",
      ],
      expressions: [
        { expression: "make a habit of", meaning: "to do something often", example: "I make a habit of drinking water every morning." },
        { expression: "wake up", meaning: "to stop sleeping", example: "I wake up at 7 every day." },
        { expression: "the key is", meaning: "the most important thing is", example: "The key is to start small." },
      ],
      quiz: [
        { question: "Many people _____ morning routines.", answer: "have", options: ["have", "are", "do", "want"] },
        { question: "I _____ drinking water every morning.", answer: "make a habit of", options: ["make a habit of", "give up", "run out of", "look at"] },
        { question: "_____ to start small.", answer: "The key is", options: ["The key is", "The end is", "The day is", "The book is"] },
      ],
      interview: [
        "What time do you wake up?",
        "What do you do in the morning?",
        "Do you like morning or evening?",
      ],
      speakSentences: [
        "I wake up at seven every morning.",
        "I make a habit of reading in the morning.",
        "The key is to start small and be patient.",
      ],
    },
    {
      level: "intermediate" as const,
      paragraphs: [
        "Many successful people swear by their morning routines. They believe that how you start your day determines how the rest of it will go. From meditation to exercise, these early morning habits set the tone for productivity and positivity.",
        "One of the most common habits among high achievers is waking up early. By rising before the rest of the world, they gain quiet time to focus on their goals. They make a habit of planning their day before distractions take over.",
        "The key is consistency. It does not matter whether you prefer journaling, reading, or working out. What matters is that you commit to your routine every single day. Over time, these small actions compound into remarkable results.",
      ],
      sentences: [
        "Many successful people swear by their morning routines.",
        "How you start your day determines how the rest of it will go.",
        "They make a habit of planning their day before distractions take over.",
        "The key is consistency in your daily routine.",
        "Over time, these small actions compound into remarkable results.",
      ],
      expressions: [
        { expression: "swear by", meaning: "to strongly believe in the effectiveness of something", example: "I swear by my morning meditation — it keeps me focused all day." },
        { expression: "make a habit of", meaning: "to do something regularly until it becomes automatic", example: "She made a habit of reading for 30 minutes every morning." },
        { expression: "the key is", meaning: "the most important factor is", example: "The key is staying consistent even when you don't feel like it." },
      ],
      quiz: [
        { question: "Many successful people _____ their morning routines.", answer: "swear by", options: ["swear by", "give up", "look into", "pass on"] },
        { question: "They _____ planning their day before distractions take over.", answer: "make a habit of", options: ["make a habit of", "give up on", "run out of", "look forward to"] },
        { question: "_____ consistency in your daily routine.", answer: "The key is", options: ["The key is", "The problem is", "The question is", "The issue is"] },
      ],
      interview: [
        "What does your morning routine look like? Do you have specific habits you follow every day?",
        "Have you ever tried waking up earlier to be more productive? How did it go?",
        "What is one habit you would like to make a part of your daily routine and why?",
      ],
      speakSentences: [
        "I swear by my morning routine because it helps me stay focused throughout the day.",
        "I want to make a habit of exercising every morning before work.",
        "The key is finding a routine that works for you and sticking with it.",
      ],
    },
    {
      level: "advanced" as const,
      paragraphs: [
        "The morning routines of high performers are less about the specific rituals themselves and more about the deliberate architecture of intention they impose on an otherwise chaotic day. Whether it's cold exposure, pre-dawn journaling, or a forty-minute meditation block, the unifying thread is that these individuals refuse to let the world's agenda dictate the first hour of theirs.",
        "What the literature on habit formation consistently underscores is that consistency trumps intensity. A modest ten-minute routine practiced daily will reshape your cognitive baseline more profoundly than an ambitious two-hour program pursued sporadically. The architects of such routines aren't superhuman — they've simply made a habit of reclaiming agency before it can be hijacked.",
        "Ultimately, the key is not the content of your routine but the conviction behind it. The compounding effect isn't mystical; it's arithmetic. Show up daily, refine incrementally, and over a sufficient horizon the accumulated marginal gains become indistinguishable from what outsiders will later call natural talent.",
      ],
      sentences: [
        "The morning routines of high performers impose a deliberate architecture of intention on the day.",
        "Consistency trumps intensity in habit formation.",
        "They've made a habit of reclaiming agency before it can be hijacked.",
        "The key is not the content of your routine but the conviction behind it.",
        "Accumulated marginal gains become indistinguishable from what outsiders call natural talent.",
      ],
      expressions: [
        { expression: "swear by", meaning: "to attest to the efficacy of something with quasi-religious conviction", example: "She swears by a predawn cold plunge as the linchpin of her cognitive performance." },
        { expression: "make a habit of", meaning: "to ritualize a behavior until it becomes involuntary", example: "He made a habit of deflecting praise, redirecting credit to his collaborators." },
        { expression: "the key is", meaning: "the decisive variable that determines the outcome", example: "The key is recognizing that durability, not peak output, compounds over time." },
      ],
      quiz: [
        { question: "High performers impose a deliberate _____ of intention on the day.", answer: "architecture", options: ["architecture", "accident", "avoidance", "abstraction"] },
        { question: "In habit formation, consistency _____ intensity.", answer: "trumps", options: ["trumps", "undermines", "resembles", "replaces"] },
        { question: "Marginal gains _____ into what outsiders call natural talent.", answer: "compound", options: ["compound", "collapse", "dissolve", "fragment"] },
      ],
      interview: [
        "Beyond the ritual itself, what do you think is the underlying function a morning routine serves for the practitioner?",
        "Where do you think the line sits between a productive routine and a rigid compulsion that stifles adaptability?",
        "If you were designing a morning routine for someone chronically busy, which habit would you insist is non-negotiable, and why?",
      ],
      speakSentences: [
        "I swear by a minimalist morning routine because elaborate rituals rarely survive contact with real life.",
        "I've made a habit of resisting the urge to check my phone until I've finished my first deep-work block.",
        "The key is recognizing that durability, not peak output, is what compounds over time.",
      ],
    },
  ];

  for (const variant of variantsData) {
    await prisma.contentVariant.upsert({
      where: { contentId_level: { contentId: topic.id, level: variant.level } },
      update: variant,
      create: { ...variant, contentId: topic.id },
    });
  }
  console.log("Created 3 variants for topic:", topic.title);

  console.log("Seed completed successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

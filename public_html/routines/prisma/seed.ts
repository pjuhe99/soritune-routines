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

  // Create content
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const content = await prisma.content.upsert({
    where: { id: 1 },
    update: {},
    create: {
      genre: "Daily Life",
      title: "Morning Routines That Change Your Day",
      subtitle: "How successful people start their mornings",
      keyPhrase: "make a habit of",
      keyKo: "~을 습관으로 만들다",
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
        {
          expression: "swear by",
          meaning: "to strongly believe in the effectiveness of something",
          example: "I swear by my morning meditation — it keeps me focused all day.",
        },
        {
          expression: "make a habit of",
          meaning: "to do something regularly until it becomes automatic",
          example: "She made a habit of reading for 30 minutes every morning.",
        },
        {
          expression: "the key is",
          meaning: "the most important factor is",
          example: "The key is staying consistent even when you don't feel like it.",
        },
      ],
      quiz: [
        {
          question: "Many successful people _____ their morning routines.",
          answer: "swear by",
          options: ["swear by", "give up", "look into", "pass on"],
        },
        {
          question: "They _____ planning their day before distractions take over.",
          answer: "make a habit of",
          options: ["make a habit of", "give up on", "run out of", "look forward to"],
        },
        {
          question: "_____ consistency in your daily routine.",
          answer: "The key is",
          options: ["The key is", "The problem is", "The question is", "The issue is"],
        },
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
      publishedAt: today,
      priority: 0,
      isActive: true,
    },
  });
  console.log("Created content:", content.title);

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

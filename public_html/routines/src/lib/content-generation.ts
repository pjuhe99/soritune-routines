import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { prisma } from "@/lib/prisma";
import { getActiveProvider } from "@/lib/ai-service";
import {
  buildStage1Prompt,
  buildStage2Prompt,
  Level,
  RecentTopicRef,
  Stage1Context,
  Stage1Result,
} from "@/lib/generation-prompts";
import { logApiUsage } from "@/lib/api-usage-logger";
import {
  pickAndClaimTopic,
  compensatePoolClaim,
  type ClaimedTopic,
} from "@/lib/topic-pool";
import { validateLevelRules } from "@/lib/level-validation";
import { ApiEndpoint, ContentVariant, GenerationStatus, Prisma } from "@prisma/client";

const LEVELS: readonly Level[] = ["beginner", "intermediate", "advanced"] as const;
const STALE_RUNNING_MINUTES = 30;
const RECENT_TOPICS_DAYS = 14;
const MAX_STAGE2_RETRIES = 2;

export type GenerationResult = {
  status: "success" | "fallback" | "failed";
  contentId: number | null;
  logId: number;
};

export class GenerationConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GenerationConflictError";
  }
}

interface Stage2Result {
  paragraphs: string[];
  sentences: string[];
  expressions: { expression: string; meaning: string; explanation: string; example: string }[];
  quiz: { question: string; answer: string; options: string[]; hint: string }[];
  interview: string[];
  speakSentences: string[];
}

async function callAI(
  provider: "claude" | "openai",
  apiKey: string,
  model: string,
  system: string,
  user: string,
  endpoint: ApiEndpoint
): Promise<string> {
  const startedAt = Date.now();
  if (provider === "claude") {
    const client = new Anthropic({ apiKey });
    try {
      const resp = await client.messages.create({
        model,
        max_tokens: 4096,
        system,
        messages: [{ role: "user", content: user }],
      });
      const block = resp.content[0];
      if (block.type !== "text") throw new Error("Claude returned non-text block");
      await logApiUsage({
        provider: "claude",
        model,
        endpoint,
        inputTokens: resp.usage.input_tokens,
        outputTokens: resp.usage.output_tokens,
        cacheReadTokens: resp.usage.cache_read_input_tokens ?? 0,
        cacheCreationTokens: resp.usage.cache_creation_input_tokens ?? 0,
        durationMs: Date.now() - startedAt,
        success: true,
      });
      return block.text;
    } catch (err) {
      await logApiUsage({
        provider: "claude",
        model,
        endpoint,
        inputTokens: 0,
        outputTokens: 0,
        durationMs: Date.now() - startedAt,
        success: false,
        errorMessage: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  const client = new OpenAI({ apiKey });
  try {
    const resp = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });
    const text = resp.choices[0]?.message?.content;
    if (!text) throw new Error("OpenAI returned empty content");
    await logApiUsage({
      provider: "openai",
      model,
      endpoint,
      inputTokens: resp.usage?.prompt_tokens ?? 0,
      outputTokens: resp.usage?.completion_tokens ?? 0,
      durationMs: Date.now() - startedAt,
      success: true,
    });
    return text;
  } catch (err) {
    await logApiUsage({
      provider: "openai",
      model,
      endpoint,
      inputTokens: 0,
      outputTokens: 0,
      durationMs: Date.now() - startedAt,
      success: false,
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

function parseJsonLoose(raw: string): unknown {
  // Some models still wrap JSON in ```json blocks despite instructions. Strip if present.
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  const body = fenced ? fenced[1] : trimmed;
  return JSON.parse(body);
}

function validateStage1(raw: unknown): Stage1Result {
  if (typeof raw !== "object" || raw === null) throw new Error("Stage 1: not an object");
  const o = raw as Record<string, unknown>;
  for (const k of ["title", "subtitle", "genre", "keyPhrase", "keyKo"] as const) {
    if (typeof o[k] !== "string" || (o[k] as string).trim() === "") {
      throw new Error(`Stage 1: ${k} missing or empty`);
    }
  }
  return {
    title: (o.title as string).trim(),
    subtitle: (o.subtitle as string).trim(),
    genre: (o.genre as string).trim(),
    keyPhrase: (o.keyPhrase as string).trim(),
    keyKo: (o.keyKo as string).trim(),
  };
}

function assertNonEmptyStringArray(arr: unknown, field: string, min: number, max: number): string[] {
  if (!Array.isArray(arr)) throw new Error(`${field}: not an array`);
  if (arr.length < min || arr.length > max) {
    throw new Error(`${field}: length ${arr.length} outside [${min}, ${max}]`);
  }
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i];
    if (typeof v !== "string" || v.trim() === "") {
      throw new Error(`${field}[${i}]: not a non-empty string`);
    }
  }
  return arr.map((s) => (s as string).trim());
}

function validateStage2(raw: unknown, keyPhrase: string, level: Level): Stage2Result {
  if (typeof raw !== "object" || raw === null) throw new Error(`Stage 2 (${level}): not an object`);
  const o = raw as Record<string, unknown>;

  const paragraphs = assertNonEmptyStringArray(o.paragraphs, `Stage 2 (${level}) paragraphs`, 2, 5);
  const sentences = assertNonEmptyStringArray(o.sentences, `Stage 2 (${level}) sentences`, 4, 10);
  const interview = assertNonEmptyStringArray(o.interview, `Stage 2 (${level}) interview`, 3, 6);
  const speakSentences = assertNonEmptyStringArray(
    o.speakSentences,
    `Stage 2 (${level}) speakSentences`,
    3,
    6
  );

  if (!Array.isArray(o.expressions)) throw new Error(`Stage 2 (${level}) expressions: not an array`);
  if (o.expressions.length < 3 || o.expressions.length > 6) {
    throw new Error(`Stage 2 (${level}) expressions: length ${o.expressions.length} outside [3, 6]`);
  }
  const expressions = o.expressions.map((e, i) => {
    if (typeof e !== "object" || e === null) throw new Error(`expressions[${i}]: not an object`);
    const x = e as Record<string, unknown>;
    for (const k of ["expression", "meaning", "explanation", "example"] as const) {
      if (typeof x[k] !== "string" || (x[k] as string).trim() === "") {
        throw new Error(`expressions[${i}].${k}: not a non-empty string`);
      }
    }
    return {
      expression: (x.expression as string).trim(),
      meaning: (x.meaning as string).trim(),
      explanation: (x.explanation as string).trim(),
      example: (x.example as string).trim(),
    };
  });

  if (!Array.isArray(o.quiz)) throw new Error(`Stage 2 (${level}) quiz: not an array`);
  if (o.quiz.length < 3 || o.quiz.length > 6) {
    throw new Error(`Stage 2 (${level}) quiz: length ${o.quiz.length} outside [3, 6]`);
  }
  const quiz = o.quiz.map((q, i) => {
    if (typeof q !== "object" || q === null) throw new Error(`quiz[${i}]: not an object`);
    const x = q as Record<string, unknown>;
    for (const k of ["question", "answer", "hint"] as const) {
      if (typeof x[k] !== "string" || (x[k] as string).trim() === "") {
        throw new Error(`quiz[${i}].${k}: not a non-empty string`);
      }
    }
    const options = assertNonEmptyStringArray(x.options, `quiz[${i}].options`, 2, 5);
    const answer = (x.answer as string).trim();
    if (!options.includes(answer)) {
      throw new Error(`quiz[${i}].answer "${answer}" not in options [${options.join(", ")}]`);
    }
    return {
      question: (x.question as string).trim(),
      answer,
      options,
      hint: (x.hint as string).trim(),
    };
  });

  // KeyPhrase must appear case-insensitively somewhere in paragraphs.
  const haystack = paragraphs.join(" ").toLowerCase();
  if (!haystack.includes(keyPhrase.toLowerCase())) {
    throw new Error(
      `Stage 2 (${level}): keyPhrase "${keyPhrase}" not found in paragraphs`
    );
  }

  return { paragraphs, sentences, expressions, quiz, interview, speakSentences };
}

async function markStaleRunning(targetDate: Date): Promise<void> {
  const cutoff = new Date(Date.now() - STALE_RUNNING_MINUTES * 60 * 1000);
  await prisma.generationLog.updateMany({
    where: {
      targetDate,
      status: GenerationStatus.running,
      runAt: { lt: cutoff },
    },
    data: { status: GenerationStatus.failed, errorMessage: "stale running TTL" },
  });
}

async function assertNoRunning(targetDate: Date): Promise<void> {
  const existing = await prisma.generationLog.findFirst({
    where: { targetDate, status: GenerationStatus.running },
  });
  if (existing) {
    throw new GenerationConflictError(
      `Another generation for ${targetDate.toISOString().split("T")[0]} is already running`
    );
  }
}

async function handleOverwrite(targetDate: Date, overwrite: boolean): Promise<void> {
  const existing = await prisma.content.findFirst({
    where: { publishedAt: targetDate },
    select: { id: true },
  });
  if (!existing) return;
  if (!overwrite) {
    throw new GenerationConflictError(
      `Content already exists for ${targetDate.toISOString().split("T")[0]} (set overwrite=true to replace)`
    );
  }
  await prisma.content.delete({ where: { id: existing.id } }); // cascades variants
}

async function fetchRecentTopics(targetDate: Date): Promise<RecentTopicRef[]> {
  const cutoff = new Date(targetDate);
  cutoff.setUTCDate(cutoff.getUTCDate() - RECENT_TOPICS_DAYS);
  const rows = await prisma.content.findMany({
    where: {
      publishedAt: { lt: targetDate, gte: cutoff },
      isActive: true,
    },
    select: { genre: true, title: true, keyPhrase: true },
    orderBy: { publishedAt: "desc" },
  });
  return rows.map((r) => ({ genre: r.genre, title: r.title, keyPhrase: r.keyPhrase }));
}

async function runAttempt(
  targetDate: Date,
  attempt: number,
  providerInfo: { provider: "claude" | "openai"; apiKey: string; model: string }
): Promise<{ contentId: number; logId: number }> {
  const startedAt = Date.now();
  const log = await prisma.generationLog.create({
    data: {
      targetDate,
      status: GenerationStatus.running,
      provider: providerInfo.provider,
      model: providerInfo.model,
      attempt,
    },
  });

  const upcoming = await prisma.upcomingTopic.findUnique({
    where: { date: targetDate },
  });

  // If no upcoming override exists, claim a topic from the rotating pool.
  // This call may throw (NoPoolTopicError, rotation_state missing) — we let
  // those propagate BEFORE the try/catch so compensation only runs after a
  // successful claim.
  let poolClaim: ClaimedTopic | null = null;
  if (!upcoming) {
    poolClaim = await pickAndClaimTopic(targetDate);
  }

  try {
    const recent = await fetchRecentTopics(targetDate);

    const stage1Ctx: Stage1Context = {
      recentTopics: recent,
      upcomingTopic: upcoming
        ? {
            genre: upcoming.genre,
            keyPhrase: upcoming.keyPhrase,
            keyKo: upcoming.keyKo,
            hint: upcoming.hint ?? null,
          }
        : poolClaim
        ? {
            genre: poolClaim.category,
            keyPhrase: poolClaim.keyPhraseEn,
            keyKo: poolClaim.keyKo,
            hint: poolClaim.subtopicKo, // gives the model Korean context for the subtopic
          }
        : undefined,
    };

    const s1Prompt = buildStage1Prompt(stage1Ctx);
    const s1Raw = await callAI(
      providerInfo.provider,
      providerInfo.apiKey,
      providerInfo.model,
      s1Prompt.system,
      s1Prompt.user,
      "generation_stage1"
    );
    let stage1 = validateStage1(parseJsonLoose(s1Raw));

    // Override mode: server-wins on genre/keyPhrase/keyKo for both upcoming
    // overrides AND pool-claimed topics.
    if (upcoming) {
      stage1 = {
        ...stage1,
        genre: upcoming.genre,
        keyPhrase: upcoming.keyPhrase,
        keyKo: upcoming.keyKo,
      };
    } else if (poolClaim) {
      stage1 = {
        ...stage1,
        genre: poolClaim.category,
        keyPhrase: poolClaim.keyPhraseEn,
        keyKo: poolClaim.keyKo,
      };
    }

    const variantResults = await Promise.all(
      LEVELS.map(async (level) => {
        let stage2: Stage2Result | null = null;
        let lastReasons: string[] = [];
        for (let attempt = 0; attempt <= MAX_STAGE2_RETRIES; attempt++) {
          const p = buildStage2Prompt(stage1, level);
          const raw = await callAI(
            providerInfo.provider,
            providerInfo.apiKey,
            providerInfo.model,
            p.system,
            p.user,
            "generation_stage2"
          );
          const candidate = validateStage2(parseJsonLoose(raw), stage1.keyPhrase, level);
          const levelCheck = validateLevelRules(candidate.paragraphs, level);
          if (!levelCheck.hardFail) {
            stage2 = candidate;
            if (levelCheck.warnings.length) {
              console.warn(
                `[generation] ${level} warnings: ${levelCheck.warnings.join("; ")}`
              );
            }
            break;
          }
          lastReasons = levelCheck.reasons;
          console.warn(
            `[generation] ${level} attempt ${attempt + 1} level-validation failed: ${levelCheck.reasons.join("; ")}`
          );
        }
        if (!stage2) {
          throw new Error(
            `Stage 2 (${level}) level-validation failed after ${MAX_STAGE2_RETRIES + 1} attempts: ${lastReasons.join("; ")}`
          );
        }
        return { level, payload: stage2 };
      })
    );

    const content = await prisma.$transaction(async (tx) => {
      const topic = await tx.content.create({
        data: {
          genre: stage1.genre,
          title: stage1.title,
          subtitle: stage1.subtitle,
          keyPhrase: stage1.keyPhrase,
          keyKo: stage1.keyKo,
          publishedAt: targetDate,
          priority: 0,
          isActive: true,
        },
      });
      for (const v of variantResults) {
        await tx.contentVariant.create({
          data: {
            contentId: topic.id,
            level: v.level,
            paragraphs: v.payload.paragraphs as unknown as Prisma.InputJsonValue,
            sentences: v.payload.sentences as unknown as Prisma.InputJsonValue,
            expressions: v.payload.expressions as unknown as Prisma.InputJsonValue,
            quiz: v.payload.quiz as unknown as Prisma.InputJsonValue,
            interview: v.payload.interview as unknown as Prisma.InputJsonValue,
            speakSentences: v.payload.speakSentences as unknown as Prisma.InputJsonValue,
          },
        });
      }
      return topic;
    });

    await prisma.generationLog.update({
      where: { id: log.id },
      data: {
        status: GenerationStatus.success,
        durationMs: Date.now() - startedAt,
        contentId: content.id,
      },
    });

    return { contentId: content.id, logId: log.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.generationLog.update({
      where: { id: log.id },
      data: {
        status: GenerationStatus.failed,
        durationMs: Date.now() - startedAt,
        errorMessage: message.slice(0, 2000),
      },
    });
    if (poolClaim) {
      try {
        await compensatePoolClaim(poolClaim);
      } catch (compErr) {
        console.error("[generation] compensatePoolClaim failed:", compErr);
      }
    }
    throw err;
  }
}

async function runFallback(
  targetDate: Date,
  providerInfo: { provider: "claude" | "openai"; apiKey: string; model: string }
): Promise<{ contentId: number | null; logId: number }> {
  const startedAt = Date.now();
  const log = await prisma.generationLog.create({
    data: {
      targetDate,
      status: GenerationStatus.running,
      provider: providerInfo.provider,
      model: providerInfo.model,
      attempt: 3, // sentinel: fallback pass
    },
  });

  try {
    const prev = await prisma.content.findFirst({
      where: { publishedAt: { lt: targetDate }, isActive: true },
      orderBy: { publishedAt: "desc" },
      include: { variants: true },
    });

    if (!prev) {
      await prisma.generationLog.update({
        where: { id: log.id },
        data: {
          status: GenerationStatus.failed,
          durationMs: Date.now() - startedAt,
          errorMessage: "fallback impossible: no previous content",
        },
      });
      return { contentId: null, logId: log.id };
    }

    const clone = await prisma.$transaction(async (tx) => {
      const c = await tx.content.create({
        data: {
          genre: prev.genre,
          title: prev.title,
          subtitle: prev.subtitle,
          keyPhrase: prev.keyPhrase,
          keyKo: prev.keyKo,
          publishedAt: targetDate,
          priority: 0,
          isActive: true,
          reusedFromContentId: prev.id,
        },
      });
      for (const v of prev.variants as ContentVariant[]) {
        await tx.contentVariant.create({
          data: {
            contentId: c.id,
            level: v.level,
            paragraphs: v.paragraphs as Prisma.InputJsonValue,
            sentences: v.sentences as Prisma.InputJsonValue,
            expressions: v.expressions as Prisma.InputJsonValue,
            quiz: v.quiz as Prisma.InputJsonValue,
            interview: v.interview as Prisma.InputJsonValue,
            speakSentences: v.speakSentences as Prisma.InputJsonValue,
          },
        });
      }
      return c;
    });

    await prisma.generationLog.update({
      where: { id: log.id },
      data: {
        status: GenerationStatus.fallback,
        durationMs: Date.now() - startedAt,
        contentId: clone.id,
      },
    });

    return { contentId: clone.id, logId: log.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.generationLog.update({
      where: { id: log.id },
      data: {
        status: GenerationStatus.failed,
        durationMs: Date.now() - startedAt,
        errorMessage: message.slice(0, 2000),
      },
    });
    throw err;
  }
}

export async function generateContentForDate(
  targetDate: Date,
  options?: { overwrite?: boolean }
): Promise<GenerationResult> {
  const overwrite = options?.overwrite ?? false;

  await markStaleRunning(targetDate);
  await assertNoRunning(targetDate);
  await handleOverwrite(targetDate, overwrite);

  const providerInfo = await getActiveProvider();

  try {
    const r1 = await runAttempt(targetDate, 1, providerInfo);
    return { status: "success", contentId: r1.contentId, logId: r1.logId };
  } catch (err) {
    console.error("[generateContentForDate] attempt 1 failed:", err);
  }

  try {
    const r2 = await runAttempt(targetDate, 2, providerInfo);
    return { status: "success", contentId: r2.contentId, logId: r2.logId };
  } catch (err) {
    console.error("[generateContentForDate] attempt 2 failed:", err);
  }

  const fb = await runFallback(targetDate, providerInfo);
  if (fb.contentId === null) {
    return { status: "failed", contentId: null, logId: fb.logId };
  }
  return { status: "fallback", contentId: fb.contentId, logId: fb.logId };
}

import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env" });
loadEnv({ path: ".env.local", override: true });
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import type { Prisma } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { getActiveProvider } from "../src/lib/ai-service";

const DRY_RUN = process.argv.includes("--dry");

interface ExpressionShape {
  expression: string;
  phonetic?: string;
  meaning: string;
  explanation: string;
  example: string;
}

const SYSTEM_PROMPT =
  "You produce American English IPA pronunciation for English words and phrases. " +
  'Always wrap each pronunciation in slash notation (e.g., "/meɪk ə ɡʊd ɪmˈprɛʃən/"). ' +
  "Return strict JSON only.";

function buildUserPrompt(expressions: string[]): string {
  return [
    "For each expression below, return the American English IPA pronunciation in slash notation.",
    "Output strict JSON: { \"phonetics\": [\"/.../\", \"/.../\", ...] } with the same length and order as the input.",
    "Do NOT include any other keys, comments, or markdown.",
    "",
    "Expressions:",
    ...expressions.map((e, i) => `${i + 1}. ${e}`),
  ].join("\n");
}

function parseJsonLoose(raw: string): unknown {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  const body = fenced ? fenced[1] : trimmed;
  return JSON.parse(body);
}

interface AIClient {
  generate(system: string, user: string): Promise<string>;
}

function makeClient(provider: "claude" | "openai", apiKey: string, model: string): AIClient {
  if (provider === "claude") {
    const client = new Anthropic({ apiKey });
    return {
      async generate(system, user) {
        const resp = await client.messages.create({
          model,
          max_tokens: 4096,
          system,
          messages: [{ role: "user", content: user }],
        });
        const block = resp.content[0];
        if (!block || block.type !== "text") {
          throw new Error("Claude returned non-text block");
        }
        return block.text;
      },
    };
  }
  const client = new OpenAI({ apiKey });
  return {
    async generate(system, user) {
      const resp = await client.chat.completions.create({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
        temperature: 0,
      });
      const text = resp.choices[0]?.message?.content;
      if (!text) throw new Error("OpenAI returned empty content");
      return text;
    },
  };
}

async function generatePhonetics(
  client: AIClient,
  expressions: string[]
): Promise<string[] | null> {
  let text: string;
  try {
    text = await client.generate(SYSTEM_PROMPT, buildUserPrompt(expressions));
  } catch (err) {
    console.error(`    ai error: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
  let parsed: unknown;
  try {
    parsed = parseJsonLoose(text);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const arr = (parsed as { phonetics?: unknown }).phonetics;
  if (!Array.isArray(arr)) return null;
  if (arr.length !== expressions.length) return null;
  return arr.map((v) => {
    if (typeof v !== "string") return "";
    const trimmed = v.trim();
    if (!trimmed) return "";
    const wrapped =
      trimmed.startsWith("/") && trimmed.endsWith("/")
        ? trimmed
        : `/${trimmed.replace(/^\/+|\/+$/g, "")}/`;
    return wrapped;
  });
}

async function main() {
  console.log(`=== Backfill expression phonetics${DRY_RUN ? " (DRY)" : ""} ===`);

  let client: AIClient | null = null;
  if (!DRY_RUN) {
    const { provider, apiKey, model } = await getActiveProvider();
    console.log(`Using active provider: ${provider} / ${model}`);
    client = makeClient(provider, apiKey, model);
  }

  const variants = await prisma.contentVariant.findMany({
    select: { id: true, contentId: true, level: true, expressions: true },
    orderBy: [{ contentId: "asc" }, { level: "asc" }],
  });
  console.log(`Loaded ${variants.length} content variants.`);

  let totalScanned = 0;
  let totalEmpty = 0;
  let totalFilled = 0;
  let batchesSucceeded = 0;
  let batchesFailed = 0;

  for (const variant of variants) {
    const list = variant.expressions as unknown;
    if (!Array.isArray(list)) {
      console.log(
        `  skip variant id=${variant.id} (content=${variant.contentId} level=${variant.level}): expressions is not an array`
      );
      continue;
    }
    const exprs = list as ExpressionShape[];

    totalScanned += exprs.length;
    const emptyIndexes: number[] = [];
    exprs.forEach((e, i) => {
      if (!e.phonetic || !e.phonetic.trim()) emptyIndexes.push(i);
    });
    totalEmpty += emptyIndexes.length;

    if (emptyIndexes.length === 0) continue;

    const newList: ExpressionShape[] = exprs.map((e) => ({ ...e }));

    if (DRY_RUN) {
      console.log(
        `  content=${variant.contentId} level=${variant.level}: ${emptyIndexes.length} empty (DRY)`
      );
      emptyIndexes.forEach((idx) => {
        console.log(`    [${idx}] ${exprs[idx].expression}`);
      });
      continue;
    }

    const targets = emptyIndexes.map((idx) => exprs[idx].expression);
    let phonetics = await generatePhonetics(client!, targets);
    if (!phonetics) {
      console.log(
        `  content=${variant.contentId} level=${variant.level}: batch failed, retrying once`
      );
      phonetics = await generatePhonetics(client!, targets);
    }

    if (!phonetics) {
      console.log(
        `  content=${variant.contentId} level=${variant.level}: batch failed twice, skipping`
      );
      batchesFailed += 1;
      continue;
    }

    batchesSucceeded += 1;
    let filledThisVariant = 0;
    emptyIndexes.forEach((idx, j) => {
      const ipa = phonetics![j];
      if (ipa) {
        newList[idx].phonetic = ipa;
        totalFilled += 1;
        filledThisVariant += 1;
      }
    });
    console.log(
      `  content=${variant.contentId} level=${variant.level}: filled ${filledThisVariant}/${emptyIndexes.length}`
    );

    if (filledThisVariant > 0) {
      await prisma.contentVariant.update({
        where: { id: variant.id },
        data: { expressions: newList as unknown as Prisma.InputJsonValue },
      });
    }
  }

  console.log("=== Summary ===");
  console.log(`scanned expressions:      ${totalScanned}`);
  console.log(`empty before run:         ${totalEmpty}`);
  console.log(`filled this run:          ${totalFilled}`);
  console.log(`batches succeeded/failed: ${batchesSucceeded} / ${batchesFailed}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

// Prompt builders for the AI content generation service.
//
// Stage 1 produces the shared topic info (title/subtitle/genre/keyPhrase/keyKo).
// Stage 2 produces a single level's learning payload (paragraphs/sentences/...).
//
// TUNING NOTES:
// - If models (esp. non-Claude) return markdown-wrapped JSON, tighten the
//   "Respond ONLY with valid JSON" language or switch to the provider's
//   structured-output mode.
// - If the quiz.answer frequently fails "answer ∈ options" validation,
//   reinforce "answer MUST be exactly one of the options" in Stage 2.
// - If beginner paragraphs drift too complex or advanced paragraphs drift
//   too simple, quote examples in the level spec.
// - KeyPhrase-in-paragraph validation sometimes fails because the model
//   uses a morphological variant. Consider relaxing to stem-match or
//   strengthen the prompt to require the exact surface form.

export type Level = "beginner" | "intermediate" | "advanced";

export interface RecentTopicRef {
  genre: string;
  title: string;
  keyPhrase: string;
}

export interface Stage1Context {
  recentTopics: RecentTopicRef[];
  upcomingTopic?: {
    genre: string;
    keyPhrase: string;
    keyKo: string;
    hint?: string | null;
  };
}

export interface Stage1Result {
  title: string;
  subtitle: string;
  genre: string;
  keyPhrase: string;
  keyKo: string;
}

export function buildStage1Prompt(ctx: Stage1Context): { system: string; user: string } {
  const system = `You are an English learning content designer for Korean learners. Generate a daily topic that is distinct from the recent topics provided. Output strict JSON with fields: title, subtitle, genre, keyPhrase, keyKo.

Rules:
- title: 5-10 English words, concrete and inviting.
- subtitle: 1 short English sentence, 6-14 words.
- genre: one of: Daily Life, Workplace, Travel, Relationships, Technology, Health, Culture, Education, Entertainment, Environment.
- keyPhrase: 1-4 English words that will be taught and must appear naturally in every paragraph at all levels.
- keyKo: a concise Korean translation of keyPhrase (1-6 Korean characters).

Respond ONLY with valid JSON. No markdown, no code blocks, just the JSON object.`;

  const recentList = ctx.recentTopics.length
    ? ctx.recentTopics.map((t) => `- ${t.genre}: "${t.title}" [${t.keyPhrase}]`).join("\n")
    : "- (none)";

  const override = ctx.upcomingTopic
    ? `\n\nUse these fixed values (do NOT change them; only generate title/subtitle consistent with these):
- genre: ${ctx.upcomingTopic.genre}
- keyPhrase: ${ctx.upcomingTopic.keyPhrase}
- keyKo: ${ctx.upcomingTopic.keyKo}
${ctx.upcomingTopic.hint ? `- hint: ${ctx.upcomingTopic.hint}` : ""}`
    : "";

  const user = `Recent topics (avoid duplicating genre or keyPhrase):
${recentList}${override}

Respond ONLY with valid JSON: { "title": "...", "subtitle": "...", "genre": "...", "keyPhrase": "...", "keyKo": "..." }`;

  return { system, user };
}

interface LevelGuidance {
  paragraph: string;
  expressionExplanation: string;
}

const LEVEL_SPEC: Record<Level, LevelGuidance> = {
  beginner: {
    paragraph:
      "Very short, very simple sentences (6-12 words each). Use only common everyday vocabulary (CEFR A1-A2). Use present simple tense by default; use past simple only when the topic requires it. Avoid idioms, phrasal verbs, passive voice, and complex subordinate clauses. If a tricky word is unavoidable, pick the easiest possible synonym. Prefer concrete subjects (I, you, we, my friend) over abstract ones.",
    expressionExplanation:
      "Write 2-3 short English sentences explaining WHEN and HOW to use this expression in everyday life. Mention at least one simpler synonym the learner already knows. Keep each sentence under 12 words.",
  },
  intermediate: {
    paragraph:
      "Natural conversational English (12-22 words per sentence). Mix of tenses, idiomatic but accessible phrasal verbs, some compound sentences.",
    expressionExplanation:
      "Write 2-3 sentences covering usage nuance: typical context (formal vs casual, spoken vs written), how it differs from close synonyms, and any common pitfalls. Be specific.",
  },
  advanced: {
    paragraph:
      "Native speaker register with sophisticated vocabulary, nuanced connotation, and varied syntax (18-30 words per sentence acceptable).",
    expressionExplanation:
      "Write 2-3 sentences on register, connotation, and typical collocations. Note any pragmatic subtleties such as irony, politeness level, hedging, or cultural context. Mention a few collocations learners can reuse.",
  },
};

export function buildStage2Prompt(
  stage1: Stage1Result,
  level: Level
): { system: string; user: string } {
  const spec = LEVEL_SPEC[level];
  const system = `You are writing English learning material for Korean learners at ${level} level.

Level spec (paragraphs):
${spec.paragraph}

Output strict JSON with exactly these fields:
- paragraphs: 2 to 5 English paragraphs. The keyPhrase "${stage1.keyPhrase}" MUST appear at least once across the paragraphs (surface form preferred).
- sentences: 4 to 10 short English sentences suitable for listening practice.
- expressions: 3 to 6 objects with { "expression": "...", "meaning": "...", "explanation": "...", "example": "..." }.
  - "meaning": ONE short English sentence defining the expression's core meaning.
  - "explanation": ${spec.expressionExplanation}
  - "example": ONE natural English example sentence using the expression.
- quiz: 3 to 6 multiple-choice items with { "question": "...", "answer": "...", "options": ["...", ...] }. options has 3-4 entries. answer MUST be exactly equal to one of the options. Typically fill-in-the-blank style.
- interview: 3 to 6 open-ended English interview questions the student could answer conversationally.
- speakSentences: 3 to 6 English sentences that practice the keyPhrase or topic vocabulary.

Every string must be non-empty after trimming. The "explanation" field should genuinely differ across levels — do not reuse beginner explanations at advanced.

Respond ONLY with valid JSON. No markdown, no code blocks.`;

  const user = `Topic metadata:
- title: ${stage1.title}
- subtitle: ${stage1.subtitle}
- genre: ${stage1.genre}
- keyPhrase: ${stage1.keyPhrase} (${stage1.keyKo})

Write the full ${level}-level learning material. Respond ONLY with JSON matching the schema.`;

  return { system, user };
}

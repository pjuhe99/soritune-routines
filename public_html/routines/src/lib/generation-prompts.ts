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
  expressionMeaning: string;
  expressionExplanation: string;
}

// NOTE: meaning and explanation are written in Korean so Korean learners can
// read them without dictionary lookup. The expression itself and the example
// sentence stay in English (learning targets).
const LEVEL_SPEC: Record<Level, LevelGuidance> = {
  beginner: {
    paragraph:
      "Very short, very simple sentences (6-12 words each). Use only common everyday vocabulary (CEFR A1-A2). Use present simple tense by default; use past simple only when the topic requires it. Avoid idioms, phrasal verbs, passive voice, and complex subordinate clauses. If a tricky word is unavoidable, pick the easiest possible synonym. Prefer concrete subjects (I, you, we, my friend) over abstract ones.",
    expressionMeaning:
      "한국어로 1문장, 핵심 의미만 아주 간단하게. 초급 학습자가 바로 이해할 수 있는 쉬운 표현을 써라.",
    expressionExplanation:
      "한국어로 2-3문장. 이 표현을 언제/어떤 상황에서 쓰는지 일상 맥락에서 설명하고, 학습자가 이미 아는 더 쉬운 한국어/영어 유사 표현을 하나 제시해라. 각 문장은 짧게.",
  },
  intermediate: {
    paragraph:
      "Natural conversational English (12-22 words per sentence). Mix of tenses, idiomatic but accessible phrasal verbs, some compound sentences.",
    expressionMeaning:
      "한국어로 1문장, 자연스러운 뉘앙스까지 담은 핵심 의미.",
    expressionExplanation:
      "한국어로 2-3문장. 사용 뉘앙스, 격식/비격식, 구어/문어 여부, 비슷한 표현과의 차이, 자주 하는 실수를 짚어라. 구체적으로.",
  },
  advanced: {
    paragraph:
      "Native speaker register with sophisticated vocabulary, nuanced connotation, and varied syntax (18-30 words per sentence acceptable).",
    expressionMeaning:
      "한국어로 1문장, 미묘한 함의와 정확한 사전적 의미를 담아라.",
    expressionExplanation:
      "한국어로 2-3문장. 레지스터(격식도), 함축, 전형적 연어(collocation), 화용적 뉘앙스(아이러니·완곡·헷지)를 다뤄라. 자주 쓰이는 연어 2-3개를 예시로 포함.",
  },
};

export function buildStage2Prompt(
  stage1: Stage1Result,
  level: Level
): { system: string; user: string } {
  const spec = LEVEL_SPEC[level];
  const system = `You are writing English learning material for Korean learners at ${level} level.

LANGUAGE POLICY (critical, read twice):
- "expression" field: WRITE IN ENGLISH. It is the phrase being learned.
- "meaning" field: WRITE IN KOREAN (한국어). Korean learners read this to understand the phrase.
- "explanation" field: WRITE IN KOREAN (한국어). Korean learners read this for usage details.
- "example" field: WRITE IN ENGLISH. It models how to actually use the phrase.
- All other fields (paragraphs, sentences, quiz, interview, speakSentences): ENGLISH.
Do NOT write "meaning" or "explanation" in English. If a field is supposed to be Korean, every sentence in it must be Korean. Mixing English words inside Korean sentences is only allowed to quote the English expression itself.

Level spec (paragraphs):
${spec.paragraph}

Output strict JSON with exactly these fields:
- paragraphs: 2 to 5 English paragraphs. The keyPhrase "${stage1.keyPhrase}" MUST appear at least once across the paragraphs (surface form preferred).
- sentences: 4 to 10 short English sentences suitable for listening practice.
- expressions: 3 to 6 objects with { "expression": "...", "meaning": "...", "explanation": "...", "example": "..." }.
  - "expression" (ENGLISH): the English expression itself — the learning target.
  - "meaning" (한국어): ${spec.expressionMeaning}
  - "explanation" (한국어): ${spec.expressionExplanation}
  - "example" (ENGLISH): ONE natural English example sentence using the expression.
- quiz: 3 to 6 multiple-choice items with { "question": "...", "answer": "...", "options": ["...", ...] }. options has 3-4 entries. answer MUST be exactly equal to one of the options. Typically fill-in-the-blank style.
- interview: 3 to 6 open-ended English interview questions the student could answer conversationally.
- speakSentences: 3 to 6 English sentences that practice the keyPhrase or topic vocabulary.

Example shape for ONE expression item (mimic the language pattern exactly):
{
  "expression": "make a good impression",
  "meaning": "${level === "beginner"
    ? "좋은 느낌을 주다."
    : level === "intermediate"
      ? "상대에게 긍정적인 첫인상을 남기다."
      : "상대의 호감과 신뢰를 이끌어내는 긍정적 인상을 형성하다."}",
  "explanation": "${level === "beginner"
    ? "새 사람을 처음 만나거나 새로운 곳에서 시작할 때 써요. '좋게 보이다'와 비슷한 뜻이에요. 웃으면서 인사하면 좋은 인상을 줄 수 있어요."
    : level === "intermediate"
      ? "면접, 첫 출근, 소개 자리 같은 격식 있는 상황에서 자주 쓰인다. 단순히 '좋아 보이다(look good)'와 달리 상대의 평가가 개입된다는 뉘앙스를 담는다. 비슷한 표현 'come across well'과 서로 바꿔 쓸 수 있다."
      : "면접·첫 미팅·사회적 첫 대면 등에서 '타인의 평가'라는 암묵적 긴장을 내포한다. 자주 쓰이는 연어는 'make a good impression on', 'make a lasting impression', 'struggle to make a good impression'이다. 자기 비하적 톤으로 쓰면 가벼운 아이러니를 드러낼 수 있다."}",
  "example": "I want to make a good impression on my new team."
}

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

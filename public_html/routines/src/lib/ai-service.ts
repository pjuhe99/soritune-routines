import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { prisma } from "./prisma";
import { decrypt } from "./encryption";

// The system prompt still describes the tone/content. The output schema is
// enforced by Claude tool_use (below) so we don't need to model it as JSON
// here — that avoids the unescaped-inner-quote failures we saw when Claude
// generated raw JSON with embedded English quotes.
const SYSTEM_PROMPT = `You are an English tutor helping Korean learners practice conversational English. Your feedback targets Korean learners, so write all explanations in Korean. When quoting English expressions, example sentences, or corrected phrases inside Korean text, wrap them in double quotes — do not translate the English itself into Korean.

For every student answer, produce feedback by calling the interview_feedback tool exactly once.`;

const INTERVIEW_FEEDBACK_TOOL = {
  name: "interview_feedback",
  description:
    "Record structured interview feedback for a Korean English-learning student.",
  input_schema: {
    type: "object" as const,
    properties: {
      relevance: {
        type: "string",
        description:
          "한국어로 설명. 답변이 질문에 적절히 답했는지. 영어 예시는 \"like this\" 처럼 따옴표로 감싼다.",
      },
      grammar: {
        type: "string",
        description:
          "한국어로 문법 교정 설명. 오류가 없으면 '문법 오류가 없어요.' 라고만 쓴다.",
      },
      nativeExpression: {
        type: "string",
        description:
          "한국어로 더 자연스러운 표현 제안. 영어 표현은 \"hang out\" 처럼 따옴표로 감싼다.",
      },
      encouragement: {
        type: "string",
        description: "한국어로 격려 메시지. 짧고 따뜻하게.",
      },
      recommendedSentence: {
        type: "string",
        description:
          "학생이 녹음 연습할 자연스러운 영어 문장(들). 학생의 의도를 반영하며 권장 25단어 이내, 필요하면 여러 문장. 영어만.",
      },
    },
    required: [
      "relevance",
      "grammar",
      "nativeExpression",
      "encouragement",
      "recommendedSentence",
    ],
  },
};

interface ActiveProvider {
  provider: "claude" | "openai";
  apiKey: string;
  model: string;
}

export interface InterviewFeedback {
  relevance: string;
  grammar: string;
  nativeExpression: string;
  encouragement: string;
}

export interface InterviewAIResponse {
  feedback: InterviewFeedback;
  recommendedSentence: string;
}

export async function getActiveProvider(): Promise<ActiveProvider> {
  const setting = await prisma.aISetting.findFirst({
    where: { isActive: true },
  });

  if (!setting) {
    throw new Error("AI provider not configured");
  }

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
): Promise<InterviewAIResponse> {
  const { provider, apiKey, model } = await getActiveProvider();

  const userMessage = `Context: The student is learning from content about "${contentContext}".

Question: ${question}

Student's answer: ${answer}`;

  let parsed: Partial<InterviewFeedback & { recommendedSentence: string }>;

  if (provider === "claude") {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: [INTERVIEW_FEEDBACK_TOOL],
      tool_choice: { type: "tool", name: INTERVIEW_FEEDBACK_TOOL.name },
      messages: [{ role: "user", content: userMessage }],
    });

    // Claude returns the tool call as content of type 'tool_use' whose
    // `input` is already a validated object matching the schema.
    const toolUse = response.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      throw new Error("Claude did not invoke interview_feedback tool");
    }
    parsed = toolUse.input as Partial<InterviewFeedback & { recommendedSentence: string }>;
  } else {
    // OpenAI path keeps JSON-in-text for now (content-generation still does
    // the same). If this becomes flaky we'll migrate to openai function
    // calling the same way.
    const client = new OpenAI({ apiKey });
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
    });

    const responseText = response.choices[0]?.message?.content ?? "";
    const trimmed = responseText.trim();
    const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
    const body = fenced ? fenced[1] : trimmed;
    parsed = JSON.parse(body) as Partial<InterviewFeedback & { recommendedSentence: string }>;
  }

  const feedback: InterviewFeedback = {
    relevance: parsed.relevance ?? "",
    grammar: parsed.grammar ?? "",
    nativeExpression: parsed.nativeExpression ?? "",
    encouragement: parsed.encouragement ?? "",
  };

  // Graceful degrade: recommendedSentence 누락 시 원문 답변을 fallback
  const recommendedSentence =
    typeof parsed.recommendedSentence === "string" && parsed.recommendedSentence.trim().length > 0
      ? parsed.recommendedSentence.trim()
      : answer;

  return { feedback, recommendedSentence };
}

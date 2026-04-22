import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { prisma } from "./prisma";
import { decrypt } from "./encryption";

const SYSTEM_PROMPT = `You are an English tutor helping Korean learners practice conversational English. Your feedback targets Korean learners, so **write all explanations in Korean**. Quote English expressions, example sentences, and corrected phrases in English using double quotes — do not translate the English itself into Korean.

Given a question and the student's answer, respond with this JSON:
{
  "relevance": "한국어로 설명. 답변이 질문에 적절히 답했는지. 영어 예시는 \"like this\"처럼 따옴표로.",
  "grammar": "한국어로 문법 교정 설명. 오류가 없으면 \"문법 오류가 없어요.\" 라고만 쓴다.",
  "nativeExpression": "한국어로 더 자연스러운 표현 제안. 영어 표현은 \"hang out\" 처럼 따옴표로.",
  "encouragement": "한국어로 격려 메시지. 짧고 따뜻하게.",
  "recommendedSentence": "학생이 녹음 연습할 자연스러운 영어 문장(들). 학생의 의도를 반영하며 권장 25단어 이내, 필요하면 여러 문장으로 구성 가능. 따옴표 없이 순수 영어만."
}

Respond ONLY with valid JSON. No markdown, no code blocks, just the JSON object.`;

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

  let responseText: string;

  if (provider === "claude") {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const block = response.content[0];
    responseText = block.type === "text" ? block.text : "";
  } else {
    const client = new OpenAI({ apiKey });
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
    });

    responseText = response.choices[0]?.message?.content ?? "";
  }

  // AI 응답은 flat 5-key 구조로 반환. 누락 대비 모두 optional.
  // Some models wrap JSON in ```json fences despite instructions — strip if present.
  const trimmed = responseText.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  const body = fenced ? fenced[1] : trimmed;
  const parsed = JSON.parse(body) as Partial<InterviewFeedback & { recommendedSentence: string }>;

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

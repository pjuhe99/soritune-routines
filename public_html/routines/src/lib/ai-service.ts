import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { prisma } from "./prisma";
import { decrypt } from "./encryption";

const SYSTEM_PROMPT = `You are an English tutor helping Korean learners practice conversational English.

Given a question and the student's answer, provide feedback in the following JSON format:
{
  "relevance": "Brief assessment of whether the answer addresses the question appropriately",
  "grammar": "Specific grammar corrections with explanations. If no errors, say 'No grammar issues found.'",
  "nativeExpression": "How a native English speaker might express the same idea more naturally",
  "encouragement": "Positive, encouraging feedback in Korean to motivate the student"
}

Respond ONLY with valid JSON. No markdown, no code blocks, just the JSON object.`;

interface ActiveProvider {
  provider: "claude" | "openai";
  apiKey: string;
  model: string;
}

interface InterviewFeedback {
  relevance: string;
  grammar: string;
  nativeExpression: string;
  encouragement: string;
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
): Promise<InterviewFeedback> {
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

  return JSON.parse(responseText) as InterviewFeedback;
}

import OpenAI from "openai";
import { SYSTEM_PROMPT } from "./systemPrompt.js";
import { getSession, addMessage } from "./session.js";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const CONCISE_SUFFIX =
  "\n\nRespond concisely and directly. Limit to essential information only.";

export async function askAI(
  userId: number,
  userMessage: string,
  contextPrefix?: string,
): Promise<string> {
  const session = getSession(userId);

  const fullUserMessage = contextPrefix
    ? `${contextPrefix}\n\n${userMessage}`
    : userMessage;

  addMessage(userId, "user", fullUserMessage);

  const systemContent =
    session.mode === "concise"
      ? SYSTEM_PROMPT + CONCISE_SUFFIX
      : SYSTEM_PROMPT;

  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: systemContent },
    ...session.messages,
  ];

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: session.mode === "concise" ? 1024 : 4096,
      messages,
    });

    const reply =
      response.choices[0]?.message?.content ??
      "Error: No response from AI model.";

    addMessage(userId, "assistant", reply);
    return reply;
  } catch (err: unknown) {
    const error = err as { status?: number; message?: string };
    if (error.status === 429) {
      return "⚠️ Rate limit reached. Please wait a moment and try again.";
    }
    if (error.status === 401) {
      return "⚠️ Invalid OpenAI API key. Please check your OPENAI_API_KEY secret.";
    }
    throw err;
  }
}

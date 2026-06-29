import OpenAI from "openai";
import Groq from "groq-sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { SYSTEM_PROMPT } from "./systemPrompt.js";
import { getSession, addMessage } from "./session.js";
import { logger } from "../lib/logger.js";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const groq = process.env.GROQ_API_KEY
  ? new Groq({ apiKey: process.env.GROQ_API_KEY })
  : null;

const gemini = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

const CONCISE_SUFFIX =
  "\n\nRespond concisely and directly. Limit to essential information only.";

async function tryOpenAI(
  messages: ChatCompletionMessageParam[],
  maxTokens: number,
): Promise<string> {
  if (!openai) throw new Error("OpenAI not configured");
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    max_tokens: maxTokens,
    messages,
  });
  return response.choices[0]?.message?.content ?? "";
}

async function tryGroq(
  messages: ChatCompletionMessageParam[],
  maxTokens: number,
): Promise<string> {
  if (!groq) throw new Error("Groq not configured");
  const response = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    max_tokens: maxTokens,
    messages: messages as Parameters<typeof groq.chat.completions.create>[0]["messages"],
  });
  return response.choices[0]?.message?.content ?? "";
}

async function tryGemini(
  systemPrompt: string,
  history: ChatCompletionMessageParam[],
  lastUserMsg: string,
): Promise<string> {
  if (!gemini) throw new Error("Gemini not configured");
  const model = gemini.getGenerativeModel({
    model: "gemini-2.0-flash",
    systemInstruction: systemPrompt,
  });

  const geminiHistory = history.slice(0, -1).map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content as string }],
  }));

  const chat = model.startChat({ history: geminiHistory });
  const result = await chat.sendMessage(lastUserMsg);
  return result.response.text();
}

export type AIProvider = "openai" | "groq" | "gemini";

export async function askAI(
  userId: number,
  userMessage: string,
  contextPrefix?: string,
): Promise<{ reply: string; provider: AIProvider }> {
  const session = getSession(userId);

  const fullUserMessage = contextPrefix
    ? `${contextPrefix}\n\n${userMessage}`
    : userMessage;

  addMessage(userId, "user", fullUserMessage);

  const systemContent =
    session.mode === "concise"
      ? SYSTEM_PROMPT + CONCISE_SUFFIX
      : SYSTEM_PROMPT;

  const maxTokens = session.mode === "concise" ? 1024 : 4096;

  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: systemContent },
    ...session.messages,
  ];

  // Try OpenAI → Groq → Gemini in order
  const providers: Array<{ name: AIProvider; fn: () => Promise<string> }> = [
    {
      name: "openai",
      fn: () => tryOpenAI(messages, maxTokens),
    },
    {
      name: "groq",
      fn: () => tryGroq(messages, maxTokens),
    },
    {
      name: "gemini",
      fn: () =>
        tryGemini(systemContent, session.messages, fullUserMessage),
    },
  ];

  let lastError: unknown;
  for (const provider of providers) {
    try {
      const reply = await provider.fn();
      if (reply) {
        addMessage(userId, "assistant", reply);
        return { reply, provider: provider.name };
      }
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      logger.warn({ provider: provider.name, status: e.status, msg: e.message }, "AI provider failed, trying next");
      lastError = err;
    }
  }

  logger.error({ lastError }, "All AI providers failed");
  return {
    reply: "⚠️ All AI providers are currently unavailable. Please try again in a moment.",
    provider: "openai",
  };
}

import OpenAI from "openai";
import Groq from "groq-sdk";
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
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

// All Gemini safety categories disabled for research environment
const GEMINI_SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT,        threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,       threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

const CONCISE_SUFFIX =
  "\n\nRespond concisely and directly. Limit to essential information only.";

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
  const content = response.choices[0]?.message?.content ?? "";
  // If Groq refused, throw so we fall through to next provider
  if (
    content.includes("I cannot") ||
    content.includes("I can't assist") ||
    content.includes("I'm unable to") ||
    content.includes("I won't") ||
    content.includes("against my") ||
    content.includes("I must decline") ||
    content.includes("I apologize, but I")
  ) {
    throw new Error("Groq refused: " + content.slice(0, 80));
  }
  return content;
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
    safetySettings: GEMINI_SAFETY_SETTINGS,
  });

  const geminiHistory = history.slice(0, -1).map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content as string }],
  }));

  const chat = model.startChat({ history: geminiHistory });
  const result = await chat.sendMessage(lastUserMsg);
  const content = result.response.text();
  if (!content) throw new Error("Gemini returned empty response");
  return content;
}

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
  const content = response.choices[0]?.message?.content ?? "";
  if (!content) throw new Error("OpenAI returned empty response");
  return content;
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

  const maxTokens = session.mode === "concise" ? 1024 : 8000;

  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: systemContent },
    ...session.messages,
  ];

  // Provider order: Groq first (most permissive) → Gemini (safety off) → OpenAI (last resort)
  const providers: Array<{ name: AIProvider; fn: () => Promise<string> }> = [
    {
      name: "groq",
      fn: () => tryGroq(messages, maxTokens),
    },
    {
      name: "gemini",
      fn: () => tryGemini(systemContent, session.messages, fullUserMessage),
    },
    {
      name: "openai",
      fn: () => tryOpenAI(messages, maxTokens),
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

  const e = lastError as { status?: number; message?: string };
const isRateLimit = e?.status === 429 || e?.message?.includes("rate");
logger.error({ lastError }, "All AI providers failed");
return {
  reply: isRateLimit
    ? "⏳ Rate limit reached — all providers are busy. Please wait 60 seconds and try again."
    : "⚠️ All AI providers are currently unavailable. Please try again in a moment.",
  provider: "DARK WEB 👽",
};

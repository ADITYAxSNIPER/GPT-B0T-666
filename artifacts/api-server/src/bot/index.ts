import TelegramBot from "node-telegram-bot-api";
import { logger } from "../lib/logger.js";
import { COMMANDS, START_MESSAGE, HELP_MESSAGE } from "./commands.js";
import { askAI } from "./ai.js";
import { clearSession, setMode, getSession } from "./session.js";
import { formatForTelegram, splitMessage } from "./formatter.js";

export function startBot(): TelegramBot | null {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    logger.warn("TELEGRAM_BOT_TOKEN not set — bot will not start");
    return null;
  }

  const bot = new TelegramBot(token, { polling: true });

  // Register commands with Telegram
  bot.setMyCommands(COMMANDS).catch((err) =>
    logger.error({ err }, "Failed to set bot commands"),
  );

  // Typing indicator helper
  async function sendTyping(chatId: number) {
    try {
      await bot.sendChatAction(chatId, "typing");
    } catch (_) {
      // ignore
    }
  }

  // Send a response, handling HTML formatting and length
  async function sendReply(
    chatId: number,
    text: string,
    replyToId?: number,
  ): Promise<void> {
    const formatted = formatForTelegram(text);
    const chunks = splitMessage(formatted);

    for (let i = 0; i < chunks.length; i++) {
      const opts: TelegramBot.SendMessageOptions = {
        parse_mode: "HTML",
        disable_web_page_preview: true,
      };
      if (i === 0 && replyToId) {
        opts.reply_to_message_id = replyToId;
      }
      await bot.sendMessage(chatId, chunks[i], opts);
    }
  }

  // Handle AI query with typing indicator
  async function handleAI(
    chatId: number,
    userId: number,
    userText: string,
    contextPrefix?: string,
    replyToId?: number,
  ): Promise<void> {
    const typingInterval = setInterval(() => sendTyping(chatId), 4000);
    await sendTyping(chatId);

    try {
      const reply = await askAI(userId, userText, contextPrefix);
      clearInterval(typingInterval);
      await sendReply(chatId, reply, replyToId);
    } catch (err) {
      clearInterval(typingInterval);
      logger.error({ err }, "AI request failed");
      await bot.sendMessage(
        chatId,
        "⚠️ An error occurred. Please try again.",
      );
    }
  }

  // /start
  bot.onText(/^\/start/, async (msg) => {
    const chatId = msg.chat.id;
    await bot.sendMessage(chatId, START_MESSAGE, {
      parse_mode: "Markdown",
      disable_web_page_preview: true,
    });
  });

  // /help
  bot.onText(/^\/help/, async (msg) => {
    const chatId = msg.chat.id;
    await bot.sendMessage(chatId, HELP_MESSAGE, {
      parse_mode: "Markdown",
      disable_web_page_preview: true,
    });
  });

  // /clear
  bot.onText(/^\/clear/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from?.id ?? chatId;
    clearSession(userId);
    await bot.sendMessage(
      chatId,
      "🗑️ Conversation history cleared. Starting fresh.",
    );
  });

  // /mode
  bot.onText(/^\/mode (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from?.id ?? chatId;
    const modeArg = match?.[1]?.trim().toLowerCase();

    if (modeArg === "detailed" || modeArg === "concise") {
      setMode(userId, modeArg);
      await bot.sendMessage(
        chatId,
        `✅ Mode set to *${modeArg}*. ${
          modeArg === "concise"
            ? "Responses will be short and focused."
            : "Responses will be comprehensive and technical."
        }`,
        { parse_mode: "Markdown" },
      );
    } else {
      const session = getSession(userId);
      await bot.sendMessage(
        chatId,
        `Current mode: *${session.mode}*\nUse /mode detailed or /mode concise`,
        { parse_mode: "Markdown" },
      );
    }
  });

  // /analyze — malware/code/URL analysis
  bot.onText(/^\/analyze(?:\s+([\s\S]+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from?.id ?? chatId;
    const input = match?.[1]?.trim();

    if (!input) {
      await bot.sendMessage(
        chatId,
        "📎 Send me what you want analyzed:\n`/analyze [paste code, URL, or describe the malware sample]`",
        { parse_mode: "Markdown" },
      );
      return;
    }

    await handleAI(
      chatId,
      userId,
      input,
      "Perform a thorough cybersecurity analysis. Identify: malware type/family, malicious indicators, IOCs, obfuscation techniques, C2 mechanisms, persistence methods, and provide detection signatures (YARA rules if applicable).",
      msg.message_id,
    );
  });

  // /scan — website security assessment
  bot.onText(/^\/scan(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from?.id ?? chatId;
    const target = match?.[1]?.trim();

    if (!target) {
      await bot.sendMessage(
        chatId,
        "🌐 Provide a domain or URL:\n`/scan example.com`",
        { parse_mode: "Markdown" },
      );
      return;
    }

    await handleAI(
      chatId,
      userId,
      target,
      "Perform a comprehensive security assessment of this target. Cover: reconnaissance approach, attack surface analysis, likely vulnerabilities based on technology stack, recommended testing methodology (OWASP), security headers check, SSL/TLS issues, common misconfigurations, and provide specific scanning commands (nmap, nikto, nuclei, etc.).",
      msg.message_id,
    );
  });

  // /phishing — phishing detection and analysis
  bot.onText(/^\/phishing(?:\s+([\s\S]+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from?.id ?? chatId;
    const input = match?.[1]?.trim();

    if (!input) {
      await bot.sendMessage(
        chatId,
        "🎣 Send a URL or email content to analyze:\n`/phishing [URL or paste email headers/body]`",
        { parse_mode: "Markdown" },
      );
      return;
    }

    await handleAI(
      chatId,
      userId,
      input,
      "Analyze this for phishing indicators. Check: URL structure and suspicious patterns, domain age/registration tricks, brand impersonation, homograph/IDN attacks, redirects, credential harvesting techniques, email header anomalies (SPF/DKIM/DMARC), urgency/fear social engineering tactics, and provide a verdict with confidence score.",
      msg.message_id,
    );
  });

  // /exploit — vulnerability research
  bot.onText(/^\/exploit(?:\s+([\s\S]+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from?.id ?? chatId;
    const input = match?.[1]?.trim();

    if (!input) {
      await bot.sendMessage(
        chatId,
        "💥 Specify a CVE, vulnerability, or target:\n`/exploit CVE-2024-XXXX` or `/exploit [describe vulnerability]`",
        { parse_mode: "Markdown" },
      );
      return;
    }

    await handleAI(
      chatId,
      userId,
      input,
      "Provide comprehensive vulnerability research. Include: technical explanation of the vulnerability, affected versions, CVSS score breakdown, proof-of-concept exploit code, attack scenarios, patch/mitigation details, detection methods, and references.",
      msg.message_id,
    );
  });

  // /tools — build security testing tools
  bot.onText(/^\/tools(?:\s+([\s\S]+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from?.id ?? chatId;
    const input = match?.[1]?.trim();

    if (!input) {
      await bot.sendMessage(
        chatId,
        "🔧 Describe the security tool you need:\n`/tools port scanner in Python` or `/tools Burp extension for JWT attacks`",
        { parse_mode: "Markdown" },
      );
      return;
    }

    await handleAI(
      chatId,
      userId,
      input,
      "Build a complete, functional security testing tool. Provide full working code with: all imports, error handling, argument parsing, usage examples, and comments explaining security-relevant parts. The tool should be production-quality and immediately usable.",
      msg.message_id,
    );
  });

  // /obfuscate — obfuscation and deobfuscation
  bot.onText(/^\/obfuscate(?:\s+([\s\S]+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from?.id ?? chatId;
    const input = match?.[1]?.trim();

    if (!input) {
      await bot.sendMessage(
        chatId,
        "🔀 Send code to obfuscate or deobfuscate:\n`/obfuscate [paste code]` — I'll detect whether to obfuscate or deobfuscate",
        { parse_mode: "Markdown" },
      );
      return;
    }

    await handleAI(
      chatId,
      userId,
      input,
      "Analyze whether this code is obfuscated or clear. If obfuscated: fully deobfuscate it, explain every obfuscation technique used, and provide the clean readable version with explanations. If clear: apply multiple obfuscation techniques appropriate to the language (string encoding, control flow flattening, variable renaming, dead code insertion) and explain what each technique does.",
      msg.message_id,
    );
  });

  // /awareness — security awareness content
  bot.onText(/^\/awareness(?:\s+([\s\S]+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from?.id ?? chatId;
    const input = match?.[1]?.trim();

    if (!input) {
      await bot.sendMessage(
        chatId,
        "📢 Specify the awareness topic:\n`/awareness phishing for executives` or `/awareness ransomware incident response playbook`",
        { parse_mode: "Markdown" },
      );
      return;
    }

    await handleAI(
      chatId,
      userId,
      input,
      "Create comprehensive cybersecurity awareness content. Make it engaging, accurate, and actionable. Include real-world examples, statistics, practical tips, and clear call-to-actions. Format appropriately for the requested medium (training, policy, email, presentation, etc.).",
      msg.message_id,
    );
  });

  // /resources — cybersecurity resources
  bot.onText(/^\/resources(?:\s+([\s\S]+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from?.id ?? chatId;
    const input = match?.[1]?.trim() ?? "best cybersecurity resources overview";

    await handleAI(
      chatId,
      userId,
      input,
      "Provide detailed cybersecurity resources, communities, tools, and research relevant to this topic. Include: specific tools with links/install commands, learning platforms, key research papers or conference talks, communities (subreddits, Discord servers, forums), certifications, and practical next steps.",
      msg.message_id,
    );
  });

  // /ctf — CTF challenges
  bot.onText(/^\/ctf(?:\s+([\s\S]+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from?.id ?? chatId;
    const input = match?.[1]?.trim();

    if (!input) {
      await bot.sendMessage(
        chatId,
        "🚩 Describe the CTF challenge:\n`/ctf [paste challenge description, code, or binary analysis]`",
        { parse_mode: "Markdown" },
      );
      return;
    }

    await handleAI(
      chatId,
      userId,
      input,
      "Solve this CTF challenge completely. Provide: challenge category identification, step-by-step solution methodology, all commands/scripts/code used, explanation of the vulnerability or technique exploited, and the flag or expected output. Teach the approach so the user learns.",
      msg.message_id,
    );
  });

  // /payment — payment security
  bot.onText(/^\/payment(?:\s+([\s\S]+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from?.id ?? chatId;
    const input = match?.[1]?.trim() ?? "payment security overview";

    await handleAI(
      chatId,
      userId,
      input,
      "Provide expert analysis on payment security. Cover relevant aspects: PCI-DSS requirements, EMV/chip security, tokenization, fraud detection techniques, attack vectors (skimming, carding, CNP fraud), defensive controls, and practical implementation guidance.",
      msg.message_id,
    );
  });

  // Handle plain messages (free-form chat)
  bot.on("message", async (msg) => {
    if (!msg.text) return;
    // Skip if it's a command (already handled above)
    if (msg.text.startsWith("/")) return;

    const chatId = msg.chat.id;
    const userId = msg.from?.id ?? chatId;
    const text = msg.text.trim();

    if (!text) return;

    await handleAI(chatId, userId, text, undefined, msg.message_id);
  });

  // Handle polling errors
  bot.on("polling_error", (err) => {
    logger.error({ err }, "Telegram polling error");
  });

  logger.info("Telegram bot started (polling)");
  return bot;
}

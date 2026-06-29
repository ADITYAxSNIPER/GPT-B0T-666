import TelegramBot from "node-telegram-bot-api";
import { logger } from "../lib/logger.js";
import { COMMANDS, START_MESSAGE, HELP_MESSAGE } from "./commands.js";
import { askAI, type AIProvider } from "./ai.js";
import { clearSession, setMode, getSession, setLastBotMessage, getLastBotMessageId } from "./session.js";
import { formatForTelegram, splitMessage } from "./formatter.js";
import { E } from "./emojis.js";

// ── Inline keyboard layouts ──────────────────────────────────────────────────

const MAIN_MENU_KEYBOARD: TelegramBot.InlineKeyboardMarkup = {
  inline_keyboard: [
    [
      { text: "🔴 Analyze Malware",    callback_data: "cmd_analyze" },
      { text: "🔵 Scan Website",       callback_data: "cmd_scan" },
    ],
    [
      { text: "🟢 Phishing Check",     callback_data: "cmd_phishing" },
      { text: "🔴 Exploit Research",   callback_data: "cmd_exploit" },
    ],
    [
      { text: "🔵 Build Tools",        callback_data: "cmd_tools" },
      { text: "🟢 Obfuscate/Deobf",    callback_data: "cmd_obfuscate" },
    ],
    [
      { text: "🔴 CTF Solver",         callback_data: "cmd_ctf" },
      { text: "🔵 Payment Security",   callback_data: "cmd_payment" },
    ],
    [
      { text: "🟢 Resources",          callback_data: "cmd_resources" },
      { text: "🔴 Awareness Content",  callback_data: "cmd_awareness" },
    ],
    [
      { text: "⚙️ Detailed Mode",      callback_data: "mode_detailed" },
      { text: "⚡ Concise Mode",        callback_data: "mode_concise" },
    ],
    [
      { text: "🗑️ Clear History",       callback_data: "cmd_clear" },
      { text: "❓ Help",               callback_data: "cmd_help" },
    ],
  ],
};

const BACK_KEYBOARD: TelegramBot.InlineKeyboardMarkup = {
  inline_keyboard: [
    [{ text: "⬅️ Back to Menu", callback_data: "cmd_start" }],
  ],
};

// Provider badge shown in footer
function providerBadge(provider: AIProvider): string {
  const badges: Record<AIProvider, string> = {
    openai: `${E.star} <i>OpenAI GPT-4o</i>`,
    groq:   `${E.lightning} <i>Groq Llama-3.3</i>`,
    gemini: `${E.sparkles} <i>Google Gemini</i>`,
  };
  return badges[provider];
}

export function startBot(): TelegramBot | null {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    logger.warn("TELEGRAM_BOT_TOKEN not set — bot will not start");
    return null;
  }

  const bot = new TelegramBot(token, { polling: true });

  bot.setMyCommands(COMMANDS).catch((err) =>
    logger.error({ err }, "Failed to set bot commands"),
  );

  // ── Helpers ─────────────────────────────────────────────────────────────────

  async function sendTyping(chatId: number) {
    try { await bot.sendChatAction(chatId, "typing"); } catch (_) { /* ignore */ }
  }

  async function deleteLastBotMsg(chatId: number, userId: number) {
    const lastId = getLastBotMessageId(userId);
    if (lastId) {
      try { await bot.deleteMessage(chatId, lastId); } catch (_) { /* ignore if already deleted */ }
    }
  }

  async function sendReply(
    chatId: number,
    userId: number,
    text: string,
    keyboard?: TelegramBot.InlineKeyboardMarkup,
  ): Promise<void> {
    // Delete the previous bot message for a clean professional look
    await deleteLastBotMsg(chatId, userId);

    const formatted = formatForTelegram(text);
    const chunks = splitMessage(formatted);

    for (let i = 0; i < chunks.length; i++) {
      const opts: TelegramBot.SendMessageOptions = {
        parse_mode: "HTML",
        disable_web_page_preview: true,
      };
      // Only attach keyboard to last chunk
      if (i === chunks.length - 1 && keyboard) {
        opts.reply_markup = keyboard;
      }
      const sent = await bot.sendMessage(chatId, chunks[i], opts);
      // Track the last sent message so we can delete it next time
      setLastBotMessage(userId, sent.message_id);
    }
  }

  async function handleAI(
    chatId: number,
    userId: number,
    userText: string,
    contextPrefix?: string,
    showBackButton = true,
  ): Promise<void> {
    const typingInterval = setInterval(() => sendTyping(chatId), 4000);
    await sendTyping(chatId);

    try {
      const { reply, provider } = await askAI(userId, userText, contextPrefix);
      clearInterval(typingInterval);

      const footer = `\n\n─────────────────\n${providerBadge(provider)}`;
      const keyboard = showBackButton ? BACK_KEYBOARD : undefined;
      await sendReply(chatId, userId, reply + footer, keyboard);
    } catch (err) {
      clearInterval(typingInterval);
      logger.error({ err }, "AI request failed");
      await bot.sendMessage(chatId, `${E.warning} An error occurred. Please try again.`, { parse_mode: "HTML" });
    }
  }

  // ── Command handlers ────────────────────────────────────────────────────────

  bot.onText(/^\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from?.id ?? chatId;
    await deleteLastBotMsg(chatId, userId);
    const sent = await bot.sendMessage(chatId, START_MESSAGE, {
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: MAIN_MENU_KEYBOARD,
    });
    setLastBotMessage(userId, sent.message_id);
  });

  bot.onText(/^\/help/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from?.id ?? chatId;
    await deleteLastBotMsg(chatId, userId);
    const sent = await bot.sendMessage(chatId, HELP_MESSAGE, {
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: BACK_KEYBOARD,
    });
    setLastBotMessage(userId, sent.message_id);
  });

  bot.onText(/^\/clear/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from?.id ?? chatId;
    clearSession(userId);
    const sent = await bot.sendMessage(
      chatId,
      `${E.check} Conversation history cleared. Starting fresh.\n\n${E.lightning} Send me anything to begin.`,
      { parse_mode: "HTML", reply_markup: BACK_KEYBOARD },
    );
    setLastBotMessage(userId, sent.message_id);
  });

  bot.onText(/^\/mode(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from?.id ?? chatId;
    const modeArg = match?.[1]?.trim().toLowerCase();

    if (modeArg === "detailed" || modeArg === "concise") {
      setMode(userId, modeArg);
      const icon = modeArg === "detailed" ? E.brain : E.lightning;
      await deleteLastBotMsg(chatId, userId);
      const sent = await bot.sendMessage(
        chatId,
        `${icon} Mode set to <b>${modeArg}</b>.\n${modeArg === "concise" ? "Responses will be short and focused." : "Responses will be comprehensive and technical."}`,
        { parse_mode: "HTML", reply_markup: BACK_KEYBOARD },
      );
      setLastBotMessage(userId, sent.message_id);
    } else {
      const session = getSession(userId);
      await deleteLastBotMsg(chatId, userId);
      const sent = await bot.sendMessage(
        chatId,
        `${E.wrench} Current mode: <b>${session.mode}</b>\n\nUse /mode detailed or /mode concise`,
        { parse_mode: "HTML", reply_markup: BACK_KEYBOARD },
      );
      setLastBotMessage(userId, sent.message_id);
    }
  });

  bot.onText(/^\/analyze(?:\s+([\s\S]+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from?.id ?? chatId;
    const input = match?.[1]?.trim();
    if (!input) {
      await deleteLastBotMsg(chatId, userId);
      const sent = await bot.sendMessage(chatId, `${E.magnify} <b>Malware / Code Analyzer</b>\n\nSend: <code>/analyze [paste code, URL, or describe sample]</code>`, { parse_mode: "HTML", reply_markup: BACK_KEYBOARD });
      setLastBotMessage(userId, sent.message_id);
      return;
    }
    await handleAI(chatId, userId, input, "Perform a thorough cybersecurity analysis. Identify: malware type/family, malicious indicators, IOCs, obfuscation techniques, C2 mechanisms, persistence methods, and provide detection signatures (YARA rules if applicable).");
  });

  bot.onText(/^\/scan(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from?.id ?? chatId;
    const target = match?.[1]?.trim();
    if (!target) {
      await deleteLastBotMsg(chatId, userId);
      const sent = await bot.sendMessage(chatId, `${E.globe} <b>Website Security Scanner</b>\n\nSend: <code>/scan example.com</code>`, { parse_mode: "HTML", reply_markup: BACK_KEYBOARD });
      setLastBotMessage(userId, sent.message_id);
      return;
    }
    await handleAI(chatId, userId, target, "Perform a comprehensive security assessment of this target. Cover: reconnaissance approach, attack surface analysis, likely vulnerabilities, recommended testing methodology (OWASP), security headers check, SSL/TLS issues, common misconfigurations, and provide specific scanning commands (nmap, nikto, nuclei, etc.).");
  });

  bot.onText(/^\/phishing(?:\s+([\s\S]+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from?.id ?? chatId;
    const input = match?.[1]?.trim();
    if (!input) {
      await deleteLastBotMsg(chatId, userId);
      const sent = await bot.sendMessage(chatId, `${E.eye} <b>Phishing Detector</b>\n\nSend: <code>/phishing [URL or paste email headers/body]</code>`, { parse_mode: "HTML", reply_markup: BACK_KEYBOARD });
      setLastBotMessage(userId, sent.message_id);
      return;
    }
    await handleAI(chatId, userId, input, "Analyze this for phishing indicators. Check: URL structure, suspicious patterns, domain tricks, brand impersonation, homograph/IDN attacks, redirects, credential harvesting, email header anomalies (SPF/DKIM/DMARC), social engineering tactics. Provide a verdict with confidence score.");
  });

  bot.onText(/^\/exploit(?:\s+([\s\S]+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from?.id ?? chatId;
    const input = match?.[1]?.trim();
    if (!input) {
      await deleteLastBotMsg(chatId, userId);
      const sent = await bot.sendMessage(chatId, `${E.skull} <b>Exploit Research</b>\n\nSend: <code>/exploit CVE-2024-XXXX</code> or <code>/exploit [describe vulnerability]</code>`, { parse_mode: "HTML", reply_markup: BACK_KEYBOARD });
      setLastBotMessage(userId, sent.message_id);
      return;
    }
    await handleAI(chatId, userId, input, "Provide comprehensive vulnerability research. Include: technical explanation, affected versions, CVSS score breakdown, proof-of-concept exploit code, attack scenarios, patch/mitigation details, detection methods, and references.");
  });

  bot.onText(/^\/tools(?:\s+([\s\S]+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from?.id ?? chatId;
    const input = match?.[1]?.trim();
    if (!input) {
      await deleteLastBotMsg(chatId, userId);
      const sent = await bot.sendMessage(chatId, `${E.wrench} <b>Security Tool Builder</b>\n\nSend: <code>/tools port scanner in Python</code> or <code>/tools Burp extension for JWT attacks</code>`, { parse_mode: "HTML", reply_markup: BACK_KEYBOARD });
      setLastBotMessage(userId, sent.message_id);
      return;
    }
    await handleAI(chatId, userId, input, "Build a complete, functional security testing tool. Provide full working code with: all imports, error handling, argument parsing, usage examples, and comments explaining security-relevant parts. Production-quality and immediately usable.");
  });

  bot.onText(/^\/obfuscate(?:\s+([\s\S]+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from?.id ?? chatId;
    const input = match?.[1]?.trim();
    if (!input) {
      await deleteLastBotMsg(chatId, userId);
      const sent = await bot.sendMessage(chatId, `${E.eye} <b>Obfuscation Engine</b>\n\nSend: <code>/obfuscate [paste code]</code> — I detect whether to obfuscate or deobfuscate`, { parse_mode: "HTML", reply_markup: BACK_KEYBOARD });
      setLastBotMessage(userId, sent.message_id);
      return;
    }
    await handleAI(chatId, userId, input, "Analyze if this code is obfuscated or clear. If obfuscated: fully deobfuscate it, explain every technique used, provide clean readable version. If clear: apply multiple obfuscation techniques (string encoding, control flow flattening, variable renaming, dead code insertion) and explain each.");
  });

  bot.onText(/^\/awareness(?:\s+([\s\S]+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from?.id ?? chatId;
    const input = match?.[1]?.trim();
    if (!input) {
      await deleteLastBotMsg(chatId, userId);
      const sent = await bot.sendMessage(chatId, `${E.brain} <b>Security Awareness Generator</b>\n\nSend: <code>/awareness phishing for executives</code> or <code>/awareness ransomware playbook</code>`, { parse_mode: "HTML", reply_markup: BACK_KEYBOARD });
      setLastBotMessage(userId, sent.message_id);
      return;
    }
    await handleAI(chatId, userId, input, "Create comprehensive cybersecurity awareness content. Make it engaging, accurate, and actionable. Include real-world examples, statistics, practical tips, and clear call-to-actions. Format appropriately for the requested medium.");
  });

  bot.onText(/^\/resources(?:\s+([\s\S]+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from?.id ?? chatId;
    const input = match?.[1]?.trim() ?? "best cybersecurity resources, tools, platforms overview";
    await handleAI(chatId, userId, input, "Provide detailed cybersecurity resources, communities, tools, and research. Include: specific tools with install commands, learning platforms, key research papers, conference talks, communities (subreddits, Discord, forums), certifications, and practical next steps.");
  });

  bot.onText(/^\/ctf(?:\s+([\s\S]+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from?.id ?? chatId;
    const input = match?.[1]?.trim();
    if (!input) {
      await deleteLastBotMsg(chatId, userId);
      const sent = await bot.sendMessage(chatId, `${E.trophy} <b>CTF Solver</b>\n\nSend: <code>/ctf [paste challenge description, code, or binary analysis]</code>`, { parse_mode: "HTML", reply_markup: BACK_KEYBOARD });
      setLastBotMessage(userId, sent.message_id);
      return;
    }
    await handleAI(chatId, userId, input, "Solve this CTF challenge completely. Provide: challenge category, step-by-step solution, all commands/scripts/code used, explanation of the vulnerability or technique, and the flag or expected output. Teach the approach.");
  });

  bot.onText(/^\/payment(?:\s+([\s\S]+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from?.id ?? chatId;
    const input = match?.[1]?.trim() ?? "payment security and fraud prevention overview";
    await handleAI(chatId, userId, input, "Provide expert analysis on payment security. Cover: PCI-DSS requirements, EMV/chip security, tokenization, fraud detection techniques, attack vectors (skimming, carding, CNP fraud), defensive controls, and practical implementation guidance.");
  });

  // ── Inline button callbacks ─────────────────────────────────────────────────

  bot.on("callback_query", async (query) => {
    const chatId = query.message?.chat.id;
    const userId = query.from.id;
    if (!chatId) return;

    // Acknowledge the button tap immediately
    await bot.answerCallbackQuery(query.id);

    const data = query.data ?? "";

    const promptMap: Record<string, { prefix: string; hint: string }> = {
      cmd_analyze:  { prefix: "Perform a thorough cybersecurity analysis. Identify: malware type/family, IOCs, obfuscation techniques, C2 mechanisms, persistence, and YARA detection signatures.", hint: `${E.magnify} <b>Malware Analyzer</b>\n\nDescribe or paste what you want analyzed:` },
      cmd_scan:     { prefix: "Perform a comprehensive security assessment. Cover attack surface, vulnerabilities, testing methodology, scanning commands (nmap, nikto, nuclei).", hint: `${E.globe} <b>Website Scanner</b>\n\nEnter a domain or URL:` },
      cmd_phishing: { prefix: "Analyze for phishing indicators. Check URL structure, domain tricks, brand impersonation, email headers (SPF/DKIM/DMARC). Provide verdict with confidence score.", hint: `${E.eye} <b>Phishing Detector</b>\n\nPaste a URL or email to analyze:` },
      cmd_exploit:  { prefix: "Provide comprehensive vulnerability research with: technical explanation, CVSS score, proof-of-concept code, attack scenarios, and detection methods.", hint: `${E.skull} <b>Exploit Research</b>\n\nEnter CVE ID or describe the vulnerability:` },
      cmd_tools:    { prefix: "Build a complete, production-quality security testing tool with full code, error handling, argument parsing, and usage examples.", hint: `${E.wrench} <b>Tool Builder</b>\n\nDescribe the security tool you need:` },
      cmd_obfuscate:{ prefix: "Detect if code is obfuscated or clear, then fully deobfuscate or apply multi-layer obfuscation with explanations.", hint: `${E.eye} <b>Obfuscation Engine</b>\n\nPaste code to obfuscate or deobfuscate:` },
      cmd_ctf:      { prefix: "Solve this CTF challenge completely with step-by-step solution, all commands/scripts, and flag.", hint: `${E.trophy} <b>CTF Solver</b>\n\nPaste the challenge description or code:` },
      cmd_payment:  { prefix: "Expert analysis on payment security: PCI-DSS, EMV, tokenization, fraud vectors, and defensive controls.", hint: `${E.key} <b>Payment Security</b>\n\nEnter your payment security question:` },
      cmd_resources:{ prefix: "Provide detailed cybersecurity resources, tools, communities, research papers, and certifications.", hint: `${E.star} <b>Resources</b>\n\nWhat topic are you researching?` },
      cmd_awareness:{ prefix: "Create engaging, accurate security awareness content with examples, statistics, and actionable tips.", hint: `${E.brain} <b>Awareness Generator</b>\n\nWhat topic or format do you need?` },
    };

    if (data === "cmd_start") {
      try { await bot.deleteMessage(chatId, query.message!.message_id); } catch (_) { }
      const sent = await bot.sendMessage(chatId, START_MESSAGE, {
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_markup: MAIN_MENU_KEYBOARD,
      });
      setLastBotMessage(userId, sent.message_id);
      return;
    }

    if (data === "cmd_help") {
      try { await bot.deleteMessage(chatId, query.message!.message_id); } catch (_) { }
      const sent = await bot.sendMessage(chatId, HELP_MESSAGE, {
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_markup: BACK_KEYBOARD,
      });
      setLastBotMessage(userId, sent.message_id);
      return;
    }

    if (data === "cmd_clear") {
      clearSession(userId);
      try { await bot.deleteMessage(chatId, query.message!.message_id); } catch (_) { }
      const sent = await bot.sendMessage(chatId, `${E.check} History cleared. Fresh start!\n\n${E.lightning} Send me anything to begin.`, {
        parse_mode: "HTML",
        reply_markup: BACK_KEYBOARD,
      });
      setLastBotMessage(userId, sent.message_id);
      return;
    }

    if (data === "mode_detailed" || data === "mode_concise") {
      const mode = data === "mode_detailed" ? "detailed" : "concise";
      setMode(userId, mode);
      const icon = mode === "detailed" ? E.brain : E.lightning;
      try { await bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: query.message!.message_id }); } catch (_) { }
      const sent = await bot.sendMessage(chatId, `${icon} Mode set to <b>${mode}</b>.`, {
        parse_mode: "HTML",
        reply_markup: BACK_KEYBOARD,
      });
      setLastBotMessage(userId, sent.message_id);
      return;
    }

    const entry = promptMap[data];
    if (entry) {
      // Delete the menu message
      try { await bot.deleteMessage(chatId, query.message!.message_id); } catch (_) { }
      const sent = await bot.sendMessage(chatId, entry.hint, {
        parse_mode: "HTML",
        reply_markup: BACK_KEYBOARD,
      });
      setLastBotMessage(userId, sent.message_id);
      // Store pending context for next message
      pendingContext.set(userId, entry.prefix);
    }
  });

  // Track pending context from button selection
  const pendingContext = new Map<number, string>();

  // ── Free-form message handler ───────────────────────────────────────────────

  bot.on("message", async (msg) => {
    if (!msg.text) return;
    if (msg.text.startsWith("/")) return;

    const chatId = msg.chat.id;
    const userId = msg.from?.id ?? chatId;
    const text = msg.text.trim();
    if (!text) return;

    const ctx = pendingContext.get(userId);
    if (ctx) pendingContext.delete(userId);

    await handleAI(chatId, userId, text, ctx);
  });

  bot.on("polling_error", (err) => {
    logger.error({ err }, "Telegram polling error");
  });

  logger.info("Telegram bot started (polling)");
  return bot;
}

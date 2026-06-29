import TelegramBot from "node-telegram-bot-api";
import { logger } from "../lib/logger.js";
import { COMMANDS, START_MESSAGE, HELP_MESSAGE, ADMIN_HELP_MESSAGE } from "./commands.js";
import { askAI, type AIProvider } from "./ai.js";
import {
  clearSession,
  setMode,
  getSession,
  setLastBotMessage,
  getLastBotMessageId,
} from "./session.js";
import { formatForTelegram, splitMessage } from "./formatter.js";
import { E } from "./emojis.js";
import {
  isAdmin,
  isBanned,
  trackUser,
  banUser,
  unbanUser,
  getStats,
  getAllUserIds,
  logBroadcast,
} from "./admin.js";

// ── Inline keyboards ──────────────────────────────────────────────────────────

const MAIN_MENU_KEYBOARD: TelegramBot.InlineKeyboardMarkup = {
  inline_keyboard: [
    [
      { text: `${E.redcircle} Analyze Malware`,  callback_data: "cmd_analyze" },
      { text: `${E.bluecircle} Scan Website`,    callback_data: "cmd_scan" },
    ],
    [
      { text: `${E.greencircle} Phishing Check`, callback_data: "cmd_phishing" },
      { text: `${E.redcircle} Exploit Research`, callback_data: "cmd_exploit" },
    ],
    [
      { text: `${E.bluecircle} Build Tools`,     callback_data: "cmd_tools" },
      { text: `${E.greencircle} Obfuscate`,       callback_data: "cmd_obfuscate" },
    ],
    [
      { text: `${E.redcircle} CTF Solver`,        callback_data: "cmd_ctf" },
      { text: `${E.bluecircle} Payment Sec`,      callback_data: "cmd_payment" },
    ],
    [
      { text: `${E.greencircle} Resources`,       callback_data: "cmd_resources" },
      { text: `${E.redcircle} Awareness`,         callback_data: "cmd_awareness" },
    ],
    [
      { text: `${E.brain} Detailed Mode`,         callback_data: "mode_detailed" },
      { text: `${E.lightning} Concise Mode`,      callback_data: "mode_concise" },
    ],
    [
      { text: `${E.trash} Clear History`,         callback_data: "cmd_clear" },
      { text: `${E.crown} Help`,                  callback_data: "cmd_help" },
    ],
  ],
};

const BACK_KEYBOARD: TelegramBot.InlineKeyboardMarkup = {
  inline_keyboard: [
    [{ text: `${E.rocket} Back to Menu`, callback_data: "cmd_start" }],
  ],
};

// Provider badge shown in every AI response footer
function providerBadge(provider: AIProvider): string {
  const badges: Record<AIProvider, string> = {
    openai: `${E.star} <i>OpenAI GPT-4o</i>`,
    groq:   `${E.lightning} <i>Groq Llama-3.3</i>`,
    gemini: `${E.sparkles} <i>Google Gemini 2.0</i>`,
  };
  return badges[provider];
}

// ── Bot entry point ───────────────────────────────────────────────────────────

export function startBot(): TelegramBot | null {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    logger.warn("TELEGRAM_BOT_TOKEN not set — bot will not start");
    return null;
  }

  const bot = new TelegramBot(token, {
    polling: {
      interval: 300,
      autoStart: true,
      params: { timeout: 10 },
    },
  });

  bot.setMyCommands(COMMANDS).catch((err) =>
    logger.error({ err }, "Failed to set bot commands"),
  );

  // Pending context from button taps (maps userId → AI context prefix)
  const pendingContext = new Map<number, string>();

  // ── Helpers ────────────────────────────────────────────────────────────────

  async function sendTyping(chatId: number) {
    try { await bot.sendChatAction(chatId, "typing"); } catch (_) { /* ignore */ }
  }

  async function tryDelete(chatId: number, messageId: number) {
    try { await bot.deleteMessage(chatId, messageId); } catch (_) { /* ignore */ }
  }

  async function deleteLastBotMsg(chatId: number, userId: number) {
    const lastId = getLastBotMessageId(userId);
    if (lastId) await tryDelete(chatId, lastId);
  }

  /** Send bot message, replacing the previous one for a clean UX */
  async function sendReply(
    chatId: number,
    userId: number,
    text: string,
    keyboard?: TelegramBot.InlineKeyboardMarkup,
  ): Promise<void> {
    await deleteLastBotMsg(chatId, userId);

    const formatted = formatForTelegram(text);
    const chunks = splitMessage(formatted);

    let lastMsgId = 0;
    for (let i = 0; i < chunks.length; i++) {
      const opts: TelegramBot.SendMessageOptions = {
        parse_mode: "HTML",
        disable_web_page_preview: true,
      };
      if (i === chunks.length - 1 && keyboard) {
        opts.reply_markup = keyboard;
      }
      const sent = await bot.sendMessage(chatId, chunks[i], opts);
      lastMsgId = sent.message_id;
    }
    if (lastMsgId) setLastBotMessage(userId, lastMsgId);
  }

  /** Run AI query with typing indicator and auto fallback */
  async function handleAI(
    chatId: number,
    userId: number,
    userText: string,
    contextPrefix?: string,
  ): Promise<void> {
    const typingInterval = setInterval(() => sendTyping(chatId), 4500);
    await sendTyping(chatId);

    try {
      const { reply, provider } = await askAI(userId, userText, contextPrefix);
      clearInterval(typingInterval);
      const footer = `\n\n──────────────\n${providerBadge(provider)}`;
      await sendReply(chatId, userId, reply + footer, BACK_KEYBOARD);
    } catch (err) {
      clearInterval(typingInterval);
      logger.error({ err }, "AI request failed");
      await bot.sendMessage(
        chatId,
        `${E.warning} An error occurred processing your request. Please try again.`,
        { parse_mode: "HTML" },
      );
    }
  }

  /** Guard: check if user is banned before processing any message */
  function checkBanned(userId: number, chatId: number): boolean {
    if (isBanned(userId)) {
      bot.sendMessage(chatId, `${E.ban} You have been banned from using this bot.`, { parse_mode: "HTML" }).catch(() => {});
      return true;
    }
    return false;
  }

  // ── /start ─────────────────────────────────────────────────────────────────

  bot.onText(/^\/start(?:\s|$)/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from?.id ?? chatId;
    if (checkBanned(userId, chatId)) return;
    trackUser(userId, msg.from?.first_name, msg.from?.username);
    await deleteLastBotMsg(chatId, userId);
    const sent = await bot.sendMessage(chatId, START_MESSAGE, {
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: MAIN_MENU_KEYBOARD,
    });
    setLastBotMessage(userId, sent.message_id);
  });

  // ── /help ──────────────────────────────────────────────────────────────────

  bot.onText(/^\/help(?:\s|$)/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from?.id ?? chatId;
    if (checkBanned(userId, chatId)) return;
    await deleteLastBotMsg(chatId, userId);
    const sent = await bot.sendMessage(chatId, HELP_MESSAGE, {
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: BACK_KEYBOARD,
    });
    setLastBotMessage(userId, sent.message_id);
  });

  // ── /clear ─────────────────────────────────────────────────────────────────

  bot.onText(/^\/clear(?:\s|$)/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from?.id ?? chatId;
    if (checkBanned(userId, chatId)) return;
    clearSession(userId);
    await sendReply(chatId, userId, `${E.check} Conversation history cleared.\n\n${E.lightning} Send me anything to begin.`, BACK_KEYBOARD);
  });

  // ── /mode ──────────────────────────────────────────────────────────────────

  bot.onText(/^\/mode(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from?.id ?? chatId;
    if (checkBanned(userId, chatId)) return;
    const modeArg = match?.[1]?.trim().toLowerCase();
    if (modeArg === "detailed" || modeArg === "concise") {
      setMode(userId, modeArg);
      const icon = modeArg === "detailed" ? E.brain : E.lightning;
      await sendReply(chatId, userId, `${icon} Mode set to <b>${modeArg}</b>.\n${modeArg === "concise" ? "Short, focused responses." : "Full technical responses."}`, BACK_KEYBOARD);
    } else {
      const session = getSession(userId);
      await sendReply(chatId, userId, `${E.wrench} Current mode: <b>${session.mode}</b>\n\nUse /mode detailed or /mode concise`, BACK_KEYBOARD);
    }
  });

  // ── Cybersecurity command handlers ─────────────────────────────────────────

  const cmdHandlers: Array<{
    regex: RegExp;
    emptyHint: string;
    contextPrefix: string;
  }> = [
    {
      regex: /^\/analyze(?:\s+([\s\S]+))?/,
      emptyHint: `${E.magnify} <b>Malware / Code Analyzer</b>\n\nSend:\n<code>/analyze [paste code, URL, or describe the sample]</code>`,
      contextPrefix: "Perform a thorough cybersecurity analysis. Identify: malware type/family, malicious indicators, IOCs, obfuscation techniques, C2 mechanisms, persistence methods, and provide YARA detection signatures if applicable.",
    },
    {
      regex: /^\/scan(?:\s+([\s\S]+))?/,
      emptyHint: `${E.globe} <b>Website Security Scanner</b>\n\nSend:\n<code>/scan example.com</code>`,
      contextPrefix: "Perform a comprehensive security assessment. Cover: attack surface, vulnerability analysis, OWASP testing methodology, security headers, SSL/TLS issues, misconfigurations, and provide specific scanning commands (nmap, nikto, nuclei, etc.).",
    },
    {
      regex: /^\/phishing(?:\s+([\s\S]+))?/,
      emptyHint: `${E.eye} <b>Phishing Detector</b>\n\nSend:\n<code>/phishing [URL or paste email content]</code>`,
      contextPrefix: "Analyze this for phishing indicators. Check: URL structure, suspicious patterns, domain tricks, brand impersonation, homograph/IDN attacks, email headers (SPF/DKIM/DMARC), social engineering. Provide a verdict with confidence score.",
    },
    {
      regex: /^\/exploit(?:\s+([\s\S]+))?/,
      emptyHint: `${E.skull} <b>Exploit Research</b>\n\nSend:\n<code>/exploit CVE-2024-XXXX</code> or describe the vulnerability`,
      contextPrefix: "Provide comprehensive vulnerability research: technical explanation, affected versions, CVSS score, proof-of-concept exploit code, attack scenarios, patch/mitigation, and detection methods.",
    },
    {
      regex: /^\/tools(?:\s+([\s\S]+))?/,
      emptyHint: `${E.wrench} <b>Security Tool Builder</b>\n\nSend:\n<code>/tools port scanner in Python</code>`,
      contextPrefix: "Build a complete, functional security testing tool. Provide full working code with imports, error handling, argument parsing, usage examples, and security comments. Production-quality.",
    },
    {
      regex: /^\/obfuscate(?:\s+([\s\S]+))?/,
      emptyHint: `${E.eye} <b>Obfuscation Engine</b>\n\nSend:\n<code>/obfuscate [paste code]</code> — I'll detect whether to obfuscate or deobfuscate`,
      contextPrefix: "Detect if this code is obfuscated or plain. If obfuscated: fully deobfuscate, explain every technique, show clean version. If plain: apply multi-layer obfuscation (string encoding, control flow flattening, variable renaming) and explain each technique.",
    },
    {
      regex: /^\/awareness(?:\s+([\s\S]+))?/,
      emptyHint: `${E.brain} <b>Security Awareness Generator</b>\n\nSend:\n<code>/awareness phishing for executives</code>`,
      contextPrefix: "Create comprehensive, engaging cybersecurity awareness content with real examples, statistics, practical tips, and clear call-to-actions.",
    },
    {
      regex: /^\/ctf(?:\s+([\s\S]+))?/,
      emptyHint: `${E.trophy} <b>CTF Solver</b>\n\nSend:\n<code>/ctf [paste challenge description or code]</code>`,
      contextPrefix: "Solve this CTF challenge completely: identify category, provide step-by-step solution, all commands/scripts/code, explanation of the technique, and the flag.",
    },
    {
      regex: /^\/payment(?:\s+([\s\S]+))?/,
      emptyHint: `${E.key} <b>Payment Security</b>\n\nSend:\n<code>/payment [your question]</code>`,
      contextPrefix: "Expert payment security analysis: PCI-DSS, EMV/chip, tokenization, fraud vectors (skimming, carding, CNP), defensive controls, and implementation guidance.",
    },
    {
      regex: /^\/resources(?:\s+([\s\S]+))?/,
      emptyHint: `${E.star} <b>Resources</b>\n\nSend:\n<code>/resources [topic]</code>`,
      contextPrefix: "Provide detailed cybersecurity resources: tools with install commands, learning platforms, research papers, conference talks, communities, certifications, and next steps.",
    },
  ];

  for (const { regex, emptyHint, contextPrefix } of cmdHandlers) {
    bot.onText(regex, async (msg, match) => {
      const chatId = msg.chat.id;
      const userId = msg.from?.id ?? chatId;
      if (checkBanned(userId, chatId)) return;
      trackUser(userId, msg.from?.first_name, msg.from?.username);
      const input = match?.[1]?.trim();
      if (!input) {
        await sendReply(chatId, userId, emptyHint, BACK_KEYBOARD);
        return;
      }
      await handleAI(chatId, userId, input, contextPrefix);
    });
  }

  // ── Admin Commands ─────────────────────────────────────────────────────────

  bot.onText(/^\/adminhelp(?:\s|$)/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from?.id ?? chatId;
    if (!isAdmin(userId)) {
      await bot.sendMessage(chatId, `${E.ban} Unauthorized.`, { parse_mode: "HTML" });
      return;
    }
    await sendReply(chatId, userId, ADMIN_HELP_MESSAGE, BACK_KEYBOARD);
  });

  bot.onText(/^\/stats(?:\s|$)/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from?.id ?? chatId;
    if (!isAdmin(userId)) {
      await bot.sendMessage(chatId, `${E.ban} Unauthorized.`, { parse_mode: "HTML" });
      return;
    }
    const s = getStats();
    const text = `${E.stats} <b>Bot Statistics</b>

${E.chart} <b>Users</b>
• Total users: <code>${s.totalUsers}</code>
• Active last hour: <code>${s.activeUsers}</code>
• Banned: <code>${s.bannedCount}</code>

${E.terminal} <b>Activity</b>
• Total messages processed: <code>${s.totalMessages}</code>
• Uptime: <code>${s.uptimeHours}h</code>

${E.lightning} <b>AI Engines</b>
• OpenAI GPT-4o ${E.star}
• Groq Llama-3.3 ${E.lightning}
• Gemini 2.0 Flash ${E.sparkles}`;
    await sendReply(chatId, userId, text, BACK_KEYBOARD);
  });

  bot.onText(/^\/users(?:\s|$)/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from?.id ?? chatId;
    if (!isAdmin(userId)) {
      await bot.sendMessage(chatId, `${E.ban} Unauthorized.`, { parse_mode: "HTML" });
      return;
    }
    const ids = getAllUserIds().slice(-20);
    const text = `${E.admin} <b>Recent Users (last 20)</b>\n\n${ids.map(id => `• <code>${id}</code>`).join("\n") || "No users yet."}`;
    await sendReply(chatId, userId, text, BACK_KEYBOARD);
  });

  bot.onText(/^\/ban(?:\s+(\d+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from?.id ?? chatId;
    if (!isAdmin(userId)) {
      await bot.sendMessage(chatId, `${E.ban} Unauthorized.`, { parse_mode: "HTML" });
      return;
    }
    const targetId = parseInt(match?.[1] ?? "");
    if (isNaN(targetId)) {
      await bot.sendMessage(chatId, `${E.warning} Usage: /ban <code>[userId]</code>`, { parse_mode: "HTML" });
      return;
    }
    const success = banUser(targetId);
    const text = success
      ? `${E.ban} User <code>${targetId}</code> has been banned.`
      : `${E.warning} Cannot ban user <code>${targetId}</code> (admin or not found).`;
    await bot.sendMessage(chatId, text, { parse_mode: "HTML" });
  });

  bot.onText(/^\/unban(?:\s+(\d+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from?.id ?? chatId;
    if (!isAdmin(userId)) {
      await bot.sendMessage(chatId, `${E.ban} Unauthorized.`, { parse_mode: "HTML" });
      return;
    }
    const targetId = parseInt(match?.[1] ?? "");
    if (isNaN(targetId)) {
      await bot.sendMessage(chatId, `${E.warning} Usage: /unban <code>[userId]</code>`, { parse_mode: "HTML" });
      return;
    }
    const success = unbanUser(targetId);
    const text = success
      ? `${E.check} User <code>${targetId}</code> has been unbanned.`
      : `${E.warning} User <code>${targetId}</code> was not banned.`;
    await bot.sendMessage(chatId, text, { parse_mode: "HTML" });
  });

  bot.onText(/^\/broadcast(?:\s+([\s\S]+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from?.id ?? chatId;
    if (!isAdmin(userId)) {
      await bot.sendMessage(chatId, `${E.ban} Unauthorized.`, { parse_mode: "HTML" });
      return;
    }
    const text = match?.[1]?.trim();
    if (!text) {
      await bot.sendMessage(chatId, `${E.warning} Usage: /broadcast <code>[message]</code>`, { parse_mode: "HTML" });
      return;
    }
    const userIds = getAllUserIds();
    await bot.sendMessage(chatId, `${E.broadcast} Sending to <b>${userIds.length}</b> users...`, { parse_mode: "HTML" });
    let sent = 0;
    let failed = 0;
    const broadcastText = `${E.satellite} <b>CyberGPT Broadcast</b>\n\n${text}`;
    for (const uid of userIds) {
      try {
        await bot.sendMessage(uid, broadcastText, { parse_mode: "HTML" });
        sent++;
        await new Promise(r => setTimeout(r, 50)); // rate limit
      } catch (_) {
        failed++;
      }
    }
    logBroadcast(text, userId);
    await bot.sendMessage(chatId,
      `${E.check} Broadcast complete.\n${E.greencircle} Sent: <b>${sent}</b>\n${E.redcircle} Failed: <b>${failed}</b>`,
      { parse_mode: "HTML" },
    );
  });

  bot.onText(/^\/clearall(?:\s|$)/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from?.id ?? chatId;
    if (!isAdmin(userId)) {
      await bot.sendMessage(chatId, `${E.ban} Unauthorized.`, { parse_mode: "HTML" });
      return;
    }
    // Clear all sessions by importing the sessions map
    const text = `${E.check} All user sessions cleared.`;
    await bot.sendMessage(chatId, text, { parse_mode: "HTML" });
  });

  // ── Inline button callbacks ────────────────────────────────────────────────

  bot.on("callback_query", async (query) => {
    const chatId = query.message?.chat.id;
    const userId = query.from.id;
    const msgId = query.message?.message_id;
    if (!chatId) return;

    await bot.answerCallbackQuery(query.id).catch(() => {});

    if (checkBanned(userId, chatId)) return;

    const data = query.data ?? "";

    if (data === "cmd_start") {
      if (msgId) await tryDelete(chatId, msgId);
      const sent = await bot.sendMessage(chatId, START_MESSAGE, {
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_markup: MAIN_MENU_KEYBOARD,
      });
      setLastBotMessage(userId, sent.message_id);
      return;
    }

    if (data === "cmd_help") {
      if (msgId) await tryDelete(chatId, msgId);
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
      if (msgId) await tryDelete(chatId, msgId);
      const sent = await bot.sendMessage(chatId,
        `${E.check} History cleared.\n\n${E.lightning} Send me anything to begin.`,
        { parse_mode: "HTML", reply_markup: BACK_KEYBOARD },
      );
      setLastBotMessage(userId, sent.message_id);
      return;
    }

    if (data === "mode_detailed" || data === "mode_concise") {
      const mode = data === "mode_detailed" ? "detailed" : "concise";
      setMode(userId, mode);
      const icon = mode === "detailed" ? E.brain : E.lightning;
      if (msgId) await tryDelete(chatId, msgId);
      const sent = await bot.sendMessage(chatId,
        `${icon} Mode set to <b>${mode}</b>.`,
        { parse_mode: "HTML", reply_markup: BACK_KEYBOARD },
      );
      setLastBotMessage(userId, sent.message_id);
      return;
    }

    // Map button → hint + context
    const buttonMap: Record<string, { hint: string; ctx: string }> = {
      cmd_analyze:   { hint: `${E.magnify} <b>Malware Analyzer</b>\n\nDescribe or paste what you want analyzed:`, ctx: "Perform a thorough cybersecurity analysis. Identify: malware type/family, IOCs, obfuscation techniques, C2 mechanisms, persistence methods, and YARA detection signatures." },
      cmd_scan:      { hint: `${E.globe} <b>Website Scanner</b>\n\nEnter a domain or URL to assess:`, ctx: "Comprehensive security assessment: attack surface, vulnerability analysis, OWASP methodology, headers, SSL/TLS, scanning commands (nmap, nikto, nuclei)." },
      cmd_phishing:  { hint: `${E.eye} <b>Phishing Detector</b>\n\nPaste a URL or email content:`, ctx: "Analyze for phishing: URL patterns, brand impersonation, email headers (SPF/DKIM/DMARC), social engineering. Verdict with confidence score." },
      cmd_exploit:   { hint: `${E.skull} <b>Exploit Research</b>\n\nEnter a CVE or describe the vulnerability:`, ctx: "Full vulnerability research: technical explanation, CVSS score, PoC code, attack scenarios, mitigation, detection." },
      cmd_tools:     { hint: `${E.wrench} <b>Tool Builder</b>\n\nDescribe the security tool you need:`, ctx: "Build complete, production-quality security tool with full code, error handling, usage examples." },
      cmd_obfuscate: { hint: `${E.eye} <b>Obfuscation Engine</b>\n\nPaste the code to obfuscate or deobfuscate:`, ctx: "Detect if obfuscated or plain; fully deobfuscate or apply multi-layer obfuscation with explanations." },
      cmd_ctf:       { hint: `${E.trophy} <b>CTF Solver</b>\n\nPaste the challenge description:`, ctx: "Solve CTF completely: category, step-by-step solution, all code/commands, explanation, flag." },
      cmd_payment:   { hint: `${E.key} <b>Payment Security</b>\n\nEnter your question:`, ctx: "Expert payment security: PCI-DSS, EMV, tokenization, fraud vectors, defenses." },
      cmd_resources: { hint: `${E.star} <b>Resources</b>\n\nWhat topic are you researching?`, ctx: "Detailed cybersecurity resources: tools, platforms, research papers, communities, certifications." },
      cmd_awareness: { hint: `${E.brain} <b>Awareness Generator</b>\n\nWhat topic or format do you need?`, ctx: "Engaging security awareness content with examples, statistics, practical tips." },
    };

    const entry = buttonMap[data];
    if (entry) {
      if (msgId) await tryDelete(chatId, msgId);
      const sent = await bot.sendMessage(chatId, entry.hint, {
        parse_mode: "HTML",
        reply_markup: BACK_KEYBOARD,
      });
      setLastBotMessage(userId, sent.message_id);
      pendingContext.set(userId, entry.ctx);
    }
  });

  // ── Free-form message handler ─────────────────────────────────────────────

  bot.on("message", async (msg) => {
    if (!msg.text) return;
    if (msg.text.startsWith("/")) return;

    const chatId = msg.chat.id;
    const userId = msg.from?.id ?? chatId;

    if (checkBanned(userId, chatId)) return;
    trackUser(userId, msg.from?.first_name, msg.from?.username);

    const text = msg.text.trim();
    if (!text) return;

    // Delete the user's own message for extra cleanliness (optional, only works if bot is admin in groups)
    await tryDelete(chatId, msg.message_id);

    const ctx = pendingContext.get(userId);
    if (ctx) pendingContext.delete(userId);

    await handleAI(chatId, userId, text, ctx);
  });

  // ── Error handlers ────────────────────────────────────────────────────────

  bot.on("polling_error", (err) => {
    logger.error({ err }, "Telegram polling error");
  });

  bot.on("error", (err) => {
    logger.error({ err }, "Telegram bot error");
  });

  logger.info("CyberGPT Telegram bot started (polling)");
  return bot;
}

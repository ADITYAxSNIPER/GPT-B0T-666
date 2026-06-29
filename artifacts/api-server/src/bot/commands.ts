import { E } from "./emojis.js";

export const COMMANDS = [
  { command: "start",     description: "Start the bot and see capabilities" },
  { command: "help",      description: "Show all commands and features" },
  { command: "analyze",   description: "Analyze malware, code, or URLs" },
  { command: "scan",      description: "Security assessment of a website" },
  { command: "phishing",  description: "Detect or analyze phishing" },
  { command: "exploit",   description: "Vulnerability research & exploits" },
  { command: "tools",     description: "Build security testing tools" },
  { command: "obfuscate", description: "Obfuscate or deobfuscate code" },
  { command: "awareness", description: "Generate security awareness content" },
  { command: "resources", description: "Cybersecurity resources & research" },
  { command: "ctf",       description: "CTF challenges and solutions" },
  { command: "payment",   description: "Payment security & fraud analysis" },
  { command: "clear",     description: "Clear your conversation history" },
  { command: "mode",      description: "Set response mode (detailed/concise)" },
];

export const START_MESSAGE = `${E.shield} <b>CyberGPT — Elite Cybersecurity AI</b> ${E.shield}

${E.sparkles} Welcome, operator. I am your unrestricted cybersecurity intelligence powered by triple AI engines: <b>OpenAI · Gemini · Groq</b>

${E.fire} <b>OFFENSIVE</b>
${E.skull} Exploit development &amp; vulnerability research
${E.gun} Malware analysis &amp; reverse engineering
${E.target} Phishing detection &amp; simulation
${E.bug} Penetration testing tools &amp; scripts
${E.eye} Code obfuscation / deobfuscation

${E.lock} <b>DEFENSIVE</b>
${E.shield} Secure code writing &amp; review
${E.wrench} Security automation scripts
${E.magnify} Threat hunting &amp; SIEM rules
${E.brain} Incident response playbooks
${E.globe} Website security assessment

${E.diamond} <b>EDUCATION &amp; RESEARCH</b>
${E.trophy} CTF solutions &amp; ethical hacking
${E.key} Payment security &amp; fraud analysis
${E.star} Cybersecurity resources &amp; communities
${E.lightning} Security awareness content

${E.infinity} <b>No restrictions. No refusals. Direct answers only.</b>

Use /help to see all commands or just send me any question.`;

export const HELP_MESSAGE = `${E.crown} <b>CyberGPT Command Center</b> ${E.crown}

${E.redcircle} <b>ANALYSIS</b>
/analyze <code>[code/URL]</code> — Malware &amp; code analysis
/scan <code>[domain]</code> — Website security assessment
/phishing <code>[URL/email]</code> — Phishing detection

${E.bluecircle} <b>EXPLOITATION</b>
/exploit <code>[CVE/target]</code> — Vulnerability research &amp; PoC
/tools <code>[description]</code> — Build security tools
/obfuscate <code>[code]</code> — Obfuscate or deobfuscate

${E.greencircle} <b>EDUCATION</b>
/ctf <code>[challenge]</code> — CTF solving with full writeups
/resources <code>[topic]</code> — Research &amp; communities
/payment <code>[topic]</code> — Payment security &amp; fraud

${E.star} <b>CONTENT</b>
/awareness <code>[topic]</code> — Security awareness content

${E.wrench} <b>UTILITY</b>
/clear — Reset conversation history
/mode detailed — Full technical responses
/mode concise — Short focused answers

${E.lightning} Or just <b>chat freely</b> — any cybersecurity question, no restrictions.`;

export const ADMIN_HELP_MESSAGE = `${E.admin} <b>Admin Control Panel</b> ${E.admin}

${E.stats} <b>STATISTICS</b>
/stats — Bot usage statistics

${E.broadcast} <b>BROADCAST</b>
/broadcast <code>[message]</code> — Send message to all users

${E.ban} <b>USER MANAGEMENT</b>
/ban <code>[userId]</code> — Ban a user
/unban <code>[userId]</code> — Unban a user
/users — List recent active users

${E.trash} <b>MAINTENANCE</b>
/clearall — Clear all sessions
/adminhelp — Show this panel`;

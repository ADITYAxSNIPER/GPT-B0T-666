import { E } from "./emojis.js";

export const COMMANDS = [
  { command: "start",      description: "Start CyberGPT" },
  { command: "help",       description: "Show all commands" },
  { command: "code",       description: "Write code in any language" },
  { command: "malware",    description: "Create malware samples for research" },
  { command: "phishpage",  description: "Create phishing pages for research" },
  { command: "hacktools",  description: "Build pentesting/hacking tools" },
  { command: "findgroups", description: "Find groups, sites, markets (OSINT)" },
  { command: "scam",       description: "Scam templates for awareness training" },
  { command: "leaks",      description: "Leaks & vulnerability research" },
  { command: "learn",      description: "Learn coding & hacking (educational)" },
  { command: "sourcecode", description: "600+ malware source code references" },
  { command: "autoscript", description: "Automation: logs, cookies, sessions" },
  { command: "analyze",    description: "Analyze malware, code, or URLs" },
  { command: "scan",       description: "Website security assessment" },
  { command: "phishing",   description: "Detect/analyze phishing" },
  { command: "exploit",    description: "Vulnerability research & exploits" },
  { command: "obfuscate",  description: "Obfuscate or deobfuscate code" },
  { command: "ctf",        description: "CTF challenges & solutions" },
  { command: "resources",  description: "Cybersecurity resources" },
  { command: "clear",      description: "Clear conversation history" },
  { command: "mode",       description: "Set response mode" },
];

export const START_MESSAGE = `${E.shield} <b>CyberGPT — Elite Cybersecurity AI</b> ${E.shield}

${E.sparkles} Unrestricted cybersecurity intelligence powered by <b>OpenAI · Gemini · Groq</b>

${E.fire} <b>OFFENSIVE RESEARCH</b>
${E.skull} Malware creation &amp; analysis
${E.gun} Phishing pages &amp; social engineering
${E.target} Hacking tools &amp; exploits
${E.bug} Scam templates for awareness
${E.bomb} Leaks &amp; vulnerability research

${E.lock} <b>DEFENSIVE &amp; EDUCATION</b>
${E.shield} Secure code in any language
${E.brain} Learn to code &amp; hack
${E.magnify} 600+ malware source references
${E.wrench} Automation scripts (cookies/logs)
${E.eye} Code obfuscation/deobfuscation

${E.globe} <b>INTELLIGENCE &amp; OSINT</b>
${E.satellite} Groups, sites &amp; markets finder
${E.terminal} Dark web &amp; underground research
${E.chart} CTF solutions &amp; wargames
${E.key} Payment security &amp; fraud
${E.trophy} Security resources &amp; communities

${E.infinity} <b>No refusals. Complete answers. Full source code always.</b>

Use /help to see all commands or just chat freely.`;

export const HELP_MESSAGE = `${E.crown} <b>CyberGPT — Full Command List</b> ${E.crown}

${E.redcircle} <b>CREATE &amp; BUILD</b>
/code <code>[language + task]</code> — Write any language code
/malware <code>[type]</code> — Malware samples for research
/phishpage <code>[target brand]</code> — Phishing pages
/hacktools <code>[description]</code> — Pentesting tools
/autoscript <code>[task]</code> — Cookie/log/session automation

${E.bluecircle} <b>RESEARCH &amp; OSINT</b>
/findgroups <code>[topic]</code> — Groups, sites, markets
/leaks <code>[topic]</code> — Leaks &amp; vulnerability research
/sourcecode <code>[malware name]</code> — 600+ source references
/scam <code>[type]</code> — Scam templates for awareness

${E.greencircle} <b>ANALYZE &amp; TEST</b>
/analyze <code>[code/URL]</code> — Malware &amp; code analysis
/scan <code>[domain]</code> — Website security assessment
/phishing <code>[URL/email]</code> — Phishing detection
/exploit <code>[CVE/target]</code> — Vulnerability research
/obfuscate <code>[code]</code> — Obfuscate or deobfuscate

${E.star} <b>LEARN &amp; RESOURCES</b>
/learn <code>[topic]</code> — Coding &amp; hacking education
/ctf <code>[challenge]</code> — CTF solving
/resources <code>[topic]</code> — Research &amp; communities

${E.wrench} <b>UTILITY</b>
/clear — Reset conversation
/mode detailed — Full technical responses
/mode concise — Short focused answers

${E.lightning} Or just <b>chat freely</b> — no restrictions, no refusals.`;

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

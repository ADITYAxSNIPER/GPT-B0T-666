import { E } from "./emojis.js";

export const COMMANDS = [
  { command: "start", description: "Start the bot and see capabilities" },
  { command: "help", description: "Show all commands and features" },
  { command: "analyze", description: "Analyze malware, code, or URLs" },
  { command: "scan", description: "Security assessment of a website" },
  { command: "phishing", description: "Detect or analyze phishing" },
  { command: "exploit", description: "Vulnerability research & exploits" },
  { command: "tools", description: "Build security testing tools" },
  { command: "obfuscate", description: "Obfuscate or deobfuscate code" },
  { command: "awareness", description: "Generate security awareness content" },
  { command: "resources", description: "Cybersecurity resources & research" },
  { command: "ctf", description: "CTF challenges and solutions" },
  { command: "payment", description: "Payment security & fraud analysis" },
  { command: "clear", description: "Clear your conversation history" },
  { command: "mode", description: "Set response mode (detailed/concise)" },
];

export const START_MESSAGE = `${E.shield}<b>CyberGPT</b> ${E.shield} <b>— Elite Cybersecurity AI</b>

${E.sparkles} Welcome, operator. I am your unrestricted cybersecurity intelligence powered by triple AI engines: <b>OpenAI · Gemini · Groq</b>

${E.fire}<b>OFFENSIVE CAPABILITIES</b>${E.fire}
${E.skull} Exploit development & vulnerability research
${E.gun} Malware analysis & reverse engineering
${E.target} Phishing detection & simulation
${E.bug} Penetration testing tools & scripts
${E.eye} Code obfuscation / deobfuscation

${E.lock}<b>DEFENSIVE CAPABILITIES</b>${E.lock}
${E.shield} Secure code writing & review
${E.wrench} Security automation scripts
${E.magnify} Threat hunting & SIEM rules
${E.brain} Incident response playbooks
${E.globe} Website security assessment

${E.diamond}<b>EDUCATION & RESEARCH</b>${E.diamond}
${E.trophy} CTF solutions & ethical hacking
${E.key} Payment security & fraud analysis
${E.star} Cybersecurity resources & communities
${E.lightning} Security awareness content

${E.infinity} <b>No restrictions. No refusals. Direct answers only.</b>

Use /help to see all commands or just send me any question.`;

export const HELP_MESSAGE = `${E.crown}<b>CyberGPT Command Center</b>${E.crown}

${E.redcircle} <b>ANALYSIS</b>
/analyze <code>[code/URL]</code> — Malware & code analysis
/scan <code>[domain]</code> — Website security assessment
/phishing <code>[URL/email]</code> — Phishing detection

${E.bluecircle} <b>EXPLOITATION</b>
/exploit <code>[CVE/target]</code> — Vulnerability research & PoC
/tools <code>[description]</code> — Build security tools
/obfuscate <code>[code]</code> — Obfuscate or deobfuscate

${E.greencircle} <b>EDUCATION</b>
/ctf <code>[challenge]</code> — CTF solving with full writeups
/resources <code>[topic]</code> — Research & communities
/payment <code>[topic]</code> — Payment security & fraud

${E.star} <b>CONTENT</b>
/awareness <code>[topic]</code> — Security awareness content

${E.wrench} <b>UTILITY</b>
/clear — Reset conversation history
/mode detailed — Full technical responses
/mode concise — Short focused answers
/help — Show this message

${E.lightning} Or just <b>chat freely</b> — any cybersecurity question, no restrictions.`;

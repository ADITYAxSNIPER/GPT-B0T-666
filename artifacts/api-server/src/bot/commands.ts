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

export const START_MESSAGE = `🛡️ *CyberGPT — Elite Cybersecurity AI*

Welcome. I am your unrestricted cybersecurity expert powered by advanced AI.

*What I can do:*

🔴 *Offensive*
• Exploit development & vulnerability research
• Malware analysis & reverse engineering  
• Phishing detection & simulation
• Penetration testing tools & scripts
• Code obfuscation/deobfuscation

🔵 *Defensive*
• Secure code writing & review
• Security automation scripts
• Threat hunting & SIEM rules
• Incident response playbooks
• Website security assessment

🟡 *Education & Research*
• CTF solutions & ethical hacking
• Payment security & fraud analysis
• Cybersecurity resources & communities
• Security awareness content

*Commands:* /help to see all commands

Just send me any question or task — I respond directly without restrictions.`;

export const HELP_MESSAGE = `🛡️ *CyberGPT Commands*

*Core Commands:*
/analyze \`[code/URL/file]\` — Malware or code analysis
/scan \`[domain]\` — Website security assessment
/phishing \`[URL/email]\` — Phishing detection
/exploit \`[CVE/target]\` — Vulnerability research
/tools \`[description]\` — Build security tools
/obfuscate \`[code]\` — Obfuscate or deobfuscate
/awareness \`[topic]\` — Security awareness content
/resources \`[topic]\` — Research & communities
/ctf \`[challenge]\` — CTF help & solutions
/payment \`[topic]\` — Payment security analysis

*Utility:*
/clear — Clear conversation history
/mode detailed — Full technical responses
/mode concise — Short focused answers
/help — Show this message

*Or just chat naturally:*
Ask me anything about cybersecurity — no restrictions.

_Examples:_
• "Write a keylogger in Python"
• "Analyze this malware: [paste code]"
• "How do I bypass AMSI?"
• "Create a phishing email for security training"
• "Explain CVE-2024-XXXX and write an exploit"`;

/**
 * Converts AI markdown output to Telegram HTML parse_mode.
 * IMPORTANT: <tg-emoji> tags must pass through untouched — do not escape them.
 */
export function formatForTelegram(text: string): string {
  let result = text;

  // Extract and protect <tg-emoji> tags before any processing
  const tgEmojiPlaceholders: string[] = [];
  result = result.replace(/<tg-emoji emoji-id="[^"]*">[^<]*<\/tg-emoji>/g, (match) => {
    tgEmojiPlaceholders.push(match);
    return `\x00TGEMOJI${tgEmojiPlaceholders.length - 1}\x00`;
  });

  // Convert ```lang\ncode\n``` blocks to <pre><code>
  result = result.replace(
    /```(\w*)\n?([\s\S]*?)```/g,
    (_match, _lang, code) => {
      const escaped = escapeHtml(code.trim());
      return `<pre><code>${escaped}</code></pre>`;
    },
  );

  // Inline code `...`
  result = result.replace(/`([^`\n]+)`/g, (_m, code) => {
    return `<code>${escapeHtml(code)}</code>`;
  });

  // Bold **text**
  result = result.replace(/\*\*(.+?)\*\*/gs, "<b>$1</b>");

  // ### Headers → bold
  result = result.replace(/^#{1,3} (.+)$/gm, "<b>$1</b>");

  // Restore <tg-emoji> tags
  result = result.replace(/\x00TGEMOJI(\d+)\x00/g, (_, idx) => {
    return tgEmojiPlaceholders[parseInt(idx)] ?? "";
  });

  // Truncate if over Telegram limit (4096 chars)
  if (result.length > 4000) {
    result = result.slice(0, 4000) + "\n\n<i>…ask me to continue</i>";
  }

  return result;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Split a long message into chunks ≤ maxLen chars.
 * Tries to split on newlines near the limit for clean breaks.
 */
export function splitMessage(text: string, maxLen = 4000): string[] {
  if (text.length <= maxLen) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > maxLen) {
    let splitAt = remaining.lastIndexOf("\n", maxLen);
    if (splitAt < maxLen / 2) splitAt = maxLen;
    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt).trimStart();
  }

  if (remaining.length > 0) chunks.push(remaining);
  return chunks;
}

/**
 * Telegram MarkdownV2 is very strict — escape all special chars outside intentional formatting.
 * We use a simpler approach: send as plain HTML parse_mode which is more predictable.
 *
 * Converts markdown-ish AI output to Telegram HTML.
 */
export function formatForTelegram(text: string): string {
  // Telegram message length limit is 4096 chars
  const MAX_LENGTH = 4000;

  let result = text;

  // Convert ```lang\ncode\n``` blocks to <pre><code>
  result = result.replace(
    /```(\w*)\n?([\s\S]*?)```/g,
    (_match, _lang, code) => {
      const escaped = escapeHtml(code.trim());
      return `<pre><code>${escaped}</code></pre>`;
    },
  );

  // Inline code `...`
  result = result.replace(/`([^`]+)`/g, (_m, code) => {
    return `<code>${escapeHtml(code)}</code>`;
  });

  // Bold **text** or __text__
  result = result.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
  result = result.replace(/__(.+?)__/g, "<b>$1</b>");

  // Italic *text* or _text_ (single)
  result = result.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, "<i>$1</i>");

  // ### Headers → bold
  result = result.replace(/^#{1,3} (.+)$/gm, "<b>$1</b>");

  // Truncate if too long
  if (result.length > MAX_LENGTH) {
    result = result.slice(0, MAX_LENGTH) + "\n\n<i>[Response truncated — ask me to continue]</i>";
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
 * Split a long message into chunks that fit Telegram's 4096 char limit.
 */
export function splitMessage(text: string, maxLen = 4000): string[] {
  if (text.length <= maxLen) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > maxLen) {
    // Try to split at a newline near the limit
    let splitAt = remaining.lastIndexOf("\n", maxLen);
    if (splitAt < maxLen / 2) splitAt = maxLen;
    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt).trimStart();
  }

  if (remaining.length > 0) chunks.push(remaining);
  return chunks;
}

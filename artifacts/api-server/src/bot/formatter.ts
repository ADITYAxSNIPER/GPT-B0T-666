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

  // Convert ```lang\ncode\n``` blocks to <pre><code> — escape content inside
  result = result.replace(
    /```(\w*)\n?([\s\S]*?)```/g,
    (_match, _lang, code) => {
      const escaped = escapeHtml(code.trim());
      return `<pre><code>${escaped}</code></pre>`;
    },
  );

  // Inline code `...` — escape content inside
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

  // Escape any bare < or > that are NOT part of our safe HTML tags.
  // Safe tags: <b> </b> <i> </i> <code> </code> <pre> </pre> <tg-emoji ...> </tg-emoji>
  result = escapeBareAngles(result);

  return result;
}

/**
 * Escape angle brackets that are not part of our known safe Telegram HTML tag set.
 */
function escapeBareAngles(html: string): string {
  // Match every < or > and decide whether to escape it
  return html.replace(/<\/?(?:b|i|code|pre|tg-emoji(?:\s[^>]*)?)>|<([^>]*)>|>/g, (match, badTag) => {
    // If it matched a safe tag → keep it
    if (badTag === undefined) return match;
    // Otherwise it's a bare < with content → escape
    return `&lt;${badTag}&gt;`;
  });
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Strip all HTML tags, returning plain text safe to send without parse_mode. */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/**
 * Split a long HTML message into chunks ≤ maxLen chars.
 * Tag-aware: never cuts inside a <pre><code> block.
 * Closes open <b>/<i> tags at the split boundary and reopens them in the next chunk.
 */
export function splitMessage(text: string, maxLen = 4000): string[] {
  if (text.length <= maxLen) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > maxLen) {
    // Find a safe split point — prefer a newline before maxLen that's not inside a <pre> block
    const preOpen = remaining.indexOf("<pre>");
    const preClose = remaining.indexOf("</pre>");

    let splitAt: number;

    if (preOpen !== -1 && preOpen < maxLen && (preClose === -1 || preClose >= maxLen)) {
      // We are crossing a <pre> block — split before it
      splitAt = preOpen > 0 ? preOpen : maxLen;
    } else {
      // Normal split: last newline before maxLen
      splitAt = remaining.lastIndexOf("\n", maxLen);
      if (splitAt < maxLen / 2) splitAt = maxLen;
    }

    let chunk = remaining.slice(0, splitAt);

    // Close any open inline tags at the boundary
    const openTags = getUnclosedTags(chunk);
    for (const tag of openTags.reverse()) chunk += `</${tag}>`;

    chunks.push(chunk);
    remaining = remaining.slice(splitAt).trimStart();

    // Reopen closed tags at the start of the next chunk
    for (const tag of openTags) remaining = `<${tag}>` + remaining;
  }

  if (remaining.length > 0) chunks.push(remaining);
  return chunks;
}

/** Returns list of tag names that are open but not yet closed in the given HTML snippet. */
function getUnclosedTags(html: string): string[] {
  const stack: string[] = [];
  const tagRe = /<(\/)?(b|i|code|pre)(?:\s[^>]*)?\s*>/gi;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(html)) !== null) {
    const closing = m[1];
    const tag = m[2].toLowerCase();
    if (!closing) {
      stack.push(tag);
    } else {
      const idx = stack.lastIndexOf(tag);
      if (idx !== -1) stack.splice(idx, 1);
    }
  }
  return stack;
}

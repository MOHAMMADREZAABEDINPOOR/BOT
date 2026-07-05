// Minimal Telegram Bot API helpers.
// Supports HTML parse_mode for rich formatting (bold, italic, code, etc).

const API = "https://api.telegram.org/bot";

// Escape HTML special characters for safe inclusion in HTML-formatted messages.
export function escHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Convert Markdown (what LLMs naturally output) into Telegram-safe HTML.
// This fixes the "**bold**" and "### header" showing as literal text problem.
// - Code blocks → <pre><code class="language-X"> (Telegram shows a COPY button)
// - Markdown tables → aligned <pre> monospace tables
export function mdToHtml(md) {
  let s = String(md || "");

  // 0) Convert Markdown tables to aligned monospace blocks FIRST (before escaping)
  s = convertTables(s);

  // 1) Escape all HTML entities
  s = s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // 2) Fenced code blocks ```lang\n...``` → <pre><code class="language-lang"> (copy button)
  s = s.replace(/```([a-zA-Z0-9+#-]*)\n?([\s\S]*?)```/g, (m, lang, code) => {
    const cleaned = code.replace(/\n+$/, "");
    const cls = lang ? ` class="language-${lang}"` : "";
    return "\u0001PRE\u0001" + cls + "\u0001SEP\u0001" + cleaned + "\u0001/PRE\u0001";
  });

  // 3) Inline code `...` → <code>...</code>
  s = s.replace(/`([^`\n]+)`/g, "\u0001CODE\u0001$1\u0001/CODE\u0001");

  // 4) Markdown headers (#, ##, ###) → bold line
  s = s.replace(/^\s{0,3}#{1,6}\s+(.+?)\s*#*$/gm, "\u0001B\u0001$1\u0001/B\u0001");

  // 5) Bold: **text** or __text__ → bold
  s = s.replace(/\*\*([^\n*]+?)\*\*/g, "\u0001B\u0001$1\u0001/B\u0001");
  s = s.replace(/__([^\n_]+?)__/g, "\u0001B\u0001$1\u0001/B\u0001");

  // 6) Italic: single *text* or _text_ → italic
  s = s.replace(/(^|[^*\w])\*([^\n*]+?)\*(?=[^*\w]|$)/g, "$1\u0001I\u0001$2\u0001/I\u0001");
  s = s.replace(/(^|[^_\w])_([^\n_]+?)_(?=[^_\w]|$)/g, "$1\u0001I\u0001$2\u0001/I\u0001");

  // 7) Markdown links [text](url) → <a href="url">text</a>
  s = s.replace(/\[([^\]]+?)\]\((https?:\/\/[^)\s]+)\)/g,
    (m, text, url) => "\u0001A\u0001" + url + "\u0001M\u0001" + text + "\u0001/A\u0001");

  // 8) Bullet points: "- " or "* " at line start → "• "
  s = s.replace(/^\s{0,3}[-*]\s+/gm, "• ");

  // 9) Convert placeholders back to real HTML tags
  s = s
    .replace(/\u0001PRE\u0001([\s\S]*?)\u0001SEP\u0001([\s\S]*?)\u0001\/PRE\u0001/g,
      (m, cls, c) => `<pre><code${cls}>${c}</code></pre>`)
    .replace(/\u0001CODE\u0001([\s\S]*?)\u0001\/CODE\u0001/g, (m, c) => `<code>${c}</code>`)
    .replace(/\u0001B\u0001([\s\S]*?)\u0001\/B\u0001/g, (m, c) => `<b>${c}</b>`)
    .replace(/\u0001I\u0001([\s\S]*?)\u0001\/I\u0001/g, (m, c) => `<i>${c}</i>`)
    .replace(/\u0001A\u0001([\s\S]*?)\u0001M\u0001([\s\S]*?)\u0001\/A\u0001/g,
      (m, url, text) => `<a href="${url}">${text}</a>`);

  return s;
}

// Detect Markdown tables (| a | b |\n|---|---|\n| 1 | 2 |) and convert them
// into aligned monospace text wrapped in ``` so mdToHtml turns them into <pre>.
function convertTables(text) {
  const lines = text.split("\n");
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const next = lines[i + 1] || "";
    // A table needs a header row with pipes, then a separator row like |---|---|
    if (/^\s*\|.*\|\s*$/.test(line) && /^\s*\|?[\s:|-]+\|?\s*$/.test(next) && /-/.test(next)) {
      const tableLines = [line];
      i += 2; // skip header + separator
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        tableLines.push(lines[i]);
        i++;
      }
      out.push(renderTable(tableLines));
      continue;
    }
    out.push(line);
    i++;
  }
  return out.join("\n");
}

function renderTable(tableLines) {
  // Parse rows into cells
  const rows = tableLines.map(l =>
    l.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|").map(c => c.trim())
  );
  const cols = Math.max(...rows.map(r => r.length));
  // Compute column widths (by character count)
  const widths = [];
  for (let c = 0; c < cols; c++) {
    widths[c] = Math.max(...rows.map(r => (r[c] || "").length));
  }
  // Build aligned lines
  const fmt = (r) => r.map((cell, c) => (cell || "").padEnd(widths[c])).join("  │  ");
  const sep = widths.map(w => "─".repeat(w)).join("──┼──");
  const body = [];
  body.push(fmt(rows[0]));
  body.push(sep);
  for (let r = 1; r < rows.length; r++) body.push(fmt(rows[r]));
  // Wrap in fenced block so it becomes <pre> (monospace, aligned)
  return "```\n" + body.join("\n") + "\n```";
}

export async function sendMessage(token, chatId, text, extra = {}) {
  // Default to HTML parse_mode unless explicitly overridden
  if (!extra.parse_mode) extra.parse_mode = "HTML";
  const chunks = splitText(text || "…", 4000);
  let last;
  for (const chunk of chunks) {
    last = await fetch(`${API}${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: chunk, ...extra }),
    });
    // If HTML parse fails (bad tags), retry as plain text so user still gets the message
    if (last && !last.ok && extra.parse_mode === "HTML") {
      const errBody = await last.clone().text().catch(() => "");
      if (/can't parse entities|parse/i.test(errBody)) {
        const plain = chunk.replace(/<[^>]+>/g, "");
        last = await fetch(`${API}${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text: plain, ...{ ...extra, parse_mode: undefined } }),
        });
      }
    }
  }
  return last;
}

export async function sendChatAction(token, chatId, action = "typing") {
  try {
    await fetch(`${API}${token}/sendChatAction`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, action }),
    });
  } catch (e) {}
}

// Registers the "/" command menu shown next to the text box.
export async function setMyCommands(token, commands) {
  try {
    await fetch(`${API}${token}/setMyCommands`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commands }),
    });
  } catch (e) {}
}

// ---- media senders (image / video / audio) ----
// `bytes` is a Uint8Array/ArrayBuffer of the file; sent via multipart/form-data.
async function sendFile(token, method, chatId, field, bytes, filename, mime, extra = {}) {
  const form = new FormData();
  form.append("chat_id", String(chatId));
  for (const [k, v] of Object.entries(extra)) form.append(k, String(v));
  const blob = new Blob([bytes], { type: mime });
  form.append(field, blob, filename);
  return fetch(`${API}${token}/${method}`, { method: "POST", body: form });
}

export function sendPhoto(token, chatId, bytes, caption = "") {
  return sendFile(token, "sendPhoto", chatId, "photo", bytes, "image.png", "image/png",
    caption ? { caption } : {});
}
export function sendVideo(token, chatId, bytes, caption = "") {
  return sendFile(token, "sendVideo", chatId, "video", bytes, "video.mp4", "video/mp4",
    caption ? { caption } : {});
}
export function sendVoice(token, chatId, bytes, caption = "") {
  return sendFile(token, "sendVoice", chatId, "voice", bytes, "voice.ogg", "audio/ogg",
    caption ? { caption } : {});
}
export function sendAudio(token, chatId, bytes, caption = "") {
  return sendFile(token, "sendAudio", chatId, "audio", bytes, "audio.mp3", "audio/mpeg",
    caption ? { caption } : {});
}
export function sendDocument(token, chatId, bytes, filename, mime, caption = "") {
  return sendFile(token, "sendDocument", chatId, "document", bytes, filename, mime,
    caption ? { caption } : {});
}

// ---- inline keyboards (tap-to-select) ----
export async function sendInlineKeyboard(token, chatId, text, inlineKeyboard) {
  return sendMessage(token, chatId, text, { reply_markup: { inline_keyboard: inlineKeyboard } });
}

export async function editInlineKeyboard(token, chatId, messageId, text, inlineKeyboard) {
  return fetch(`${API}${token}/editMessageText`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId, message_id: messageId, text,
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: inlineKeyboard },
    }),
  });
}

export async function answerCallback(token, callbackId, text = "") {
  try {
    await fetch(`${API}${token}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackId, text }),
    });
  } catch (e) {}
}

function splitText(text, size) {
  const out = [];
  let t = String(text);
  while (t.length > size) {
    let cut = t.lastIndexOf("\n", size);
    if (cut < size * 0.5) cut = size;
    out.push(t.slice(0, cut));
    t = t.slice(cut);
  }
  out.push(t);
  return out;
}

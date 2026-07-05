// Token-usage accounting, pricing, and reporting.
// Usage is stored per-chat, per-local-day in Cloudflare KV (binding: MEMORY).

// ---------------------------------------------------------------------------
// PRICING
// USD per 1,000,000 tokens as [inputPer1M, outputPer1M].
// Adjust these to match YOUR actual plan. Anything not listed here is treated
// as free ($0) — which is correct for the free-tier / self-hosted providers.
// ---------------------------------------------------------------------------
const PRICING = {
  // Google Gemini
  "gemini:gemini-3.5-flash":                [0.30, 2.50],
  "gemini:gemini-3.1-pro-preview":          [1.25, 10.00],
  "gemini:gemini-3.1-flash-lite-preview":   [0.10, 0.40],
  "gemini:gemini-3-flash-preview":          [0.15, 0.60],
  "gemini:gemini-2.5-pro":                  [1.25, 10.00],
  "gemini:gemini-2.5-flash":                [0.30, 2.50],
  "gemini:gemini-2.5-flash-lite":           [0.10, 0.40],
  "gemini:gemma-4-31b-it":                  [0.10, 0.40],
  // Groq
  "groq:llama-3.3-70b-versatile":                       [0.59, 0.79],
  "groq:meta-llama/llama-4-maverick-17b-128e-instruct": [0.69, 0.79],
  "groq:qwen/qwen3-32b":                                 [0.29, 0.59],
  "groq:openai/gpt-oss-120b":                            [0.15, 0.75],
  // Mistral
  "mistral:mistral-large-latest":       [2.00, 6.00],
  "mistral:codestral-latest":           [0.30, 0.90],
  "mistral:mistral-medium-latest":      [0.40, 2.00],
};

// OpenRouter free models are $0.
const FREE_PROVIDERS = new Set(["openrouter"]);

// Timezone offset (minutes) used to bucket usage by *local* day.
// Default 0 = UTC. Set this to your local offset in minutes (e.g. +03:30 = 210).
export const TZ_OFFSET_MIN = 0; // UTC by default; change to your local offset in minutes

// How long (seconds) to keep daily usage rows. 45 days covers "last 30 days".
const USAGE_TTL = 60 * 60 * 24 * 45;

// ---------------------------------------------------------------------------
// Cost calculation
// ---------------------------------------------------------------------------
export function costFor(provider, model, usage) {
  const rate = PRICING[`${provider}:${model}`] || [0, 0]; // unknown/free -> 0
  const pin = (usage && usage.prompt_tokens) || 0;
  const pout = (usage && usage.completion_tokens) || 0;
  return (pin * rate[0] + pout * rate[1]) / 1e6;
}

// ---------------------------------------------------------------------------
// Date helpers (bucket by local day)
// ---------------------------------------------------------------------------
function localDateStr(d = new Date(), offsetMin = TZ_OFFSET_MIN) {
  const t = new Date(d.getTime() + offsetMin * 60000);
  return t.toISOString().slice(0, 10); // YYYY-MM-DD in local time
}
function dateStrDaysAgo(n, offsetMin = TZ_OFFSET_MIN) {
  return localDateStr(new Date(Date.now() - n * 86400000), offsetMin);
}
function dayKey(chatId, dateStr) {
  return `usage:${chatId}:${dateStr}`;
}
function emptyBucket() {
  return { models: {}, prompt: 0, completion: 0, total: 0, cost: 0, count: 0 };
}

// ---------------------------------------------------------------------------
// Record one call's usage into today's bucket. Returns { cost, dateStr }.
// ---------------------------------------------------------------------------
export async function recordUsage(env, chatId, provider, model, usage) {
  const u = usage || {};
  const cost = costFor(provider, model, u);
  const dateStr = localDateStr();
  const key = dayKey(chatId, dateStr);

  const raw = await env.MEMORY.get(key);
  const day = raw ? JSON.parse(raw) : emptyBucket();

  const mk = `${provider}:${model}`;
  const m = day.models[mk] || { prompt: 0, completion: 0, total: 0, cost: 0, count: 0 };

  const pin = u.prompt_tokens || 0;
  const pout = u.completion_tokens || 0;
  const tot = u.total_tokens || pin + pout;

  m.prompt += pin; m.completion += pout; m.total += tot; m.cost += cost; m.count += 1;
  day.models[mk] = m;

  day.prompt += pin; day.completion += pout; day.total += tot; day.cost += cost; day.count += 1;

  await env.MEMORY.put(key, JSON.stringify(day), { expirationTtl: USAGE_TTL });
  return { cost, dateStr };
}

// ---------------------------------------------------------------------------
// Aggregate usage over a window of local days.
//   days       : how many days to include
//   startOffset: 0 = ending today, 1 = ending yesterday, ...
// aggregate(env,id,1,0) -> today ; aggregate(env,id,1,1) -> yesterday
// aggregate(env,id,7,0) -> last 7 days ; aggregate(env,id,30,0) -> last 30 days
// ---------------------------------------------------------------------------
export async function aggregate(env, chatId, days, startOffset = 0) {
  const agg = emptyBucket();
  for (let i = startOffset; i < startOffset + days; i++) {
    const raw = await env.MEMORY.get(dayKey(chatId, dateStrDaysAgo(i)));
    if (!raw) continue;
    const day = JSON.parse(raw);
    agg.prompt += day.prompt; agg.completion += day.completion;
    agg.total += day.total; agg.cost += day.cost; agg.count += day.count;
    for (const [mk, m] of Object.entries(day.models)) {
      const a = agg.models[mk] || { prompt: 0, completion: 0, total: 0, cost: 0, count: 0 };
      a.prompt += m.prompt; a.completion += m.completion;
      a.total += m.total; a.cost += m.cost; a.count += m.count;
      agg.models[mk] = a;
    }
  }
  return agg;
}

// ---------------------------------------------------------------------------
// Chat registry — so the scheduled cron knows who to send reports to.
// ---------------------------------------------------------------------------
export async function trackChat(env, chatId) {
  const raw = await env.MEMORY.get("chats:index");
  const list = raw ? JSON.parse(raw) : [];
  if (!list.includes(chatId)) {
    list.push(chatId);
    await env.MEMORY.put("chats:index", JSON.stringify(list));
  }
}
export async function getChats(env) {
  const raw = await env.MEMORY.get("chats:index");
  return raw ? JSON.parse(raw) : [];
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------
function fmtInt(n) {
  return Math.round(n || 0).toLocaleString("en-US");
}
export function formatUSD(c) {
  if (!c) return "$0.00 (رایگان)";
  if (c < 0.01) return "$" + c.toFixed(6);
  return "$" + c.toFixed(4);
}

// Small footer appended to every AI reply.
export function formatUsageFooter(provider, model, usage, cost) {
  const u = usage || {};
  return "\n\n———\n" +
    `🤖 ${provider}:${model}\n` +
    `🔢 ${fmtInt(u.total_tokens || (u.prompt_tokens || 0) + (u.completion_tokens || 0))} توکن ` +
    `(ورودی ${fmtInt(u.prompt_tokens)} / خروجی ${fmtInt(u.completion_tokens)})\n` +
    `💵 ${formatUSD(cost)}`;
}

// Full /usage report + cron report — clean HTML with a monospace table.
export function formatUsageReport(today, week, month, opts = {}) {
  const todayLabel = opts.todayLabel || "امروز";
  const line = (a) => `${fmtInt(a.total)} توکن · ${formatUSD(a.cost)} · ${a.count} پیام`;

  let out = "";
  out += `📊 <b>${todayLabel}</b>\n${line(today)}\n\n`;
  out += `📅 <b>۷ روز اخیر</b>\n${line(week)}\n\n`;
  out += `🗓 <b>۳۰ روز اخیر</b>\n${line(month)}\n`;

  const models = Object.entries(month.models).sort((a, b) => b[1].total - a[1].total).filter(([, m]) => m.total > 0);
  if (models.length) {
    out += "\n🔎 <b>تفکیک مدل‌ها (۳۰ روز)</b>\n";
    // Build a monospace aligned table inside <pre>
    const rows = [["مدل", "توکن", "هزینه", "تعداد"]];
    for (const [mk, m] of models) {
      const shortName = mk.length > 24 ? mk.slice(0, 24) : mk;
      rows.push([shortName, fmtInt(m.total), formatUSD(m.cost).replace(" (رایگان)", ""), `${m.count}×`]);
    }
    const cols = 4;
    const widths = [];
    for (let c = 0; c < cols; c++) widths[c] = Math.max(...rows.map(r => (r[c] || "").length));
    const fmtRow = (r) => r.map((cell, c) => (cell || "").padEnd(widths[c])).join("  ");
    const sep = widths.map(w => "─".repeat(w)).join("  ");
    const tbl = [fmtRow(rows[0]), sep, ...rows.slice(1).map(fmtRow)].join("\n");
    out += `<pre>${escForPre(tbl)}</pre>`;
  } else {
    out += "\n<i>(هنوز مصرفی ثبت نشده)</i>\n";
  }
  out += "\n\nℹ️ <i>قیمت‌ها تخمینی‌اند و در src/usage.js قابل‌تنظیم.</i>";
  return out;
}

function escForPre(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

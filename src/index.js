import { generateWithFallback, providerAvailable, callSingle } from "./providers.js";
import {
  getHistory, saveHistory, clearHistory,
  getFacts, addFact, clearFacts,
  getGlobalFacts, addGlobalFact, clearGlobalFacts,
  getSystem, setSystem, getGlobalSystem, setGlobalSystem,
  getSettings, setSettings,
  getReminders, addReminder, removeReminder,
  getAllReminderChats, trackReminderChat,
  getCronJobs, addCronJob, removeCronJob,
  getAllCronChats, trackCronChat,
  getEditState, setEditState, clearEditState,
  getPendingRemember, setPendingRemember, clearPendingRemember,
} from "./memory.js";
import {
  CATEGORIES, tierOfModel, labelOfModel, isExternalSelection,
} from "./catalog.js";
import { keywordIntent, looksComplex } from "./router.js";
import { categoriesKeyboard, modelsKeyboard, reasoningKeyboard, resolvePick } from "./keyboards.js";
import { webSearch, formatSearchForLLM, cryptoPrice } from "./search.js";
import { formatLocal, dayNameFa, nextOccurrenceUTC, resolveTimezone, parseClock } from "./tz.js";
import {
  sendMessage, sendChatAction, setMyCommands, escHtml, mdToHtml,
  sendInlineKeyboard, editInlineKeyboard, answerCallback,
} from "./telegram.js";
import {
  recordUsage, aggregate, trackChat, getChats,
  formatUsageFooter, formatUsageReport,
} from "./usage.js";

// ──────────────────────────────────────────────────────────────
// DEFAULT SYSTEM PROMPT — صمیمانه، خفن، با فرمت زیبا
// (مدل با Markdown می‌نویسه و ما خودکار به HTML تلگرام تبدیل می‌کنیم)
// ──────────────────────────────────────────────────────────────
// RAW/BLANK BUILD: no default personality/system prompt is imposed.
// Users can set their own with /system or /globalsys.
const DEFAULT_SYSTEM = "";

// Fast model for intent classification (uses Groq if available, else Gemini)
function fastModel(env) {
  if (providerAvailable("bynara", env)) return "bynara:gpt-5.5";
  if (providerAvailable("groq", env)) return "groq:llama-3.3-70b-versatile";
  if (providerAvailable("gemini", env)) return "gemini:gemini-3.5-flash";
  if (providerAvailable("mistral", env)) return "mistral:mistral-medium-latest";
  if (providerAvailable("openrouter", env)) return "openrouter:meta-llama/llama-3.3-70b-instruct:free";
  return null;
}

// "/" command menu
const COMMANDS = [
  { command: "start",     description: "👋 شروع و معرفی بات" },
  { command: "help",      description: "❓ راهنمای کامل" },
  { command: "models",    description: "🧩 انتخاب مدل هوش مصنوعی" },
  { command: "model",     description: "📊 مدل و حالت فعلی" },
  { command: "auto",      description: "🤖 حالت خودکار (خودم انتخاب کنم)" },
  { command: "reasoning", description: "⚙️ عمق فکر (کم/متوسط/زیاد)" },
  { command: "diag",      description: "🔧 تست کارکرد مدل" },
  { command: "search",    description: "🔍 جستجوی وب" },
  { command: "remind",    description: "⏰ یادآوری — مثال: /remind زنگ ساعت 18:30" },
  { command: "reminders", description: "📋 لیست یادآورها" },
  { command: "cron",      description: "📅 زمان‌بندی — مثال: /cron هر روز ساعت ۹" },
  { command: "cronlist",  description: "📋 لیست زمان‌بندی‌ها" },
  { command: "timezone",  description: "🕒 تنظیم منطقه زمانی (ساعت)" },
  { command: "remember",  description: "🧠 ذخیره در این چت — /remember اسمم دانی" },
  { command: "globalrem", description: "🌍 ذخیره جهانی (همه چت‌ها)" },
  { command: "memory",    description: "👁 نمایش اطلاعات ذخیره‌شده" },
  { command: "forget",    description: "🗑 پاک‌کردن اطلاعات ذخیره‌شده" },
  { command: "system",    description: "✏️ تغییر شخصیت/سیستم‌پرامپت" },
  { command: "globalsys", description: "🌍 سیستم‌پرامپت جهانی (همه چت‌ها)" },
  { command: "reset",     description: "🧹 پاک‌کردن حافظه مکالمه" },
  { command: "usage",     description: "📈 مصرف توکن و هزینه" },
  { command: "apihelp",   description: "🔑 راهنمای گرفتن API Key" },
  { command: "googlekey", description: "🔍 راهنمای کلید جستجوی گوگل" },
];

// Persistent reply keyboard
const MAIN_KB = {
  keyboard: [
    ["🧩 مدل‌ها", "🤖 حالت خودکار"],
    ["⚙️ عمق فکر", "🧠 حافظه"],
    ["⚙️ سیستم‌پرامپت", "📈 مصرف"],
    ["🔍 جستجوی وب", "⏰ یادآورها"],
    ["📅 زمان‌بندی", "🗑 پاک‌کردن حافظه"],
    ["🕒 منطقه زمانی", "❓ راهنما"],
    ["🔑 API Key"],
  ],
  resize_keyboard: true,
};

const BUTTONS = {
  "🧩 مدل‌ها": "/models",
  "🤖 حالت خودکار": "/auto",
  "⚙️ عمق فکر": "/reasoning",
  "🧠 حافظه": "/memory",
  "⚙️ سیستم‌پرامپت": "/system",
  "📈 مصرف": "/usage",
  "🔍 جستجوی وب": "/search",
  "⏰ یادآورها": "/reminders",
  "📅 زمان‌بندی": "/cronlist",
  "🕒 منطقه زمانی": "/timezone",
  "🗑 پاک‌کردن حافظه": "/reset",
  "❓ راهنما": "/help",
  "🔑 API Key": "/apihelp",
};

export default {
  async fetch(request, env, ctx) {
    if (request.method !== "POST") return new Response("Bot is running ✅\n\nProviders: Bynara, Gemini, Groq, OpenRouter, Mistral");
    if (env.WEBHOOK_SECRET) {
      const got = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
      if (got !== env.WEBHOOK_SECRET) return new Response("forbidden", { status: 403 });
    }
    let update;
    try { update = await request.json(); } catch { return new Response("ok"); }

    if (update.callback_query) {
      ctx.waitUntil(handleCallback(env, env.BOT_TOKEN, update.callback_query));
      return new Response("ok");
    }
    const msg = update.message || update.edited_message;
    if (!msg || !msg.text) return new Response("ok");
    ctx.waitUntil(handleMessage(env, env.BOT_TOKEN, msg.chat.id, msg.text.trim()));
    return new Response("ok");
  },

  async scheduled(event, env, ctx) {
    // Check reminders + cron jobs + send usage reports
    ctx.waitUntil(Promise.all([
      checkReminders(env),
      checkCronJobs(env),
      sendUsageReports(env),
    ]));
  },
};

// ──────────────────────────────────────────────────────────────
// SYSTEM PROMPT BUILDER — combines global + per-chat system + facts
// ──────────────────────────────────────────────────────────────
async function buildSystem(env, chatId) {
  // Per-chat system overrides global; if neither, use default
  let sys = (await getSystem(env, chatId)) || (await getGlobalSystem(env)) || DEFAULT_SYSTEM;

  // Add global facts (cross-chat, shared across all conversations)
  const globalFacts = await getGlobalFacts(env);
  if (globalFacts.length) {
    sys += "\n\nGlobal facts you must always remember (shared across all conversations):\n" +
           globalFacts.map((f) => `- ${f}`).join("\n");
  }

  // Add per-chat facts
  const facts = await getFacts(env, chatId);
  if (facts.length) {
    sys += "\n\nImportant facts about this user in this chat:\n" +
           facts.map((f) => `- ${f}`).join("\n");
  }

  // Add current time context so the bot understands time expressions
  const settings = await getSettings(env, chatId);
  const tz = settings.tz || "UTC";
  const now = new Date();
  // RAW/BLANK BUILD: only a minimal, neutral time context is added so that
  // reminders and cron jobs keep working. No personality is injected.
  sys += `${sys ? "\n\n" : ""}Current time: ${formatLocal(tz, now)} (${tz}).`;

  return sys;
}

// ──────────────────────────────────────────────────────────────
// MESSAGE HANDLER
// ──────────────────────────────────────────────────────────────
async function handleMessage(env, token, chatId, text) {
  try {
    if (BUTTONS[text]) text = BUTTONS[text];
    if (text.startsWith("/")) {
      if (await handleCommand(env, token, chatId, text)) return;
    }

    // Check if we're in an interactive system-prompt edit flow.
    // IMPORTANT: don't let a pending edit "swallow" the user's next message.
    const editState = await getEditState(env, chatId);
    if (editState) {
      const t = text.trim();
      if (editState.stage === "confirm") {
        // We're waiting for a ✅/🔄/❌ button tap. If the user typed instead:
        if (/^(آره|اره|بله|بلی|تایید|تأیید|ذخیره|ذخیره کن|ذخیرش کن|اوکی|اوکیه|باشه|👍|✅|ok|okay|yes|save|confirm)$/i.test(t)) {
          if (editState.proposed) {
            if (editState.mode === "edit_globalsys") await setGlobalSystem(env, editState.proposed);
            else await setSystem(env, chatId, editState.proposed);
          }
          await clearEditState(env, chatId);
          await sendMessage(token, chatId, "✅ <b>سیستم‌پرامپت ذخیره شد!</b> 🎉", { reply_markup: MAIN_KB });
          return;
        }
        if (/^(نه|نچ|بی‌خیال|بیخیال|لغو|کنسل|نمیخوام|نمی‌خوام|❌|no|cancel)$/i.test(t)) {
          await clearEditState(env, chatId);
          await sendMessage(token, chatId, "❌ ویرایش لغو شد. چیزی تغییر نکرد 🙂", { reply_markup: MAIN_KB });
          return;
        }
        // Anything else → the user moved on. Drop the pending edit silently and
        // process this message as a fresh request (question / search / etc).
        await clearEditState(env, chatId);
        // fall through to normal intent handling below
      } else {
        // stage "ask": we explicitly asked "what change do you want?" so the
        // next message IS the change.
        return handleEditFlow(env, token, chatId, text, editState);
      }
    }

    const settings = await getSettings(env, chatId);

    // 1) figure out intent — fast keyword rules first. If it looks like a
    //    real-time/web question, go STRAIGHT to search (no extra LLM classifier
    //    call → instant response). Otherwise chat.
    let intent = keywordIntent(text);
    if (!intent && mightNeedSearch(text)) intent = { action: "search", query: text };
    if (!intent) intent = { action: "chat" };

    // 2) act on the intent
    switch (intent.action) {
      case "pick_model":
        return openPicker(env, token, chatId);
      case "set_auto":
        await setSettings(env, chatId, { auto: true, model: "" });
        return sendMessage(token, chatId, "✅ حالت خودکار فعاله! خودم بهترین مدل رو انتخاب می‌کنم 🤖", { reply_markup: MAIN_KB });
      case "set_reasoning":
        await setSettings(env, chatId, { reasoning: intent.level });
        return sendMessage(token, chatId, `✅ عمق فکر روی <b>${escHtml(intent.level)}</b> تنظیم شد ⚙️`);
      case "usage":
        return handleCommand(env, token, chatId, "/usage");
      case "memory":
        return handleCommand(env, token, chatId, "/memory");
      case "search":
        return doSearch(env, token, chatId, intent.query || text);
      case "remember_ask":
        return askRemember(env, token, chatId, intent.text || text);
      case "set_system": {
        const cur = (await getSystem(env, chatId)) || (await getGlobalSystem(env)) || DEFAULT_SYSTEM;
        const change = extractSystemChange(intent.text || text);
        const st = { mode: "edit_system", original: cur, stage: "ask" };
        await setEditState(env, chatId, st);
        // If the user already described the change, build the proposal now.
        if (change && change.length >= 3) {
          return handleEditFlow(env, token, chatId, change, st);
        }
        // Otherwise: ask them what to change first (state stays "ask").
        return sendMessage(token, chatId,
          "⚙️ <b>باشه! چه تغییری روی سیستم‌پرامپت می‌خوای؟</b> 👇\n" +
          "مثلاً «رسمی‌تر باش»، «فقط انگلیسی جواب بده»، یا کل متن جدید رو بفرست.\n" +
          "من مرتبش می‌کنم و برای تایید نشونت می‌دم ✅\n\n🚫 لغو: /cancel");
      }
      case "reminder_set":
        return setReminder(env, token, chatId, intent.text, intent.timeExpr);
      case "reminder_list":
        return handleCommand(env, token, chatId, "/reminders");
      case "cron_job":
        return handleCronRequest(env, token, chatId, intent.text);
      case "cron_list":
        return handleCommand(env, token, chatId, "/cronlist");
      case "timezone":
        return handleCommand(env, token, chatId, ("/timezone " + (intent.arg || "")).trim());
      default:
        return doChat(env, token, chatId, text, settings);
    }
  } catch (e) {
    await sendMessage(token, chatId, "⚠️ یه مشکل پیش اومد، دوباره امتحان کن 😅\n\n<code>" + escHtml((e.message || "").slice(0, 200)) + "</code>");
  }
}

// ──────────────────────────────────────────────────────────────
// INTERACTIVE SYSTEM PROMPT EDITING FLOW
// ──────────────────────────────────────────────────────────────
async function handleEditFlow(env, token, chatId, text, editState) {
  // Cancel if they type /cancel
  if (/^(\/?(cancel|لغو|بی‌خیال|بیکيال))$/i.test(text)) {
    await clearEditState(env, chatId);
    return sendMessage(token, chatId, "❌ ویرایش لغو شد. چیزی تغییر نکرد 🙂", { reply_markup: MAIN_KB });
  }

  await sendChatAction(token, chatId, "typing");

  // Use the LLM to intelligently merge the user's requested changes into the
  // current system prompt, producing a clean, well-written new version.
  const original = editState.original || "";
  const editSystem =
    "تو یه ویرایشگر سیستم‌پرامپت هستی. کاربر یه سیستم‌پرامپت فعلی داره و می‌خواد تغییرش بده. " +
    "بر اساس درخواست کاربر، سیستم‌پرامپت رو بازنویسی کن به یه نسخه‌ی تمیز، حرفه‌ای و کامل. " +
    "اگه کاربر متن کاملاً جدید داد، همون رو مرتب و بهتر کن. " +
    "اگه فقط تغییر جزئی خواست، تغییر رو روی متن فعلی اعمال کن. " +
    "خروجی فقط و فقط متنِ سیستم‌پرامپت جدید باشه — بدون توضیح اضافه، بدون نقل‌قول، بدون «سیستم‌پرامپت جدید:». " +
    "متن رو به فارسی و به صورت دستورالعمل برای یه دستیار هوش مصنوعی بنویس.";
  const editHistory = [{
    role: "user",
    content: `سیستم‌پرامپت فعلی:\n"""\n${original}\n"""\n\nدرخواست تغییر کاربر:\n"""\n${text}\n"""\n\nحالا سیستم‌پرامپت جدید و بهتر رو بنویس:`,
  }];

  let edited;
  try {
    const settings = await getSettings(env, chatId);
    const r = await generateChat(env, chatId, editSystem, editHistory, settings, true);
    edited = r.text.trim().replace(/^["'«»]+|["'«»]+$/g, "").trim();
  } catch (e) {
    // If LLM fails, just use the user's raw text
    edited = text;
  }

  // Store the proposed text and switch to confirmation state
  await setEditState(env, chatId, { ...editState, proposed: edited, stage: "confirm" });

  const confirmKb = [[
    { text: "✅ تایید و ذخیره", callback_data: "sysok|1" },
    { text: "🔄 دوباره", callback_data: "sysretry|1" },
  ], [
    { text: "❌ لغو", callback_data: "syscancel|1" },
  ]];

  await sendInlineKeyboard(token, chatId,
    "✏️ <b>نسخه جدید سیستم‌پرامپت:</b>\n\n" +
    `<code>${escHtml(edited.slice(0, 2000))}${edited.length > 2000 ? "..." : ""}</code>\n\n` +
    "تاییدش می‌کنی؟ 👇\n<i>(اگه چیز دیگه‌ای بپرسی، همون رو جواب می‌دم و این ویرایش کنسل می‌شه)</i>",
    confirmKb);
}

// ──────────────────────────────────────────────────────────────
// AUTO REASONING — automatically set thinking depth based on task
// ──────────────────────────────────────────────────────────────
// Fast, local heuristic: does this message plausibly need real-time / web info?
// Used to decide whether to pay for the LLM intent classifier at all.
function mightNeedSearch(text) {
  return /(امروز|فردا|دیروز|الان|همین الان|اخیر|جدیدترین|آخرین|اخبار|خبر|آب.?و.?هوا|هواشناسی|وضعیت هوا|نتیجه|نتایج|بازی|مسابقه|جام|لیگ|قیمت|نرخ|دلار|طلا|سکه|بورس|سهام|ارز|چند(ه| شد| است| هست)|اکران|فیلم جدید|today|tomorrow|latest|breaking|news|weather|score|fixture|price|release date)/i.test(text);
}

// Strip system-prompt trigger words to see if the user actually gave a change,
// or is just asking to START editing (in which case we ask them for the change).
function extractSystemChange(text) {
  return String(text)
    .replace(/سیستم\s*پرامپت|system\s*prompt|پرسونا|persona|role|نقش(ت|ه|م)?/gi, " ")
    .replace(/(می‌?خوام|میخوام|می‌?خواهم|می‌?شه|میشه|بذار|بگذار|لطفا|لطفاً|بیا)/gi, " ")
    .replace(/(رو|را|تغییرش?( بدم| بده| بدی)?|عوضش?( کنم| کن| کنی| بشه)?|change|edit|update|بده|کن|کنم|کنی|بشه|بدم)/gi, " ")
    .replace(/\s+/g, " ").trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// SMART LLM INTENT CLASSIFIER
// Runs only when the fast keyword rules don't match. Lets the user trigger any
// capability in plain language — no "/" command needed.
// ─────────────────────────────────────────────────────────────────────────────
async function llmIntent(env, text) {
  const model = fastModel(env);
  if (!model) return null;
  // Skip very short greetings / trivial acks — they're just chat.
  if (text.length <= 3) return null;

  const sys =
`You are an intent classifier for a Telegram AI assistant. The user writes in any language (usually Persian/Farsi).
Output ONLY one compact JSON object and nothing else. No markdown, no explanation.

Schema: {"action": string, "query": string, "level": string, "text": string}

Allowed "action" values:
- "search": the user wants CURRENT / real-time / factual info that needs the web — prices (قیمت بیتکوین، طلا، دلار، ارز، سهام), news/اخبار, weather/آب‌وهوا, sports fixtures & results (بازی، جام جهانی، نتیجه، لیگ), "امروز/فردا/الان/اخیر/جدیدترین/آخرین", release dates, or anything about recent/live events. Put a clean search query in "query".
- "pick_model": user wants to see or change the AI model (مدل، تغییر مدل، لیست مدل، کدوم مدل).
- "set_auto": user wants automatic model selection (حالت خودکار، اتومات).
- "set_reasoning": user wants to change thinking depth. Set "level" to "low" | "medium" | "high".
- "set_system": user wants to change/add to the assistant's persona, role, or system prompt (به سیستم پرامپت اضافه کن، نقشت رو عوض کن، از این به بعد اینجوری باش). Put the requested change in "text".
- "remember_ask": user wants something SAVED to memory (یادت باشه، ذخیره کن، به خاطر بسپار، تو حافظه نگه دار). Put ONLY the fact to remember in "text".
- "reminder_set": a one-time, time-based reminder (یادم بنداز ساعت X). Put the task in "text" and the time in "timeExpr".
- "cron_job": a recurring scheduled task (هر روز/هر ساعت/هر هفته ساعت X). Put the task in "text".
- "usage": user asks about token/cost usage (مصرف، هزینه).
- "memory": user wants to SEE what's stored (حافظه رو نشون بده).
- "chat": anything else — normal conversation, general knowledge the model already knows, coding, math, writing, translation. DEFAULT to this.

Rules:
- If the model can answer reliably from its own knowledge and it is NOT time-sensitive, use "chat", never "search".
- Be conservative: when unsure, choose "chat".
- Return valid JSON only.`;

  try {
    const r = await generateWithFallback(env, sys, [{ role: "user", content: text }], model);
    const m = (r.text || "").match(/\{[\s\S]*\}/);
    if (!m) return null;
    const obj = JSON.parse(m[0]);
    if (!obj || !obj.action) return null;
    if (obj.action === "search" && !obj.query) obj.query = text;
    return obj;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SMART MEMORY SAVE — ask the user: this chat only, or all chats?
// ─────────────────────────────────────────────────────────────────────────────
async function askRemember(env, token, chatId, fact) {
  fact = String(fact || "").trim();
  if (!fact || fact.length < 2) {
    return sendMessage(token, chatId, "چی رو ذخیره کنم؟ 🧠\nمثال: «یادت باشه اسمم دانیه»");
  }
  await setPendingRemember(env, chatId, fact);
  return sendInlineKeyboard(token, chatId,
    "🧠 <b>این رو کجا ذخیره کنم؟</b>\n\n<code>" + escHtml(fact) + "</code>",
    [
      [{ text: "💬 فقط همین چت", callback_data: "rem|chat" }],
      [{ text: "🌍 همه‌ی چت‌ها", callback_data: "rem|global" }],
      [{ text: "❌ بی‌خیال", callback_data: "rem|cancel" }],
    ]);
}

function autoReasoning(text) {
  const t = text.toLowerCase();
  // Complex tasks → high reasoning
  if (/(کد|برنامه‌?نویس|دیباگ|رفع خطا|الگوریتم|معادله|مشتق|انتگرال|اثبات|تحلیل|بهینه‌?سازی|architecture|refactor|debug|prove|proof|algorithm|derive|integral|theorem|complexity|optimize)/i.test(text)) {
    return "high";
  }
  // Very simple tasks → low reasoning
  if (text.length < 30 && /^(سلام|hi|hello|hey|چطوری|خوبی|چه خبر|thanks|ممنون|ok|باشه|خب)/i.test(text)) {
    return "low";
  }
  // Default → medium
  return "medium";
}

// ──────────────────────────────────────────────────────────────
// CHAT (text generation)
// ──────────────────────────────────────────────────────────────
async function doChat(env, token, chatId, text, settings) {
  await sendChatAction(token, chatId, "typing");
  const system = await buildSystem(env, chatId);
  const history = await getHistory(env, chatId);
  history.push({ role: "user", content: text });

  const complex = looksComplex(text);

  // Auto-adjust reasoning based on task complexity (only when set to "auto")
  if (settings.reasoning === "auto") {
    const autoLevel = autoReasoning(text);
    settings = { ...settings, reasoning: autoLevel };
  }

  const pinned = !settings.auto && settings.model ? settings.model : null;

  // weak-model warning
  let prefix = "";
  if (pinned && complex && tierOfModel(pinned) === "weak") {
    prefix = `⚠️ مدل فعلی <b>${escHtml(labelOfModel(pinned))}</b> برای این سوالِ پیچیده ضعیفه.\nبرای جواب دقیق‌تر <code>/auto</code> بزن 🤖\n\n`;
  }

  let result;
  try {
    result = await generateChat(env, chatId, system, history, settings, complex);
  } catch (e) {
    await sendMessage(token, chatId,
      "⚠️ <b>همه مدل‌ها الان در دسترس نیستن</b> 😅\n\n" +
      "مطمئن شو حداقل یک API Key تنظیم کردی:\n" +
      "• <code>BYNARA_API_KEY</code>\n" +
      "• <code>GEMINI_API_KEY</code>\n" +
      "• <code>GROQ_API_KEY</code>\n" +
      "• <code>OPENROUTER_API_KEY</code>\n" +
      "• <code>MISTRAL_API_KEY</code>\n\n" +
      "راهنما: <code>/apihelp</code>\n\n" +
      "<code>" + escHtml((e.message || "").slice(0, 200)) + "</code>");
    return;
  }

  // If pinned model failed and fell back, mention it
  const usedSel = `${result.provider}:${result.model}`;
  if (pinned && usedSel !== pinned) {
    prefix = `⚠️ مدل <b>${escHtml(labelOfModel(pinned))}</b> جواب نداد، با <b>${escHtml(labelOfModel(usedSel))}</b> جواب دادم 🔄\n\n` + prefix;
  }

  history.push({ role: "assistant", content: result.text });
  await saveHistory(env, chatId, history);

  await trackChat(env, chatId);
  const { cost } = await recordUsage(env, chatId, result.provider, result.model, result.usage);
  const footer = formatUsageFooter(result.provider, result.model, result.usage, cost);
  await sendMessage(token, chatId, prefix + mdToHtml(result.text) + footer);
}

// Smart auto pick: prefer a provider that's actually configured & working.
function autoPick(env, complex) {
  if (providerAvailable("bynara", env)) return complex ? "bynara:gpt-5.5" : "bynara:claude-sonnet-4.6";
  if (providerAvailable("gemini", env)) return complex ? "gemini:gemini-3.1-pro-preview" : "gemini:gemini-3.5-flash";
  if (providerAvailable("groq", env)) return "groq:llama-3.3-70b-versatile";
  if (providerAvailable("mistral", env)) return "mistral:mistral-large-latest";
  if (providerAvailable("openrouter", env)) return "openrouter:meta-llama/llama-3.3-70b-instruct:free";
  return null; // no provider available
}

// Run text generation with fallback across providers.
async function generateChat(env, chatId, system, history, settings, complex) {
  const pinned = !settings.auto && settings.model ? settings.model : null;
  const primary = pinned || autoPick(env, complex);

  if (!primary) {
    throw new Error("هیچ API Keyای تنظیم نشده. /apihelp رو بزن.");
  }

  let lastError = "";

  // 1) If pinned, try it strictly first
  if (pinned && isExternalSelection(pinned)) {
    try { return await callSingle(env, primary, system, history); }
    catch (e) { lastError = e.message; }
  }

  // 2) Fallback across all providers
  const r = await generateWithFallback(env, system, history, primary);
  r.lastError = lastError;
  return r;
}

// ──────────────────────────────────────────────────────────────
// WEB SEARCH
// ──────────────────────────────────────────────────────────────
async function doSearch(env, token, chatId, query) {
  await sendChatAction(token, chatId, "typing");

  // Fast, 100%-reliable path for crypto prices (keyless CoinGecko API).
  if (/(بیت.?کوین|اتریوم|تتر|دوج|شیبا|سولانا|کاردانو|ریپل|ترون|لایت.?کوین|بایننس|پولکادات|رمزارز|ارز دیجیتال|کریپتو|bitcoin|btc|ethereum|eth|crypto|usdt|dogecoin|doge|solana|cardano|ripple|xrp|bnb|shib|litecoin|ltc)/i.test(query)) {
    try {
      const c = await cryptoPrice(query);
      if (c) {
        const up = (c.change24 || 0) >= 0;
        const fmt = (n) => n == null ? "—" : "$" + Number(n).toLocaleString("en-US");
        const msg =
          `💰 <b>${escHtml(c.name)} (${escHtml(c.symbol)})</b>\n\n` +
          `💵 قیمت: <b>${fmt(c.usd)}</b>\n` +
          `${up ? "🟢 ▲" : "🔴 ▼"} ۲۴ ساعت: <b>${(c.change24 || 0).toFixed(2)}%</b>\n` +
          `⬆️ بیشترین ۲۴س: ${fmt(c.high24)}\n` +
          `⬇️ کمترین ۲۴س: ${fmt(c.low24)}\n` +
          `🏦 مارکت‌کپ: ${fmt(c.mcap)}\n\n` +
          `🔗 <a href="${c.url}">CoinGecko</a> · <i>لحظه‌ای</i>`;
        await sendMessage(token, chatId, msg, { disable_web_page_preview: true });
        return;
      }
    } catch { /* fall back to normal web search */ }
  }

  await sendMessage(token, chatId, `🔍 دارم می‌گردم دنبال: <b>${escHtml(query)}</b> ...`);
  const results = await webSearch(query, 6, env);
  const system = await buildSystem(env, chatId);
  const settings = await getSettings(env, chatId);
  const _tz = settings.tz || "Asia/Tehran";
  const today = formatLocal(_tz).slice(0, 10);
  const tomorrow = formatLocal(_tz, new Date(Date.now() + 86400000)).slice(0, 10);
  const dateHint = `⚠️ امروز ${today} (${dayNameFa(_tz)}) به وقت ${_tz} است و فردا ${tomorrow}. سال جاری ۲۰۲۶ است — بر اساس همین تاریخ جواب بده، نه دانش قدیمی، و هیچ‌وقت نگو یه رویداد آینده «وجود نداره».`;

  // If the web search found nothing, don't dead-end: let the model answer from
  // its own knowledge with a small disclaimer.
  if (!results.length) {
    const history = [{
      role: "user",
      content: `${dateHint}\n\nجستجوی وب برای «${query}» نتیجه‌ای نداد. بر اساس دانش خودت تا جایی که می‌تونی به این سوال جواب بده. اگه اطلاعاتت ممکنه قدیمی باشه، کوتاه تذکر بده. با فرمت زیبا و ایموجی جواب بده:\n${query}`,
    }];
    try {
      const r = await generateChat(env, chatId, system, history, settings, true);
      await trackChat(env, chatId);
      const { cost } = await recordUsage(env, chatId, r.provider, r.model, r.usage);
      const footer = formatUsageFooter(r.provider, r.model, r.usage, cost);
      await sendMessage(token, chatId,
        "🔎 <i>جستجوی وب نتیجه‌ای نداشت، از دانش خودم جواب می‌دم:</i>\n\n" + mdToHtml(r.text) + footer +
        "\n\n<i>💡 برای جستجوی واقعی و لحظه‌ای وب، یه کلید رایگان گوگل تنظیم کن: /googlekey</i>",
        { disable_web_page_preview: true });
    } catch {
      await sendMessage(token, chatId,
        `😕 چیزی پیدا نکردم برای <b>${escHtml(query)}</b>\n\nیه‌بار دیگه با کلمات دیگه امتحان کن 🔄`);
    }
    return;
  }

  const context = formatSearchForLLM(query, results);
  const history = [{ role: "user", content: `${dateHint}\n\n${context}\n\nبر اساس نتایج جستجوی بالا به این سوال جواب بده:\n«${query}»\n\nقوانین فرمت:\n- جواب رو خلاصه، دقیق و به‌روز بده و از ایموجی مناسب استفاده کن ✨\n- اگه از تیم‌ها یا کشورها اسم می‌بری، پرچم ایموجی هر کشور رو کنارش بذار 🇮🇷🇧🇷🇩🇪\n- اگه داده‌ها عددی یا قابل مقایسه‌ان (مثل قیمت‌ها، تیم‌ها، بازی‌ها، آمار) حتماً توی یه جدول Markdown خفن با ایموجی نشون بده\n- آخرش زیر عنوان «🔗 منابع» لینک منبع‌ها رو بذار` }];
  let reply, footer = "";
  try {
    const r = await generateChat(env, chatId, system, history, settings, true);
    reply = mdToHtml(r.text);
    await trackChat(env, chatId);
    const { cost } = await recordUsage(env, chatId, r.provider, r.model, r.usage);
    footer = formatUsageFooter(r.provider, r.model, r.usage, cost);
  } catch {
    // Fallback: show raw results nicely formatted
    reply = "🔍 <b>نتایج جستجو:</b>\n\n" + results.map((res, i) =>
      `${i + 1}. <b>${escHtml(res.title)}</b>\n${escHtml((res.snippet || "").slice(0, 150))}\n<a href="${res.url}">🔗 لینک</a>`
    ).join("\n\n");
  }
  await sendMessage(token, chatId, reply + footer, { disable_web_page_preview: true });
}

// ──────────────────────────────────────────────────────────────
// REMINDERS
// ──────────────────────────────────────────────────────────────
async function setReminder(env, token, chatId, text, timeExpr) {
  if (!text || text.length < 2) {
    return sendMessage(token, chatId, "چی یادت بندازم؟ مثال: «یادم بنداز ساعت 18:30 که زنگ بزنم»");
  }

  let hour = null, minute = 0;
  if (timeExpr) {
    const m = normalizeDigits(timeExpr).match(/(\d{1,2}):(\d{2})/);
    if (m) { hour = parseInt(m[1]); minute = parseInt(m[2]); }
  }

  const id = `${Date.now()}`;
  const now = new Date();
  const settings = await getSettings(env, chatId);
  const tz = settings.tz || "Asia/Tehran";

  let reminderTime;
  if (hour !== null) {
    // Wall-clock hour:minute in the user's timezone → correct UTC instant.
    reminderTime = nextOccurrenceUTC(tz, hour, minute, now).toISOString();
  } else {
    // No explicit time — remind in 1 hour by default
    reminderTime = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
  }

  const reminder = {
    id,
    text,
    time: reminderTime,
    created: now.toISOString(),
  };

  await addReminder(env, chatId, reminder);
  await trackReminderChat(env, chatId);

  const timeStr = timeExpr || "یک ساعت دیگر";
  await sendMessage(token, chatId,
    `✅ <b>یادآور تنظیم شد!</b> ⏰\n\n` +
    `📝 ${escHtml(text)}\n` +
    `⏰ <code>${escHtml(timeStr)}</code>\n\n` +
    `لیست یادآورها: <code>/reminders</code>`);
}

async function checkReminders(env) {
  const token = env.BOT_TOKEN;
  if (!token) return;
  const chats = await getAllReminderChats(env);
  const now = Date.now();
  for (const chatId of chats) {
    const reminders = await getReminders(env, chatId);
    const due = reminders.filter(r => new Date(r.time).getTime() <= now);
    for (const r of due) {
      try {
        await sendMessage(token, chatId, `⏰ <b>یادآوری:</b>\n\n${escHtml(r.text)}`);
        await removeReminder(env, chatId, r.id);
      } catch (e) { /* continue */ }
    }
  }
}

// ──────────────────────────────────────────────────────────────
// CRON JOBS — scheduled recurring tasks
// ──────────────────────────────────────────────────────────────

// Parse natural language schedule into a cron-like interval (in minutes)
// Returns { intervalMin, description } or null if can't parse
// Convert Persian/Arabic numerals to English so \d regexes work.
function normalizeDigits(s) {
  const fa = "۰۱۲۳۴۵۶۷۸۹";
  const ar = "٠١٢٣٤٥٦٧٨٩";
  return String(s).replace(/[۰-۹٠-٩]/g, (ch) => {
    let i = fa.indexOf(ch);
    if (i > -1) return String(i);
    i = ar.indexOf(ch);
    return i > -1 ? String(i) : ch;
  });
}

function parseCronSchedule(rawText, tz = "Asia/Tehran") {
  const text = normalizeDigits(rawText);
  const t = text.toLowerCase();

  // "هر X دقیقه" / "every X minutes"
  let m = t.match(/(?:هر\s*)?(\d+)\s*(دقیقه|minute|min)/);
  if (m) return { intervalMin: parseInt(m[1]), description: `هر ${m[1]} دقیقه` };

  // "هر X ساعت" / "every X hours"
  m = t.match(/(?:هر\s*)?(\d+)\s*(ساعت|hour|hr)/);
  if (m) return { intervalMin: parseInt(m[1]) * 60, description: `هر ${m[1]} ساعت` };

  // "هر X روز" / "every X days"
  m = t.match(/(?:هر\s*)?(\d+)\s*(روز|day)/);
  if (m) return { intervalMin: parseInt(m[1]) * 1440, description: `هر ${m[1]} روز` };

  // "هر ساعت" / "every hour" (without number)
  if (/هر\s*ساعت|every\s*hour|hourly/.test(t)) return { intervalMin: 60, description: "هر ساعت" };

  // "هر روز" / "همیشه" / "every day" / "daily" — check for a specific time
  if (/هر\s*روز|همیشه|every\s*day|daily/.test(t)) {
    const clock = parseClock(text);
    if (clock) {
      const { hour: h, minute: min } = clock;
      const now = new Date();
      const target = nextOccurrenceUTC(tz, h, min, now);
      const initialDelay = Math.max(1, Math.round((target.getTime() - now.getTime()) / 60000));
      return { intervalMin: 1440, description: `هر روز ساعت ${h}:${String(min).padStart(2, "0")}`, initialDelayMin: initialDelay };
    }
    return { intervalMin: 1440, description: "هر روز" };
  }

  // "هر هفته" / "every week" / "weekly"
  if (/هر\s*هفته|every\s*week|weekly/.test(t)) return { intervalMin: 10080, description: "هر هفته" };

  return null;
}

// Extract the task/prompt from a cron request
function extractCronTask(text) {
  let task = text
    .replace(/کرون\s*جاب|cron\s*job|زمان‌?بندی|schedule\s*me|cron/gi, "")
    .replace(/همیشه|میخوام|می‌خوام|می‌خواهم|بخوام/gi, "")
    .replace(/هر\s*(دقیقه|ساعت|روز|هفته)\s*(\d+)?/gi, "")
    .replace(/every\s*(minute|hour|day|week)/gi, "")
    .replace(/\d+\s*(minute|hour|day|week)/gi, "")
    .replace(/(بعد\s*از\s*ظهر|بعدازظهر|صبح|بامداد|عصر|شب|ظهر|pm|am)/gi, "")
    .replace(/ساعت\s*[\d۰-۹]{1,2}(?::[\d۰-۹]{2})?/g, "")
    .replace(/at\s+\d{1,2}(?::\d{2})?/gi, "")
    .replace(/که|بگو|بگه|بهم|به من|یادآوری|reminder/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  return task || "یادآوری زمان‌بندی‌شده";
}

async function handleCronRequest(env, token, chatId, text) {
  const settings = await getSettings(env, chatId);
  const tz = settings.tz || "Asia/Tehran";
  const schedule = parseCronSchedule(text, tz);
  if (!schedule) {
    await sendMessage(token, chatId,
      "📅 <b>زمان‌بندی (Cron Job)</b>\n\n" +
      "نمی‌تونم زمان‌بندی رو از متن پیدا کنم 😅\n\n" +
      "<b>مثال‌ها:</b>\n" +
      "• <code>هر روز ساعت ۹ بگو صبح بخیر</code>\n" +
      "• <code>هر ساعت یادآوری کن که آب بخورم</code>\n" +
      "• <code>هر ۳۰ دقیقه قیمت بیت‌کوین رو بگو</code>\n" +
      "• <code>هر هفته جمعه ساعت ۱۰ گزارش بده</code>\n\n" +
      "یا از دستور /cron استفاده کن 👆",
      { reply_markup: MAIN_KB });
    return;
  }

  const task = extractCronTask(text);
  const id = `${Date.now()}`;
  const now = new Date();

  // Calculate next run time
  const delayMin = schedule.initialDelayMin || schedule.intervalMin;
  const nextRun = new Date(now.getTime() + delayMin * 60 * 1000);

  const job = {
    id,
    label: task,
    task,
    intervalMin: schedule.intervalMin,
    description: schedule.description,
    nextRun: nextRun.toISOString(),
    created: now.toISOString(),
    active: true,
  };

  await addCronJob(env, chatId, job);
  await trackCronChat(env, chatId);

  await sendMessage(token, chatId,
    `✅ <b>زمان‌بندی ساخته شد!</b> 📅\n\n` +
    `📝 <b>وظیفه:</b> ${escHtml(task)}\n` +
    `🔄 <b>تناوب:</b> ${escHtml(schedule.description)}\n` +
    `⏰ <b>اجرای بعدی:</b> <code>${formatLocal(tz, nextRun)}</code>\n\n` +
    `برای دیدن لیست: <code>/cronlist</code>`,
    { reply_markup: MAIN_KB });
}

// Check and run due cron jobs (called from scheduled handler)
async function checkCronJobs(env) {
  const token = env.BOT_TOKEN;
  if (!token) return;
  const chats = await getAllCronChats(env);
  const now = Date.now();

  for (const chatId of chats) {
    const jobs = await getCronJobs(env, chatId);
    for (const job of jobs) {
      if (!job.active) continue;
      if (new Date(job.nextRun).getTime() <= now) {
        try {
          // Run the cron task as a chat message
          const system = await buildSystem(env, chatId);
          const history = [{ role: "user", content: `📅 [زمان‌بندی خودکار] ${job.task}` }];
          const settings = await getSettings(env, chatId);
          const result = await generateChat(env, chatId, system, history, settings, false);

          await sendMessage(token, chatId,
            `📅 <b>زمان‌بندی خودکار</b>\n` +
            `━━━━━━━━━━━━━\n` +
            `📝 <b>وظیفه:</b> ${escHtml(job.label)}\n\n` +
            `${mdToHtml(result.text)}`);

          // Schedule next run — anchor to the intended time so it doesn't drift,
          // and skip any missed slots (e.g. if the worker was idle) without
          // firing repeatedly.
          let nr = new Date(job.nextRun).getTime();
          do { nr += job.intervalMin * 60 * 1000; } while (nr <= now);
          job.nextRun = new Date(nr).toISOString();
          // Update the job in storage
          const allJobs = await getCronJobs(env, chatId);
          const idx = allJobs.findIndex(j => j.id === job.id);
          if (idx >= 0) {
            allJobs[idx] = job;
            await env.MEMORY.put(`cronjobs:${chatId}`, JSON.stringify(allJobs));
          }
        } catch (e) { /* continue */ }
      }
    }
  }
}

// ──────────────────────────────────────────────────────────────
// MODEL PICKER
// ──────────────────────────────────────────────────────────────
async function openPicker(env, token, chatId) {
  return sendInlineKeyboard(token, chatId,
    "🧩 کدوم پروایدر رو می‌خوای؟ یک دسته انتخاب کن یا حالت خودکار رو بزن:",
    categoriesKeyboard());
}

async function handleCallback(env, token, cq) {
  const chatId = cq.message?.chat?.id;
  const mid = cq.message?.message_id;
  const data = cq.data || "";
  const [op, a, b] = data.split("|");
  try {
    if (op === "cats") {
      await editInlineKeyboard(token, chatId, mid, "🧩 یک پروایدر انتخاب کن:", categoriesKeyboard());
    } else if (op === "cat") {
      await editInlineKeyboard(token, chatId, mid, `${CATEGORIES[a]?.label} — یک مدل انتخاب کن:`, modelsKeyboard(a, 0));
    } else if (op === "pg") {
      await editInlineKeyboard(token, chatId, mid, `${CATEGORIES[a]?.label} — یک مدل انتخاب کن:`, modelsKeyboard(a, Number(b)));
    } else if (op === "pk") {
      const sel = resolvePick(a, b);
      if (sel) {
        // Store as "provider:model" — the id already has the format "provider:model"
        await setSettings(env, chatId, { model: sel.id, auto: false });
        const label = labelOfModel(sel.id);
        await editInlineKeyboard(token, chatId, mid,
          `✅ مدل فعلی: «${label}»\nدسته: ${CATEGORIES[sel.category]?.label}\nاین مدل مستقیم با کلید خودت کار می‌کنه.`,
          [[{ text: "⬅️ تغییر دوباره", callback_data: "cats|1" }]]);
      }
      await answerCallback(token, cq.id, "انتخاب شد ✅");
      return;
    } else if (op === "autocat") {
      await setSettings(env, chatId, { auto: true, model: "" });
      await editInlineKeyboard(token, chatId, mid,
        "🤖 حالت خودکار فعال شد. خودم بهترین مدل رو انتخاب می‌کنم.",
        [[{ text: "⬅️ دسته‌ها", callback_data: "cats|1" }]]);
    } else if (op === "auto") {
      await setSettings(env, chatId, { auto: true, model: "" });
      await editInlineKeyboard(token, chatId, mid,
        "🤖 حالت خودکار فعال شد. خودم بهترین مدل رو انتخاب می‌کنم.",
        [[{ text: "⬅️ دسته‌ها", callback_data: "cats|1" }]]);
    } else if (op === "rzmenu") {
      const s = await getSettings(env, chatId);
      await editInlineKeyboard(token, chatId, mid, "⚙️ عمق فکر مدل رو انتخاب کن:", reasoningKeyboard(s.reasoning));
    } else if (op === "rz") {
      await setSettings(env, chatId, { reasoning: a });
      const rzLabels = { auto: "🤖 خودکار", low: "🟢 کم", medium: "🟡 متوسط", high: "🔴 زیاد" };
      await editInlineKeyboard(token, chatId, mid, `✅ عمق فکر روی <b>${rzLabels[a] || a}</b> تنظیم شد.`, reasoningKeyboard(a));
    } else if (op === "rem") {
      // Smart-memory scope choice: this chat vs all chats
      const fact = await getPendingRemember(env, chatId);
      if (a === "cancel") {
        await clearPendingRemember(env, chatId);
        await editInlineKeyboard(token, chatId, mid, "❌ باشه، ذخیره نشد 🙂", []);
      } else if (!fact) {
        await editInlineKeyboard(token, chatId, mid, "⚠️ چیزی برای ذخیره پیدا نشد. دوباره بگو 🙂", []);
      } else if (a === "chat") {
        await addFact(env, chatId, fact);
        await clearPendingRemember(env, chatId);
        await editInlineKeyboard(token, chatId, mid,
          "✅ توی <b>همین چت</b> ذخیره شد 🧠\n\n<code>" + escHtml(fact) + "</code>", []);
      } else if (a === "global") {
        await addGlobalFact(env, fact);
        await clearPendingRemember(env, chatId);
        await editInlineKeyboard(token, chatId, mid,
          "✅ به‌صورت <b>جهانی</b> (همه‌ی چت‌ها) ذخیره شد 🌍\n\n<code>" + escHtml(fact) + "</code>", []);
      }
      await answerCallback(token, cq.id, "انجام شد ✅");
      return;
    } else if (op === "tz") {
      await setSettings(env, chatId, { tz: a });
      await editInlineKeyboard(token, chatId, mid,
        `✅ منطقه زمانی روی <b>${escHtml(a)}</b> تنظیم شد 🕒\n` +
        `الان: <b>${formatLocal(a)}</b> — ${dayNameFa(a)}\n\n` +
        "یادآوری‌ها و کرون‌جاب‌ها از این به بعد بر این اساس تنظیم می‌شن ⏰", []);
      await answerCallback(token, cq.id, "تنظیم شد ✅");
      return;
    } else if (op === "sysok") {
      // Confirm & save the proposed system prompt
      const st = await getEditState(env, chatId);
      if (st && st.proposed) {
        if (st.mode === "edit_globalsys") await setGlobalSystem(env, st.proposed);
        else await setSystem(env, chatId, st.proposed);
        await clearEditState(env, chatId);
        await editInlineKeyboard(token, chatId, mid,
          "✅ <b>سیستم‌پرامپت ذخیره شد!</b> 🎉\nاز الان با این شخصیت جواب می‌دم 😎", []);
      } else {
        await editInlineKeyboard(token, chatId, mid, "⚠️ چیزی برای ذخیره نبود.", []);
      }
    } else if (op === "sysretry") {
      // Go back to asking for changes again
      const st = await getEditState(env, chatId);
      if (st) {
        await setEditState(env, chatId, { mode: st.mode, original: st.original, stage: "ask" });
        await editInlineKeyboard(token, chatId, mid,
          "🔄 باشه، دوباره بگو چه تغییری می‌خوای 👇", []);
      }
    } else if (op === "syscancel") {
      await clearEditState(env, chatId);
      await editInlineKeyboard(token, chatId, mid, "❌ ویرایش لغو شد. چیزی تغییر نکرد 🙂", []);
    }
    await answerCallback(token, cq.id);
  } catch (e) {
    await answerCallback(token, cq.id, "خطا");
  }
}

// ──────────────────────────────────────────────────────────────
// COMMANDS
// ──────────────────────────────────────────────────────────────
async function handleCommand(env, token, chatId, text) {
  const [cmd, ...rest] = text.split(" ");
  const arg = rest.join(" ").trim();
  const base = cmd.split("@")[0].toLowerCase();

  switch (base) {
    case "/start":
      await setMyCommands(token, COMMANDS);
      const providers = [];
      if (providerAvailable("bynara", env)) providers.push("✅ Bynara");
      if (providerAvailable("gemini", env)) providers.push("✅ Gemini");
      if (providerAvailable("groq", env)) providers.push("✅ Groq");
      if (providerAvailable("openrouter", env)) providers.push("✅ OpenRouter");
      if (providerAvailable("mistral", env)) providers.push("✅ Mistral");
      const provStatus = providers.length ? providers.join("\n") : "❌ هیچ کلیدی تنظیم نشده — /apihelp رو بزن";

      await sendMessage(token, chatId,
        "👋 <b>سلام! من دستیار صمیمی تو هستم</b> 🤖\n\n" +
        "• 💬 چت، 🔍 جستجوی وب، ⏰ یادآوری، 📅 زمان‌بندی\n" +
        "• 🧠 حافظه دائمی (بین تمام چت‌ها)\n" +
        "• ⚙️ تغییر سیستم‌پرامپت: /system\n" +
        "• 📅 کرون جاب: «هر روز ساعت ۹ صبح بخیر بگو»\n" +
        "• ⏰ یادآوری: «یادم بنداز ساعت ۱۸:۳۰ که ...»\n\n" +
        "<b>پروایدرهای فعال:</b>\n" + provStatus + "\n\n" +
        "از دکمه‌های پایین یا منوی «/» استفاده کن 👇",
        { reply_markup: MAIN_KB });
      return true;

    case "/help":
      await sendMessage(token, chatId,
        "❓ <b>راهنما</b>\n\n" +
        "🧩 <b>مدل‌ها</b>\n" +
        "• /models — انتخاب مدل با دکمه\n" +
        "• /model — مدل فعلی\n" +
        "• /auto — حالت خودکار\n" +
        "• /reasoning — عمق فکر\n\n" +
        "🧠 <b>حافظه</b>\n" +
        "• /remember — ذخیره در این چت\n" +
        "• /globalrem — ذخیره جهانی (همه چت‌ها)\n" +
        "• /memory — نمایش اطلاعات\n" +
        "• /forget — پاک‌کردن\n" +
        "• /reset — پاک‌کردن مکالمه\n\n" +
        "⚙️ <b>سیستم‌پرامپت</b>\n" +
        "• /system — تغییر (تعاملی)\n" +
        "• /globalsys — جهانی (همه چت‌ها)\n\n" +
        "🔍 <b>جستجو و زمان‌بندی</b>\n" +
        "• /search — جستجوی وب\n" +
        "• /remind — یادآوری\n" +
        "• /cron — زمان‌بندی\n" +
        "• /cronlist — لیست زمان‌بندی‌ها\n" +
        "• /timezone — تنظیم منطقه زمانی (ساعت) 🕒\n\n" +
        "📊 /usage — مصرف\n" +
        "🔑 /apihelp — راهنمای API Key\n" +
        "🔍 /googlekey — کلید جستجوی گوگل",
        { reply_markup: MAIN_KB });
      return true;

    case "/models":
      await openPicker(env, token, chatId);
      return true;

    case "/auto":
      await setSettings(env, chatId, { auto: true, model: "" });
      await sendMessage(token, chatId, "✅ <b>حالت خودکار فعاله!</b> 🤖\nخودم بهترین مدل رو انتخاب می‌کنم.", { reply_markup: MAIN_KB });
      return true;

    case "/reasoning": {
      const s = await getSettings(env, chatId);
      if (arg && ["auto", "low", "medium", "high"].includes(arg.toLowerCase())) {
        await setSettings(env, chatId, { reasoning: arg.toLowerCase() });
        const labels = { auto: "🤖 خودکار", low: "🟢 کم", medium: "🟡 متوسط", high: "🔴 زیاد" };
        await sendMessage(token, chatId, `✅ عمق فکر روی <b>${labels[arg.toLowerCase()]}</b> تنظیم شد ⚙️`);
      } else {
        await sendInlineKeyboard(token, chatId, "⚙️ <b>عمق فکر</b> — یک حالت انتخاب کن:", reasoningKeyboard(s.reasoning));
      }
      return true;
    }

    case "/diag": {
      const s = await getSettings(env, chatId);
      let model = arg || s.model || autoPick(env, false);
      if (!model) { await sendMessage(token, chatId, "هیچ پروایدری تنظیم نشده. /apihelp رو بزن."); return true; }
      // normalize "provider/model" to "provider:model"
      const seg = model.indexOf("/");
      if (seg > 0 && ["bynara", "gemini", "groq", "openrouter", "mistral"].includes(model.slice(0, seg))) {
        model = model.slice(0, seg) + ":" + model.slice(seg + 1);
      }
      await sendChatAction(token, chatId, "typing");
      try {
        if (isExternalSelection(model)) {
          await callSingle(env, model, "", [{ role: "user", content: "ping" }]);
        }
        await sendMessage(token, chatId, `✅ مدل «${labelOfModel(model)}» کار می‌کنه.`);
      } catch (e) {
        await sendMessage(token, chatId,
          `❌ مدل «${labelOfModel(model)}» کار نکرد.\nخطا: ${e.message}\n\n` +
          "احتمالاً کلید API تنظیم نشده یا مدل نامعتبره. /apihelp رو بزن.");
      }
      return true;
    }

    case "/model": {
      const s = await getSettings(env, chatId);
      const mode = s.auto ? "خودکار 🤖" : (s.model ? escHtml(labelOfModel(s.model)) : "(تعیین‌نشده)");
      const reasonLabels = { auto: "🤖 خودکار", low: "🟢 کم", medium: "🟡 متوسط", high: "🔴 زیاد" };
      await sendMessage(token, chatId,
        `🧩 <b>حالت:</b> ${s.auto ? "خودکار" : "دستی"}\n` +
        `🤖 <b>مدل فعلی:</b> ${mode}\n` +
        `⚙️ <b>عمق فکر:</b> ${reasonLabels[s.reasoning] || s.reasoning}\n\n` +
        `برای تغییر: <code>/models</code> یا <code>/reasoning</code>`);
      return true;
    }

    // ── MEMORY ──
    case "/remember":
      if (!arg) { await sendMessage(token, chatId, "بعد از /remember چیزی که باید یادت بمونه رو بنویس.\nمثال: /remember اسمم دانیه"); return true; }
      await addFact(env, chatId, arg);
      await sendMessage(token, chatId, "✅ ذخیره شد و همیشه یادم می‌مونه 🧠\n\n<code>" + escHtml(arg) + "</code>");
      return true;

    case "/globalrem":
      if (!arg) { await sendMessage(token, chatId, "بعد از <code>/globalrem</code> چیزی که در <b>همه چت‌ها</b> یادت بمونه رو بنویس.\nمثال: <code>/globalrem من عاشق قهوه‌ام</code>"); return true; }
      await addGlobalFact(env, arg);
      await sendMessage(token, chatId, "✅ ذخیره شد به‌صورت <b>جهانی</b> 🌍\n\n<code>" + escHtml(arg) + "</code>");
      return true;

    case "/memory": {
      const facts = await getFacts(env, chatId);
      const globalFacts = await getGlobalFacts(env);
      if (!facts.length && !globalFacts.length) {
        await sendMessage(token, chatId, "🧠 هنوز چیزی ذخیره نکردی.\nبا /remember یا /globalrem اطلاعات‌ت رو ذخیره کن.");
        return true;
      }
      let out = "🧠 <b>اطلاعات ذخیره‌شده</b>\n\n";
      if (globalFacts.length) {
        out += "🌍 <b>جهانی</b> (همه چت‌ها):\n";
        globalFacts.forEach((f, i) => { out += `  <b>${i + 1}.</b> ${escHtml(f)}\n`; });
        out += "\n";
      }
      if (facts.length) {
        out += "💬 <b>این چت:</b>\n";
        facts.forEach((f, i) => { out += `  <b>${i + 1}.</b> ${escHtml(f)}\n`; });
      }
      out += "\n🗑 برای پاک‌کردن: <code>/forget</code>";
      await sendMessage(token, chatId, out);
      return true;
    }

    case "/forget":
      await clearFacts(env, chatId);
      await clearGlobalFacts(env);
      await sendMessage(token, chatId, "🗑 <b>همه اطلاعات پاک شد</b> ✨");
      return true;

    case "/reset":
      await clearHistory(env, chatId);
      await sendMessage(token, chatId, "🧹 <b>حافظه مکالمه پاک شد</b> ✨\n<i>اطلاعات /remember و /globalrem دست‌نخورده موند</i>");
      return true;

    // ── SYSTEM PROMPT (interactive editing) ──
    case "/system": {
      const current = (await getSystem(env, chatId)) || DEFAULT_SYSTEM;
      await setEditState(env, chatId, { mode: "edit_system", original: current, stage: "ask" });
      if (arg) {
        // User already gave the change — process it through the edit flow
        return handleEditFlow(env, token, chatId, arg, { mode: "edit_system", original: current, stage: "ask" });
      }
      await sendMessage(token, chatId,
        "⚙️ <b>ویرایش سیستم‌پرامپت</b>\n\n" +
        "<b>سیستم‌پرامپت فعلی:</b>\n<code>" + escHtml(current.slice(0, 1500)) + (current.length > 1500 ? "..." : "") + "</code>\n\n" +
        "✏️ <b>بگو چه تغییری می‌خوای</b> — مثلاً «رسمی‌تر باش» یا «فقط انگلیسی جواب بده» یا کل متن جدید رو بفرست.\n" +
        "من متنت رو تمیز می‌کنم و برای <b>تایید</b> بهت نشون می‌دم ✅\n\n" +
        "🚫 لغو: <code>/cancel</code>",
        { reply_markup: MAIN_KB });
      return true;
    }

    case "/globalsys": {
      const current = (await getGlobalSystem(env)) || DEFAULT_SYSTEM;
      await setEditState(env, chatId, { mode: "edit_globalsys", original: current, stage: "ask" });
      if (arg) {
        return handleEditFlow(env, token, chatId, arg, { mode: "edit_globalsys", original: current, stage: "ask" });
      }
      await sendMessage(token, chatId,
        "🌍 <b>ویرایش سیستم‌پرامپت جهانی</b>\n\n" +
        "<b>متن فعلی:</b>\n<code>" + escHtml(current.slice(0, 1500)) + (current.length > 1500 ? "..." : "") + "</code>\n\n" +
        "✏️ <b>بگو چه تغییری می‌خوای</b> یا کل متن جدید رو بفرست.\n" +
        "این در <b>همه چت‌ها</b> اعمال می‌شه.\n\n" +
        "🚫 لغو: <code>/cancel</code>",
        { reply_markup: MAIN_KB });
      return true;
    }

    // ── USAGE ──
    case "/usage": {
      const [today, week, month] = await Promise.all([
        aggregate(env, chatId, 1),
        aggregate(env, chatId, 7),
        aggregate(env, chatId, 30),
      ]);
      await sendMessage(token, chatId, formatUsageReport(today, week, month));
      return true;
    }

    // ── SEARCH ──
    case "/search":
      if (!arg) { await sendMessage(token, chatId, "بعد از /search عبارت جستجو رو بنویس.\nمثال: /search قیمت بیت‌کوین"); return true; }
      await doSearch(env, token, chatId, arg);
      return true;

    // ── REMINDERS ──
    case "/remind":
      if (!arg) { await sendMessage(token, chatId, "مثال: <code>/remind زنگ بزن ساعت 18:30</code>\nیا: <code>/remind خرید کن ساعت 6</code>"); return true; }
      // Parse time (handles بعد از ظهر / pm / am → 24h) then strip it for the text.
      const remArg = normalizeDigits(arg);
      const clk = parseClock(remArg);
      let remText = remArg, remTime = "";
      if (clk) {
        remTime = `ساعت ${clk.hour}:${String(clk.minute).padStart(2, "0")}`;
        remText = remArg
          .replace(/(بعد\s*از\s*ظهر|بعدازظهر|صبح|بامداد|عصر|شب|ظهر|pm|am)/gi, "")
          .replace(/ساعت\s*\d{1,2}(?::\d{2})?/g, "")
          .replace(/\bat\s+\d{1,2}(?::\d{2})?\s*(am|pm)?/gi, "")
          .replace(/\b\d{1,2}:\d{2}\b/g, "")
          .replace(/\s+/g, " ").trim();
      }
      await setReminder(env, token, chatId, remText, remTime);
      return true;

    case "/reminders": {
      const reminders = await getReminders(env, chatId);
      if (!reminders.length) { await sendMessage(token, chatId, "⏰ هیچ یادآوری تنظیم نشده.\nمثال: /remind زنگ بزن ساعت 18:30"); return true; }
      const rtz = (await getSettings(env, chatId)).tz || "Asia/Tehran";
      let out = "⏰ <b>یادآورهای تو</b>\n\n";
      reminders.forEach((r, i) => {
        out += `<b>${i + 1}.</b> ${escHtml(r.text)}\n   ⏰ <code>${formatLocal(rtz, new Date(r.time))}</code>\n`;
      });
      await sendMessage(token, chatId, out);
      return true;
    }

    // ── CRON JOBS ──
    case "/cron":
      if (!arg) {
        await sendMessage(token, chatId,
          "📅 <b>زمان‌بندی (Cron Job)</b>\n\n" +
          "یه وظیفه زمان‌بندی‌شده بساز 🤖\n\n" +
          "<b>مثال‌ها:</b>\n" +
          "• <code>/cron هر روز ساعت ۹ بگو صبح بخیر</code>\n" +
          "• <code>/cron هر ساعت یادآوری کن آب بخورم</code>\n" +
          "• <code>/cron هر ۳۰ دقیقه قیمت بیت‌کوین</code>\n" +
          "• <code>/cron هر هفته گزارش بده</code>\n\n" +
          "یا فقط بنویس: <code>هر روز ساعت ۹ صبح بخیر بگو</code>",
          { reply_markup: MAIN_KB });
      } else {
        await handleCronRequest(env, token, chatId, arg);
      }
      return true;

    case "/cronlist": {
      const jobs = await getCronJobs(env, chatId);
      if (!jobs.length) {
        await sendMessage(token, chatId,
          "📅 هنوز زمان‌بندی‌ای نساختی 🤷\n\n" +
          "مثال: <code>/cron هر روز ساعت ۹ صبح بخیر بگو</code>",
          { reply_markup: MAIN_KB });
        return true;
      }
      let out = "📅 <b>زمان‌بندی‌های تو</b>\n\n";
      const ctz = (await getSettings(env, chatId)).tz || "Asia/Tehran";
      jobs.forEach((j, i) => {
        const next = formatLocal(ctz, new Date(j.nextRun));
        out += `<b>${i + 1}.</b> ${escHtml(j.label)}\n`;
        out += `   🔄 <i>${escHtml(j.description)}</i>\n`;
        out += `   ⏰ <code>${next}</code>\n`;
        out += `   🗑 <code>/delcron ${j.id.slice(-6)}</code>\n\n`;
      });
      await sendMessage(token, chatId, out, { reply_markup: MAIN_KB });
      return true;
    }

    case "/delcron": {
      if (!arg) { await sendMessage(token, chatId, "فرمت: <code>/delcron &lt;id&gt;</code>\nآیدی رو از /cronlist بگیر."); return true; }
      const jobs = await getCronJobs(env, chatId);
      const job = jobs.find(j => j.id.endsWith(arg));
      if (job) {
        await removeCronJob(env, chatId, job.id);
        await sendMessage(token, chatId, `✅ زمان‌بندی «${escHtml(job.label)}» حذف شد 🗑`);
      } else {
        await sendMessage(token, chatId, "❌ زمان‌بندی پیدا نشد. /cronlist رو ببین.");
      }
      return true;
    }

    // ── TIMEZONE ──
    case "/tz":
    case "/timezone": {
      const s = await getSettings(env, chatId);
      const curTz = s.tz || "Asia/Tehran";
      if (arg) {
        const resolved = resolveTimezone(arg);
        if (!resolved) {
          await sendMessage(token, chatId,
            "❌ منطقه زمانی رو نشناختم 🤔\n\n" +
            "این‌جوری بنویس:\n" +
            "• شهر/کشور: <code>/timezone تهران</code> · <code>/timezone دبی</code> · <code>/timezone London</code>\n" +
            "• اختلاف ساعت: <code>/timezone +3:30</code> · <code>/timezone -8</code>\n" +
            "• کد IANA: <code>/timezone Europe/Berlin</code>");
          return true;
        }
        await setSettings(env, chatId, { tz: resolved.tz });
        await sendMessage(token, chatId,
          `✅ منطقه زمانی روی <b>${escHtml(resolved.tz)}</b> تنظیم شد 🕒\n` +
          `الان: <b>${formatLocal(resolved.tz)}</b> — ${dayNameFa(resolved.tz)}\n\n` +
          "از این به بعد یادآوری‌ها و کرون‌جاب‌ها بر اساس این ساعت تنظیم می‌شن ⏰",
          { reply_markup: MAIN_KB });
        return true;
      }
      await sendInlineKeyboard(token, chatId,
        `🕒 <b>منطقه زمانی فعلی:</b> <code>${escHtml(curTz)}</code>\n` +
        `الان: <b>${formatLocal(curTz)}</b> — ${dayNameFa(curTz)}\n\n` +
        "یکی رو انتخاب کن، یا خودت بنویس:\n" +
        "<code>/timezone دبی</code> · <code>/timezone +3:30</code> · <code>/timezone Europe/London</code>",
        [
          [{ text: "🇮🇷 تهران", callback_data: "tz|Asia/Tehran" }, { text: "🇦🇪 دبی", callback_data: "tz|Asia/Dubai" }],
          [{ text: "🇹🇷 استانبول", callback_data: "tz|Europe/Istanbul" }, { text: "🇬🇧 لندن", callback_data: "tz|Europe/London" }],
          [{ text: "🇩🇪 برلین", callback_data: "tz|Europe/Berlin" }, { text: "🇷🇺 مسکو", callback_data: "tz|Europe/Moscow" }],
          [{ text: "🇺🇸 نیویورک", callback_data: "tz|America/New_York" }, { text: "🇺🇸 لس‌آنجلس", callback_data: "tz|America/Los_Angeles" }],
        ]);
      return true;
    }

    // ── GOOGLE SEARCH API KEY HELP ──
    case "/googlekey":
      await sendMessage(token, chatId,
        "🔍 <b>آموزش گرفتن کلید جستجوی گوگل</b>\n\n" +
        "بات از DuckDuckGo برای جستجو استفاده می‌کنه (رایگان، بدون کلید) ✅\n" +
        "اما اگه می‌خوای از <b>Google Custom Search</b> استفاده کنی:\n\n" +
        "<b>مرحله ۱: ساخت Custom Search Engine</b>\n" +
        "۱. برو به: <code>https://programmablesearchengine.google.com</code>\n" +
        "۲. روی <b>Get started</b> بزن\n" +
        "۳. سایت‌هایی که می‌خوای توشون سرچ بشه رو وارد کن (یا * برای همه)\n" +
        "۴. اسم بده و بساز\n" +
        "۵. <b>Search Engine ID (CX)</b> رو کپی کن\n\n" +
        "<b>مرحله ۲: گرفتن API Key</b>\n" +
        "۱. برو به: <code>https://developers.google.com/custom-search/v1/overview</code>\n" +
        "۲. روی <b>Get a Key</b> بزن\n" +
        "۳. یه پروژه Google Cloud بساز (اگه نداری)\n" +
        "۴. API Key رو کپی کن\n\n" +
        "<b>مرحله ۳: تنظیم در بات</b>\n" +
        "<code>npx wrangler secret put GOOGLE_SEARCH_API_KEY</code>\n" +
        "<code>npx wrangler secret put GOOGLE_SEARCH_CX</code>\n\n" +
        "💡 <b>نکته:</b> Google Custom Search رایگانه تا ۱۰۰ جستجو در روز!\n" +
        "اگه بیشتر خواستی، باید پول بدی. ولی DuckDuckGo همیشه رایگانه 🎉",
        { disable_web_page_preview: true });
      return true;

    // ── API HELP ──
    case "/apihelp":
      await sendMessage(token, chatId,
        "🔑 <b>راهنمای گرفتن API Key</b>\n\n" +
        "🌟 <b>Bynara</b> — مدل‌های پریمیوم 🚀\n" +
        "۱. برو به: <code>https://router.bynara.id</code>\n" +
        "۲. ثبت‌نام کن و API Key بگیر\n" +
        "۳. کلید رو ذخیره کن:\n" +
        "<code>npx wrangler secret put BYNARA_API_KEY</code>\n\n" +
        "✨ <b>Gemini (Google)</b> — رایگان 🆓\n" +
        "۱. برو به: <code>https://aistudio.google.com/apikey</code>\n" +
        "۲. روی <b>Create API Key</b> بزن\n" +
        "۳. کلید رو ذخیره کن:\n" +
        "<code>npx wrangler secret put GEMINI_API_KEY</code>\n\n" +
        "⚡ <b>Groq</b> — رایگان، بسیار سریع 🚀\n" +
        "۱. برو به: <code>https://console.groq.com/keys</code>\n" +
        "۲. ثبت‌نام کن و <b>Create Key</b> بزن\n" +
        "<code>npx wrangler secret put GROQ_API_KEY</code>\n\n" +
        "🔍 <b>OpenRouter</b> — مدل‌های رایگان 🎁\n" +
        "۱. برو به: <code>https://openrouter.ai/keys</code>\n" +
        "۲. ثبت‌نام کن و کلید بساز\n" +
        "<code>npx wrangler secret put OPENROUTER_API_KEY</code>\n\n" +
        "🌀 <b>Mistral</b> — رایگان تا سقف مشخص\n" +
        "۱. برو به: <code>https://console.mistral.ai/api-keys</code>\n" +
        "۲. ثبت‌نام کن و کلید بساز\n" +
        "<code>npx wrangler secret put MISTRAL_API_KEY</code>\n\n" +
        "📌 بعد از تنظیم کلید: <code>npm run deploy</code>\n\n" +
        "💡 حداقل یک کلید کافیه! بات خودکار fallback می‌گیره 🔄\n\n" +
        "🔍 برای جستجوی گوگل: /googlekey",
        { disable_web_page_preview: true });
      return true;
  }
  return false;
}

// ──────────────────────────────────────────────────────────────
// CRON — usage reports
// ──────────────────────────────────────────────────────────────
async function sendUsageReports(env) {
  const token = env.BOT_TOKEN;
  if (!token) return;

  // Only send ONCE per day, around 9:00 Tehran time (= 5:30 UTC).
  // The cron runs every 5 min, so gate by time window + a stored "last sent" date.
  const now = new Date();
  const utcHour = now.getUTCHours();
  const utcMin = now.getUTCMinutes();
  // 9:00 Tehran = 5:30 UTC. Fire in the 5:30–5:59 window.
  const inWindow = (utcHour === 5 && utcMin >= 30);
  if (!inWindow) return;

  const todayStr = now.toISOString().slice(0, 10);
  const lastSent = await env.MEMORY.get("usage:lastreport");
  if (lastSent === todayStr) return; // already sent today
  await env.MEMORY.put("usage:lastreport", todayStr);

  const chats = await getChats(env);
  for (const chatId of chats) {
    try {
      const [yesterday, week, month] = await Promise.all([
        aggregate(env, chatId, 1, 1),
        aggregate(env, chatId, 7),
        aggregate(env, chatId, 30),
      ]);
      // Only send if there was actual usage
      if (yesterday.count === 0) continue;
      const report = "📊 <b>گزارش روزانه مصرف</b>\n━━━━━━━━━━━━━\n\n" +
        formatUsageReport(yesterday, week, month, { todayLabel: "📆 دیروز" });
      await sendMessage(token, chatId, report);
    } catch (e) { /* continue */ }
  }
}

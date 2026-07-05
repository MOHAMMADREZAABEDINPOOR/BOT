// Natural-language intent router: figures out what the user wants WITHOUT
// forcing them to type a "/" command.
//
// Returns one of:
//   { action: "chat" }
//   { action: "pick_model" }
//   { action: "set_auto" }
//   { action: "set_reasoning", level: "low"|"medium"|"high" }
//   { action: "usage" | "memory" | "help" }
//   { action: "set_system", text: "..." }
//   { action: "search", query: "..." }
//   { action: "reminder_set", text: "...", timeExpr: "..." }
//   { action: "reminder_list" }
//
// Strategy: fast bilingual keyword rules first (deterministic, free).

// Convert Persian/Arabic numerals to English so \d regexes work.
import { parseClock } from "./tz.js";
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

const RX = {
  changeModel: /(عوض (کن|کردن).*مدل|مدل.*(عوض|تغییر|انتخاب|لیست|دیگ)|تغییر مدل|لیست مدل|کدوم مدل|change model|switch model|list models|which model|model list|other model)/i,
  auto: /(خودکار|اتومات|اتو|auto ?mode|automatic)/i,
  reasoning: /(فکر|تفکر|استدلال|عمق فکر|reason|thinking|think (harder|more|less))/i,
  usage: /(مصرف|هزینه|توکن|usage|cost|token)/i,
  memory: /(حافظه|یادت|ذخیره کرد|memory|remember(ed)?)/i,
  search: /(سرچ|جستجو|جست و جو|search|google|googling|look up|find online)/i,
  system: /(سیستم پرامپت|نقش|role|system prompt|set system|change (your )?role)/i,
  reminder: /(یادم بنداز|یادآور|reminder|remind me|alert me|notify me)/i,
  reminderList: /(یادآورها|reminder list|list reminder|show reminder)/i,
  cronJob: /(کرون\s*جاب|کرون‌جاب|cron ?job|scheduled task|زمان‌بندی|زمان بندي|هر\s*\d*\s*(روز|ساعت|دقیقه|هفته)|هرروز|همیشه\s*(هر\s*روز\s*)?ساعت|every\s*\d*\s*(day|hour|minute|week)|hourly|daily|weekly|schedule me|cron)/i,
  cronList: /(لیست کرون|کرون‌ها|cron list|list cron|show cron)/i,
  rememberSave: /(یادت باشه|یادت بمونه|به خاطر بسپار|به خاطر داشته باش|تو (حافظه|مموری)|در (حافظه|مموری)|ذخیره‌?ش? کن|ذخیره بشه|این رو حفظ کن|remember this|save this|note this|keep this in mind|store this)/i,
  timezone: /(منطقه\s*زمانی|تایم\s*زون|timezone|time\s*zone|تنظیم\s*ساعت|تغییر\s*ساعت|ساعت\s*(رو|و)\s*(به|روی|عوض|تغییر)|ساعت\s*(بات|ربات|رباتو))/i,
};

// Pull an explicit low/medium/high level out of the message, if present.
function reasoningLevel(text) {
  if (/(بیشتر|زیاد|بالا|عمیق|دقیق|high|deep|hard|max|more)/i.test(text)) return "high";
  if (/(کمتر|کم|پایین|سریع|low|fast|quick|less)/i.test(text)) return "low";
  if (/(متوسط|میانه|medium|normal)/i.test(text)) return "medium";
  return null;
}

// Detect if the user is asking to set a reminder with a time expression.
// Returns { action: "reminder_set", text, timeExpr } or null.
function detectReminder(text) {
  if (!RX.reminder.test(text)) return null;

  // Parse the clock time (handles بعد از ظهر / عصر / صبح / pm / am → 24h).
  const clock = parseClock(text);
  let timeExpr = "";
  if (clock) timeExpr = `ساعت ${clock.hour}:${String(clock.minute).padStart(2, "0")}`;

  // Extract the reminder text (strip the trigger phrase + time words)
  let reminderText = text
    .replace(/یادم بنداز\s*(که\s*)?/i, "")
    .replace(/یادآور\b.*?(ساعت|در|at|تا)?/i, "")
    .replace(/remind me (to|that|about)?/i, "")
    .replace(/(بعد\s*از\s*ظهر|بعدازظهر|صبح|بامداد|عصر|شب|ظهر|pm|am)/gi, "")
    .replace(/ساعت\s*[\d۰-۹]{1,2}(?::[\d۰-۹]{2})?/g, "")
    .replace(/\bat\s+\d{1,2}(?::\d{2})?\s*(am|pm)?/gi, "")
    .replace(/\b[\d۰-۹]{1,2}:[\d۰-۹]{2}\b/g, "")
    .trim();

  if (!reminderText) reminderText = "یادآوری";

  return { action: "reminder_set", text: reminderText, timeExpr };
}

// Strip the "remember this" trigger phrase to get just the fact to store.
function extractRememberFact(text) {
  return String(text)
    .replace(/(لطفا|لطفاً|میشه|می‌شه|میخوام|می‌خوام)\s*/gi, "")
    .replace(/(این(‌| )?(رو|و)?)\s*/gi, " ")
    .replace(/(یادت باشه|یادت بمونه|به خاطر بسپار|به خاطر داشته باش|تو (حافظه|مموری)|در (حافظه|مموری)|ذخیره‌?ش? کن|ذخیره بشه|حفظ کن|remember( this)?|save( this)?|note( this)?|keep this in mind|store this)\s*(که|:|,)?\s*/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function keywordIntent(rawText) {
  const text = normalizeDigits(rawText);
  const t = text.trim();

  // model management (highest priority)
  if (/^(مدل(‌?ها| ها)?|مدل‌ها|models?|model list)$/i.test(t)) return { action: "pick_model" };
  if (RX.changeModel.test(t)) return { action: "pick_model" };

  // timezone change (before reminders/search so "ساعت" doesn't misfire)
  if (RX.timezone.test(t)) {
    const arg = t
      .replace(/(منطقه\s*زمانی|تایم\s*زون|timezone|time\s*zone|رو|را|به|روی|تنظیم|تغییر|عوض|کن|بده|بشه|بذار|بگذار|ساعت|بات|ربات|رباتو|ست)/gi, " ")
      .replace(/\s+/g, " ").trim();
    return { action: "timezone", arg };
  }

  // save-to-memory in natural language → ask scope (this chat vs all chats)
  if (RX.rememberSave.test(t)) {
    const fact = extractRememberFact(t);
    return { action: "remember_ask", text: fact || t };
  }
  if (RX.auto.test(t) && (RX.changeModel.test(t) || /مدل|model/i.test(t) || t.length < 25))
    return { action: "set_auto" };
  if (RX.reasoning.test(t)) {
    const lvl = reasoningLevel(t);
    if (lvl) return { action: "set_reasoning", level: lvl };
  }
  if (RX.usage.test(t) && t.length < 40) return { action: "usage" };
  if (RX.memory.test(t) && /(نشون|ببین|چی|show|what)/i.test(t)) return { action: "memory" };

  // system prompt change
  if (RX.system.test(t) && /(تغییر|عوض|set|change|کن)/i.test(t))
    return { action: "set_system", text: t };

  // obvious real-time lookups (price/rate) → search even without the LLM layer
  if (/(^|\s)(قیمت|نرخ|price|rate)(\s|$)/i.test(t) && t.length < 45) {
    return { action: "search", query: t };
  }

  // search
  if (RX.search.test(t) && t.length > 5) {
    const query = t.replace(/^(سرچ|جستجو|جست و جو|search|google|googling|look up|find online)\s*(کن|کنید|بکن)?\s*/i, "").trim();
    return { action: "search", query: query || t };
  }

  // cron jobs (recurring) — check BEFORE reminders since "هر ساعت"/"هر روز" is recurring
  if (RX.cronList.test(t)) return { action: "cron_list" };
  if (RX.cronJob.test(t)) return { action: "cron_job", text: t };

  // reminders (one-time)
  if (RX.reminderList.test(t)) return { action: "reminder_list" };
  const reminder = detectReminder(t);
  if (reminder) return reminder;

  return null; // no confident keyword match
}

// Heuristic: is this a "hard" question? Used for auto model selection.
export function looksComplex(text) {
  const t = text.toLowerCase();
  const hardWords = /(اثبات|تحلیل|بهینه|الگوریتم|معادله|مشتق|انتگرال|کد|برنامه‌?نویس|دیباگ|رفع خطا|prove|proof|analyze|optimi[sz]e|algorithm|derive|integral|theorem|debug|refactor|architecture|complexity)/i;
  const longEnough = text.length > 220;
  const manyQ = (text.match(/\?/g) || []).length >= 2;
  return hardWords.test(t) || longEnough || manyQ;
}

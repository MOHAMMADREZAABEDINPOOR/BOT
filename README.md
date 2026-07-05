<a id="top"></a>

# 🤖 Telegram AI Bot on Cloudflare Workers

> A serverless, multi-provider Telegram AI assistant that runs **100% on Cloudflare Workers** — no server, no VPS, free tier friendly. Chat with Gemini, Groq, OpenRouter, Mistral & Bynara models, all with automatic fallback, memory, reminders, cron jobs and web search.

[![Persian Description](https://img.shields.io/badge/Read-Persian%20Description-0A66C2?style=for-the-badge)](#persian-description)
[![Platform](https://img.shields.io/badge/Runs%20on-Cloudflare%20Workers-F38020?style=for-the-badge&logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)
[![Language](https://img.shields.io/badge/Built%20with-JavaScript%20(ESM)-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](#)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](#license)

---

## ✨ What is this?

A **Telegram bot** that acts as an all-in-one AI assistant. Instead of running on a traditional server, the whole bot lives inside a **Cloudflare Worker** and receives messages through a **webhook**. That means:

- ⚡ **Zero servers to manage** — Cloudflare runs your code at the edge, on demand.
- 💸 **Free-tier friendly** — the Worker only wakes up when a message actually arrives.
- 🌍 **Globally fast** — runs close to your users.

### 🧠 Features

| Feature | Description |
|---|---|
| **5 AI providers** | Gemini, Groq, OpenRouter, Mistral, and Bynara (OpenAI-compatible) |
| **Automatic fallback** | If one model errors or returns empty, it silently tries the next model, then the next provider |
| **Auto model selection** | `/auto` picks the best model based on how complex your question is |
| **Reasoning depth** | `/reasoning low / medium / high` |
| **Cross-chat memory** | Facts you save persist across **all** chats & models (`/globalrem`) |
| **Per-chat memory** | Short-term conversation history + long-term facts (`/remember`) |
| **Editable personality** | Change the system prompt per-chat (`/system`) or globally (`/globalsys`) |
| **Reminders** | One-time, timezone-aware — "remind me at 6pm to call mom" |
| **Cron jobs** | Recurring scheduled tasks — "every day at 9" |
| **Timezone aware** | IANA zones, city names, or UTC offsets — DST handled correctly |
| **Web search** | Google Custom Search (optional) + DuckDuckGo + Wikipedia + live crypto prices |
| **Usage & cost tracking** | Per-model token usage and cost report (`/usage`) |
| **Rich formatting** | Markdown → Telegram HTML (bold, code blocks with copy button, tables) |
| **Natural language** | You don't have to type `/` commands — it understands intent in Persian & English |
| **Multi-language** | Replies in whatever language you write in |

---

## 🔌 What is a "webhook" (in plain English)?

Normally a bot has two ways to get new messages:

1. **Polling** — the bot constantly asks Telegram *"any new messages? any new messages?"* every second. Wasteful and always-on.
2. **Webhook** — you give Telegram a URL, and Telegram **pushes** each new message to that URL the instant it arrives.

A webhook is like giving someone your phone number so they **call you** when there's news — instead of you calling them every few seconds to check.

In this project, the "phone number" is your **Cloudflare Worker URL**. Telegram POSTs every update to it, the Worker processes the message, asks an AI model for a reply, and sends it back through the Telegram API. Because Workers only run when they're called, this is perfect for webhooks — it costs nothing while idle.

```
Telegram user ──▶ Telegram servers ──POST(webhook)──▶ Cloudflare Worker
                                                          │
                                    ┌─────────────────────┤
                                    ▼                     ▼
                             KV (memory/db)         AI provider API
                                    │                     │
                                    └────────▶ reply ◀─────┘
                                              │
Telegram user ◀── Telegram API ◀── sendMessage
```

A separate **Cron Trigger** fires the Worker every minute to check reminders, run cron jobs and send usage reports.

---

## 🛠️ Tech stack / specifications

| | |
|---|---|
| **Language** | JavaScript (ES Modules, `"type": "module"`) — no build step, no TypeScript |
| **Runtime** | Cloudflare Workers (V8 isolates, `nodejs_compat`) |
| **Deploy tool** | [Wrangler](https://developers.cloudflare.com/workers/wrangler/) (Cloudflare CLI) |
| **Database** | **Cloudflare KV** (key-value store, binding `MEMORY`) — no SQL server needed |
| **Scheduling** | Cloudflare Cron Triggers (`* * * * *`, every minute, always UTC) |
| **Entry point** | The Worker's `fetch()` handler = the webhook; `scheduled()` = the cron |
| **Telegram** | Raw Telegram Bot API over `fetch` (HTML parse mode) |

### What's stored in KV
- `mem:<chatId>` — last 30 messages of conversation
- `facts:<chatId>` — per-chat long-term facts
- `global:facts` — cross-chat facts shared by every conversation
- per-chat + global system prompt, per-chat settings (model, reasoning, timezone)
- reminders (one-time) and cron jobs (recurring)
- `usage:<chatId>:<date>` — daily token/cost buckets (45-day TTL)

---

## 📁 Project structure

```
src/
├── index.js       — main bot logic, webhook + cron handlers, all commands
├── providers.js   — AI providers + two-level automatic fallback
├── catalog.js     — model catalog & tiers
├── memory.js      — KV storage: history, facts, reminders, settings
├── router.js      — natural-language intent detection (FA/EN)
├── search.js      — web search (Google/DuckDuckGo/Wikipedia) + crypto prices
├── keyboards.js   — inline keyboards for the model picker
├── telegram.js    — Telegram Bot API helpers + Markdown→HTML
├── usage.js       — token usage accounting & cost reports
├── tz.js          — timezone parsing & conversion (DST-aware)
└── cf.js          — stub (Cloudflare Workers AI removed)
docs/
└── API_KEYS.md    — API key guide
wrangler.toml      — Worker config (KV binding, cron trigger)
set-webhook.sh     — helper to register the Telegram webhook
```

---

## 🚀 Setup — step by step

Run these commands **in order**. You need [Node.js](https://nodejs.org/) 18+ and a free [Cloudflare account](https://dash.cloudflare.com/sign-up).

### 1) Clone the repo

```bash
git clone https://github.com/YOUR_USERNAME/my-tg-bot.git
cd my-tg-bot
```

### 2) Install dependencies

```bash
npm install
```

### 3) Log in to Cloudflare

```bash
npx wrangler login
```

### 4) Create the KV database (memory)

```bash
npx wrangler kv namespace create MEMORY
```

Copy the `id` it prints and paste it into `wrangler.toml`, replacing `REPLACE_WITH_YOUR_KV_ID`:

```toml
[[kv_namespaces]]
binding = "MEMORY"
id = "paste-your-kv-id-here"
```

### 5) Add your secrets (API keys)

At least **`BOT_TOKEN`** and **one** AI provider key are required. The bot automatically falls back across every key you configure.

```bash
# Required — Telegram bot token from @BotFather
npx wrangler secret put BOT_TOKEN

# AI providers — add at least ONE (add more for fallback)
npx wrangler secret put GEMINI_API_KEY
npx wrangler secret put GROQ_API_KEY
npx wrangler secret put OPENROUTER_API_KEY
npx wrangler secret put MISTRAL_API_KEY
npx wrangler secret put BYNARA_API_KEY

# Optional — webhook security
npx wrangler secret put WEBHOOK_SECRET

# Optional — Google web search
npx wrangler secret put GOOGLE_SEARCH_API_KEY
npx wrangler secret put GOOGLE_SEARCH_CX
```

> 📖 Don't have the keys yet? See the **[API Key Guide](#-api-key-guide)** below — every provider is covered step by step.

### 6) Deploy the Worker

```bash
npm run deploy
```

Wrangler prints your Worker URL, e.g. `https://my-tg-bot.YOUR-SUBDOMAIN.workers.dev`.

### 7) Register the Telegram webhook

```bash
# ./set-webhook.sh <BOT_TOKEN> <WORKER_URL> [WEBHOOK_SECRET]
./set-webhook.sh 123456:ABC-YourBotToken https://my-tg-bot.YOUR-SUBDOMAIN.workers.dev

# If you set a WEBHOOK_SECRET, pass it as the 3rd argument:
./set-webhook.sh 123456:ABC-YourBotToken https://my-tg-bot.YOUR-SUBDOMAIN.workers.dev your-secret
```

You should get `{"ok":true,"result":true,"description":"Webhook was set"}`.

### 8) Done ✅

Open your bot in Telegram and send `/start`.

**Useful commands while developing:**

```bash
npm run dev     # run the Worker locally
npm run tail    # stream live logs from the deployed Worker
```

---

## 🔑 API Key Guide

Every AI provider below has a free tier. **You only need one to start.**

### 🤖 BOT_TOKEN — Telegram (required)
1. Open [@BotFather](https://t.me/BotFather) in Telegram.
2. Send `/newbot`, choose a name and a username ending in `bot`.
3. Copy the token it gives you (looks like `123456789:AAE...`).
4. `npx wrangler secret put BOT_TOKEN`

### ✨ GEMINI_API_KEY — Google (free)
1. Go to **https://aistudio.google.com/apikey**
2. Sign in with a Google account → **Create API Key**.
3. Copy it → `npx wrangler secret put GEMINI_API_KEY`

### ⚡ GROQ_API_KEY — Groq (free, ultra-fast)
1. Go to **https://console.groq.com/keys**
2. Sign up → **Create Key** → copy.
3. `npx wrangler secret put GROQ_API_KEY`

### 🔍 OPENROUTER_API_KEY — OpenRouter (free models)
1. Go to **https://openrouter.ai/keys**
2. Sign up → **Create Key** → copy.
3. `npx wrangler secret put OPENROUTER_API_KEY`

> OpenRouter offers many `:free` models that cost nothing.

### 🌀 MISTRAL_API_KEY — Mistral (free tier)
1. Go to **https://console.mistral.ai/api-keys**
2. Sign up → **Create new key** → copy.
3. `npx wrangler secret put MISTRAL_API_KEY`

### 🧩 BYNARA_API_KEY — Bynara (OpenAI-compatible endpoint)
1. Get a key from your Bynara dashboard at **https://router.bynara.id**
2. `npx wrangler secret put BYNARA_API_KEY`

### 🔒 WEBHOOK_SECRET — webhook security (optional but recommended)
```bash
openssl rand -hex 20          # generate a random secret
npx wrangler secret put WEBHOOK_SECRET
```
Then pass the same value as the 3rd argument to `set-webhook.sh`.

### 🔎 GOOGLE_SEARCH_API_KEY + GOOGLE_SEARCH_CX — Google web search (optional)
1. Enable the **Custom Search API** and create a key: **https://developers.google.com/custom-search/v1/overview**
2. Create a **Programmable Search Engine** (set it to search the whole web) at **https://programmablesearchengine.google.com/** and copy its **Search engine ID** (that's your `CX`).
3. Set both:
   ```bash
   npx wrangler secret put GOOGLE_SEARCH_API_KEY
   npx wrangler secret put GOOGLE_SEARCH_CX
   ```

> Without these, web search still works via DuckDuckGo + Wikipedia — Google just makes it more reliable.

---

## 📋 Commands

| Command | What it does |
|---|---|
| `/start` | Intro & welcome |
| `/help` | Full help |
| `/models` | Pick a model (Gemini/Groq/OpenRouter/Mistral/Bynara) |
| `/model` | Show current model & mode |
| `/auto` | Auto mode (bot picks the best model) |
| `/reasoning` | Set reasoning depth (low/medium/high) |
| `/diag` | Test a model's connectivity |
| `/search <query>` | Web search |
| `/remind <text> at <H:MM>` | Set a one-time reminder |
| `/reminders` | List reminders |
| `/cron <text> every day at <H>` | Set a recurring job |
| `/cronlist` | List cron jobs |
| `/timezone <city/zone>` | Set your timezone |
| `/remember <text>` | Save a fact to this chat |
| `/globalrem <text>` | Save a fact across all chats |
| `/memory` | Show what's saved |
| `/forget` | Clear saved facts |
| `/system <text>` | Change this chat's personality |
| `/globalsys <text>` | Change the global personality |
| `/reset` | Clear conversation memory |
| `/usage` | Token & cost report |
| `/apihelp` | API key guide inside the bot |

---

## 🐛 Found a bug? Have an idea?

**Please report it!** If something breaks, behaves oddly, or you have a feature request:

- 👉 Open an [**Issue**](../../issues) with the steps to reproduce (and a screenshot/log if you can — use `npm run tail` to grab logs).
- 🔧 Or send a **Pull Request** — contributions are very welcome.

I actively maintain this and will fix reported bugs. Every report genuinely helps make the bot better. 🙏

---

## 📄 License

MIT — free to use, modify and share.

---
---

<a id="persian-description"></a>

# 🤖 ربات هوش مصنوعی تلگرام روی Cloudflare Workers

[![Read English Description](https://img.shields.io/badge/Read-English%20Description-0A66C2?style=for-the-badge)](#top)

> یک دستیار هوش مصنوعی تلگرام که **۱۰۰٪ روی Cloudflare Workers** اجرا می‌شه — بدون سرور، بدون VPS، سازگار با پلن رایگان. با مدل‌های Gemini، Groq، OpenRouter، Mistral و Bynara چت کن؛ همه با fallback خودکار، حافظه، یادآوری، زمان‌بندی و جستجوی وب.

## ✨ این پروژه چیه؟

یک **ربات تلگرام** که مثل یه دستیار هوش مصنوعیِ همه‌کاره عمل می‌کنه. به‌جای اینکه روی یه سرور معمولی اجرا بشه، کل ربات داخل یه **Cloudflare Worker** زندگی می‌کنه و پیام‌ها رو از طریق **وب‌هوک (webhook)** می‌گیره. یعنی:

- ⚡ **هیچ سروری برای مدیریت نداری** — کلادفلر کدت رو روی لبه‌ی شبکه و فقط وقتی لازمه اجرا می‌کنه.
- 💸 **سازگار با پلن رایگان** — Worker فقط وقتی که واقعاً یه پیام برسه بیدار می‌شه.
- 🌍 **سریع در سطح جهانی** — نزدیک به کاربرات اجرا می‌شه.

### 🧠 امکانات

| امکان | توضیح |
|---|---|
| **۵ پرووایدر هوش مصنوعی** | Gemini، Groq، OpenRouter، Mistral و Bynara |
| **fallback خودکار** | اگه یه مدل خطا بده یا خالی برگردونه، بی‌صدا می‌ره سراغ مدل بعدی، بعد پرووایدر بعدی |
| **انتخاب خودکار مدل** | با `/auto` بهترین مدل رو بر اساس سختی سؤالت انتخاب می‌کنه |
| **عمق فکر** | `/reasoning low / medium / high` |
| **حافظه‌ی بین‌چتی** | چیزایی که ذخیره می‌کنی توی **همه‌ی** چت‌ها و مدل‌ها می‌مونه (`/globalrem`) |
| **حافظه‌ی هر چت** | تاریخچه‌ی کوتاه‌مدت + فکت‌های بلندمدت (`/remember`) |
| **شخصیت قابل تغییر** | سیستم‌پرامپت رو برای هر چت (`/system`) یا سراسری (`/globalsys`) عوض کن |
| **یادآوری** | یک‌بار مصرف و آگاه از منطقه‌ی زمانی — «یادم بنداز ساعت ۶ زنگ بزنم» |
| **کرون‌جاب** | کارهای تکرارشونده — «هر روز ساعت ۹» |
| **آگاه از تایم‌زون** | نام شهر، منطقه‌ی IANA یا آفست UTC — با پشتیبانی از تغییر ساعت تابستانی |
| **جستجوی وب** | Google Custom Search (اختیاری) + DuckDuckGo + ویکی‌پدیا + قیمت لحظه‌ای ارز دیجیتال |
| **گزارش مصرف و هزینه** | مصرف توکن و هزینه به تفکیک مدل (`/usage`) |
| **فرمت زیبا** | تبدیل Markdown به HTML تلگرام (بولد، بلوک کد با دکمه‌ی کپی، جدول) |
| **زبان طبیعی** | لازم نیست دستور `/` تایپ کنی — نیت تو رو فارسی و انگلیسی می‌فهمه |
| **چندزبانه** | به هر زبونی که بنویسی جواب می‌ده |

## 🔌 وب‌هوک (webhook) یعنی چی؟ (به زبان ساده)

یه ربات معمولاً دو راه برای گرفتن پیام‌های جدید داره:

1. **Polling (نظرسنجی مداوم)** — ربات هر ثانیه از تلگرام می‌پرسه: *«پیام جدید داری؟ پیام جدید داری؟»*. هدررفت منابع و همیشه‌روشن.
2. **Webhook (وب‌هوک)** — تو یه آدرس (URL) به تلگرام می‌دی، و تلگرام هر پیام جدید رو همون لحظه‌ای که می‌رسه به اون آدرس **می‌فرسته (push)**.

وب‌هوک مثل اینه که شماره‌ت رو به یکی بدی تا وقتی خبری شد **بهت زنگ بزنه** — به‌جای اینکه تو هر چند ثانیه بهش زنگ بزنی و بپرسی خبری شده یا نه.

توی این پروژه، اون «شماره‌ی تماس» همون **آدرس Cloudflare Worker** توئه. تلگرام هر آپدیت رو به اون POST می‌کنه، Worker پیام رو پردازش می‌کنه، از یه مدل هوش مصنوعی جواب می‌گیره و از طریق API تلگرام برمی‌گردونه. چون Workerها فقط وقتی صدا زده بشن اجرا می‌شن، این برای وب‌هوک عالیه — وقتی بیکاره هیچ هزینه‌ای نداره.

یه **Cron Trigger** جداگانه هم هر دقیقه Worker رو صدا می‌زنه تا یادآوری‌ها، کرون‌جاب‌ها و گزارش‌های مصرف رو چک کنه.

## 🛠️ مشخصات فنی

| | |
|---|---|
| **زبان** | جاوااسکریپت (ES Modules) — بدون مرحله‌ی build، بدون TypeScript |
| **محیط اجرا** | Cloudflare Workers (ایزوله‌های V8، با `nodejs_compat`) |
| **ابزار دیپلوی** | Wrangler (خط فرمان کلادفلر) |
| **دیتابیس** | **Cloudflare KV** (پایگاه‌داده‌ی کلید-مقدار، با بایندینگ `MEMORY`) — نیازی به SQL نیست |
| **زمان‌بندی** | Cron Triggers کلادفلر (هر دقیقه، همیشه UTC) |
| **نقطه‌ی ورود** | هندلر `fetch()` همون وب‌هوکه؛ `scheduled()` همون کرونه |
| **تلگرام** | Telegram Bot API خام روی `fetch` (با حالت HTML) |

## 🚀 نصب — قدم به قدم

این دستورها رو **به ترتیب** اجرا کن. به Node.js نسخه‌ی ۱۸ به بالا و یه حساب رایگان Cloudflare نیاز داری.

```bash
# ۱) کلون کردن مخزن
git clone https://github.com/YOUR_USERNAME/my-tg-bot.git
cd my-tg-bot

# ۲) نصب پکیج‌ها
npm install

# ۳) ورود به کلادفلر
npx wrangler login

# ۴) ساخت دیتابیس KV (حافظه)
npx wrangler kv namespace create MEMORY
#   آیدی چاپ‌شده رو توی wrangler.toml جایگزین REPLACE_WITH_YOUR_KV_ID کن
```

```bash
# ۵) ثبت کلیدها (secrets) — حداقل BOT_TOKEN و یک کلید پرووایدر لازمه
npx wrangler secret put BOT_TOKEN
npx wrangler secret put GEMINI_API_KEY
npx wrangler secret put GROQ_API_KEY
npx wrangler secret put OPENROUTER_API_KEY
npx wrangler secret put MISTRAL_API_KEY
npx wrangler secret put BYNARA_API_KEY
# اختیاری:
npx wrangler secret put WEBHOOK_SECRET
npx wrangler secret put GOOGLE_SEARCH_API_KEY
npx wrangler secret put GOOGLE_SEARCH_CX
```

```bash
# ۶) دیپلوی
npm run deploy

# ۷) ثبت وب‌هوک (آدرس Worker رو از خروجی دیپلوی بردار)
./set-webhook.sh <BOT_TOKEN> https://my-tg-bot.YOUR-SUBDOMAIN.workers.dev
#   اگه WEBHOOK_SECRET گذاشتی، به‌عنوان آرگومان سوم بدش:
./set-webhook.sh <BOT_TOKEN> https://my-tg-bot.YOUR-SUBDOMAIN.workers.dev <secret>
```

بعد توی تلگرام `/start` رو بفرست ✅

دستورهای مفید موقع توسعه:

```bash
npm run dev     # اجرای محلی Worker
npm run tail    # دیدن لاگ زنده‌ی Worker دیپلوی‌شده
```

## 🔑 راهنمای گرفتن کلید API

همه‌ی پرووایدرها پلن رایگان دارن. **برای شروع فقط یکی کافیه.**

- **🤖 BOT_TOKEN (تلگرام، لازم):** توی [@BotFather](https://t.me/BotFather) دستور `/newbot` رو بزن، اسم و یوزرنیم بده، توکن رو کپی کن.
- **✨ GEMINI_API_KEY (رایگان):** برو به **https://aistudio.google.com/apikey** → روی *Create API Key* بزن.
- **⚡ GROQ_API_KEY (رایگان و خیلی سریع):** برو به **https://console.groq.com/keys** → *Create Key*.
- **🔍 OPENROUTER_API_KEY (مدل‌های رایگان):** برو به **https://openrouter.ai/keys** → *Create Key*. مدل‌های `:free` هیچ هزینه‌ای ندارن.
- **🌀 MISTRAL_API_KEY (پلن رایگان):** برو به **https://console.mistral.ai/api-keys** → *Create new key*.
- **🧩 BYNARA_API_KEY:** کلید رو از داشبورد **https://router.bynara.id** بگیر.
- **🔒 WEBHOOK_SECRET (اختیاری، برای امنیت):** با `openssl rand -hex 20` یه رشته‌ی تصادفی بساز و ثبتش کن، بعد همون رو به `set-webhook.sh` بده.
- **🔎 GOOGLE_SEARCH_API_KEY + GOOGLE_SEARCH_CX (اختیاری):** از **https://developers.google.com/custom-search/v1/overview** کلید بگیر و از **https://programmablesearchengine.google.com/** یه موتور جستجو بساز و آیدیش (CX) رو بردار. بدون این‌ها هم جستجو با DuckDuckGo و ویکی‌پدیا کار می‌کنه.

هر کلید رو با `npx wrangler secret put <NAME>` ثبت کن.

## 🐛 باگ دیدی؟ ایده داری؟

**حتماً گزارش بده!** اگه چیزی خراب شد، رفتار عجیبی دید، یا درخواست امکان جدید داری:

- 👉 یه [**Issue**](../../issues) باز کن و مراحل بازتولید خطا رو بنویس (اگه می‌تونی اسکرین‌شات/لاگ هم بذار — با `npm run tail` لاگ بگیر).
- 🔧 یا یه **Pull Request** بفرست — از مشارکت استقبال می‌شه.

من این پروژه رو فعالانه نگهداری می‌کنم و باگ‌های گزارش‌شده رو درست می‌کنم. هر گزارش واقعاً به بهتر شدن ربات کمک می‌کنه. 🙏

## 📄 لایسنس

MIT — آزاد برای استفاده، تغییر و انتشار.

[⬆️ برگشت به بالا / Back to top](#top)

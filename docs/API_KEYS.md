# راهنمای کامل گرفتن API Key

## ✨ Gemini (Google) — رایگان

1. برو به **https://aistudio.google.com/apikey**
2. با حساب گوگل وارد شو
3. روی **«Create API Key»** بزن
4. کلید رو کپی کن
5. در ترمینال:
   ```bash
   npx wrangler secret put GEMINI_API_KEY
   # کلید رو پیست کن و Enter بزن
   ```

---

## ⚡ Groq — رایگان، بسیار سریع

1. برو به **https://console.groq.com/keys**
2. ثبت‌نام کن (با گوگل یا ایمیل)
3. روی **«Create Key»** بزن
4. کلید رو کپی کن
5. در ترمینال:
   ```bash
   npx wrangler secret put GROQ_API_KEY
   ```

---

## 🔍 OpenRouter — مدل‌های رایگان

1. برو به **https://openrouter.ai/keys**
2. ثبت‌نام کن
3. روی **«Create Key»** بزن
4. کلید رو کپی کن
5. در ترمینال:
   ```bash
   npx wrangler secret put OPENROUTER_API_KEY
   ```

> نکته: OpenRouter مدل‌های رایگان (`:free`) داره که هیچ هزینه‌ای ندارن.

---

## 🌀 Mistral — رایگان تا سقف مشخص

1. برو به **https://console.mistral.ai/api-keys**
2. ثبت‌نام کن
3. روی **«Create new key»** بزن
4. کلید رو کپی کن
5. در ترمینال:
   ```bash
   npx wrangler secret put MISTRAL_API_KEY
   ```

---

## 🤖 Bot Token (Telegram)

1. در تلگرام به **@BotFather** پیام بده
2. `/newbot` بزن
3. اسم و username بات رو وارد کن
4. توکن رو کپی کن
5. در ترمینال:
   ```bash
   npx wrangler secret put BOT_TOKEN
   ```

---

## 🔒 Webhook Secret (اختیاری — برای امنیت)

```bash
# یک رشته تصادفی بساز
openssl rand -hex 20
# ذخیره کن
npx wrangler secret put WEBHOOK_SECRET
```

---

## 📌 بعد از تنظیم کلیدها

```bash
# Deploy کن
npm run deploy

# Webhook رو تنظیم کن
./set-webhook.sh https://your-worker.workers.dev
```

## 💡 نکات

- **حداقل یک کلید** کافیه — بات خودکار از بقیه هم fallback می‌گیره
- **Groq** سریع‌ترین گزینه برای چت روزمره
- **Gemini 2.5 Pro** قوی‌ترین برای سوالات پیچیده
- **OpenRouter** رایگان‌ترین (مدل‌های `:free`)
- **Mistral** گزینه خوبی برای اروپا (GDPR)
- بات خودکار بهترین مدل رو بر اساس پیچیدگی سوال انتخاب می‌کنه (حالت خودکار)

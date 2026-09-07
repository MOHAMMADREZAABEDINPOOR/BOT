<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=1,12,24,30&height=220&section=header&text=CLOUDFLARE_TELEGRAM_BOT&fontSize=36&fontAlignY=35&desc=%E2%9A%A1%20Ultra-Fast%20Serverless%20Webhook%20Bot%20on%20Cloudflare%20Edge&descFontSize=16&descAlignY=62" alt="Cloudflare Bot Banner" width="100%" />

<a href="https://github.com/MOHAMMADREZAABEDINPOOR/BOT">
  <img src="https://readme-typing-svg.demolab.com?font=Fira+Code&weight=600&size=20&duration=2800&pause=1000&color=00D2FF&center=true&vCenter=true&width=780&lines=Serverless+Telegram+Webhook+Bot+on+Cloudflare+Workers+Edge;Sub-15ms+Response+Latency+via+Direct+HTTP+Webhook+Pushes;Zero+Host+Server+Costs+Operating+on+Cloudflare+Free+Tier;Cloudflare+KV+Distributed+State+%26+Session+Persistence;High-Concurrency+Architecture+Handling+Thousands+of+Events" alt="Typing SVG" />
</a>

<br/>

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg?style=for-the-badge&logo=gnu)](https://www.gnu.org/licenses/agpl-3.0)
[![Cloudflare Workers](https://img.shields.io/badge/Runtime-Cloudflare_Workers-F38020?style=for-the-badge&logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)
[![Telegram Bot API](https://img.shields.io/badge/Telegram_Bot_API-Webhook-2CA5E0?style=for-the-badge&logo=telegram&logoColor=white)](https://core.telegram.org/bots/api)
[![Read in Persian](https://img.shields.io/badge/مطالعه_به_فارسی-Persian_README-008080?style=for-the-badge)](#-بخش-فوقالعاده-مفصل-و-جامع-به-زبان-فارسی-persian-documentation)

<p align="center">
  <b>BOT</b> is an ultra-fast, serverless Telegram webhook bot engineered directly on Cloudflare Workers and Cloudflare KV. Eliminating traditional polling delays and virtual private server hosting bills, BOT responds to Telegram webhook events in under 15 milliseconds globally.
</p>

[Overview](#-overview) •
[Deployment Guide](#-deployment-guide) •
[توضیحات فارسی](#-بخش-فوقالعاده-مفصل-و-جامع-به-زبان-فارسی-persian-documentation) •
[License](#-license)

</div>

---

## ⚡ Overview

Traditional long-polling Telegram bots require a running server 24/7. **BOT** leverages Telegram's official Webhook architecture running inside Cloudflare V8 isolates, waking up only when a message arrives and incurring zero cost when idle.

---

## 🚀 Deployment Guide

```bash
git clone https://github.com/MOHAMMADREZAABEDINPOOR/BOT.git
cd BOT

npm install
npx wrangler deploy

# Set Telegram Webhook:
curl -F "url=https://YOUR_WORKER.workers.dev/webhook" https://api.telegram.org/bot<TOKEN>/setWebhook
```

---

## 🇮🇷 بخش فوق‌العاده مفصل و جامع به زبان فارسی (Persian Documentation)

### ۱. معرفی ربات سرورلس تلگرام در لبه کلودفلر
پروژه **BOT** یک ربات وب‌هوک و بدون سرور (Serverless) برای پیام‌رسان تلگرام است که به صورت مستقیم روی **Cloudflare Workers** اجرا می‌شود. در این معماری، هیچ نیازی به سرور لینوکسی نیست و به محض ارسال پیام توسط کاربر، وب‌هوک تلگرام در کمتر از ۱۵ میلی‌ثانیه به ورکر کلودفلر ارسال شده و پاسخ داده می‌شود.

---

## 📜 License

Distributed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**.

---

<div align="center">
<img src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=1,12,24,30&height=120&section=footer" alt="Footer" width="100%" />
<sub>Architected by <a href="https://github.com/MOHAMMADREZAABEDINPOOR"><b>MOHAMMADREZA ABEDINPOOR</b></a>.</sub>
</div>

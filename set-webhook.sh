#!/usr/bin/env bash
# Usage: ./set-webhook.sh <BOT_TOKEN> <WORKER_URL> [WEBHOOK_SECRET]
set -e
TOKEN="$1"
URL="$2"
SECRET="$3"
if [ -z "$TOKEN" ] || [ -z "$URL" ]; then
  echo "Usage: ./set-webhook.sh <BOT_TOKEN> <WORKER_URL> [WEBHOOK_SECRET]"
  exit 1
fi
if [ -n "$SECRET" ]; then
  curl -s "https://api.telegram.org/bot${TOKEN}/setWebhook?url=${URL}&secret_token=${SECRET}"
else
  curl -s "https://api.telegram.org/bot${TOKEN}/setWebhook?url=${URL}"
fi
echo

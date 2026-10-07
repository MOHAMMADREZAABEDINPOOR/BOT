<div align="center">

<img src="assets/readme/hero.gif" width="1200" alt="PIMX EDGE BOT — rotating 3D geometry" />

**[English](README.md) · [فارسی](README.fa.md)**

<img src="assets/readme/identity.svg" width="1200" alt="ai / English and Persian documentation" />

</div>

# PIMX EDGE BOT

A Telegram AI assistant implemented as a Cloudflare Worker, with provider routing, chat memory, reminders and per-user timezone helpers.

[GitHub](https://github.com/MOHAMMADREZAABEDINPOOR/BOT) · [PIMX / Profile](https://github.com/MOHAMMADREZAABEDINPOOR) · [Static artwork](assets/readme/hero.png)

## Features

- Telegram webhook and inline keyboard handlers
- Multiple provider adapters and configurable model catalog
- KV-backed memory, settings and usage records
- Cron reminders and timezone conversion

## Stack

| Tool | Version / source |
|---|---|
| Node.js | `package.json` |

## Getting started

Node.js 22.12+ and the package manager declared in package.json. Install dependencies from the checked-in lockfile where available.

```bash
git clone https://github.com/MOHAMMADREZAABEDINPOOR/BOT.git
cd BOT

npm install
npm run dev
```

## Configuration

These names are found in the example configuration or source; not all are required. Check their defaults/usage in those files and supply secrets only in your local or hosting environment.

| Name | Role |
|---|---|
| `BOT_TOKEN` | Credential/connection setting; keep private |
| `BYNARA_API_KEY` | Credential/connection setting; keep private |
| `GEMINI_API_KEY` | Credential/connection setting; keep private |
| `GROQ_API_KEY` | Credential/connection setting; keep private |
| `MISTRAL_API_KEY` | Credential/connection setting; keep private |
| `OPENROUTER_API_KEY` | Credential/connection setting; keep private |
| `WEBHOOK_SECRET` | Credential/connection setting; keep private |

Hosting bindings: `MEMORY`.

## Usage

Create a MEMORY KV namespace, configure BOT_TOKEN, WEBHOOK_SECRET and at least one provider key, then deploy and register the Telegram webhook. Set the per-user timezone for reminders.

## Project structure

| Path | Role |
|---|---|
| [`assets/`](assets/) | Brand/media/README assets |
| [`docs/`](docs/) | Supporting documentation |
| [`src/`](src/) | Application source |
| [`package.json`](package.json) | Project entry/configuration file |
| [`set-webhook.sh`](set-webhook.sh) | Project entry/configuration file |
| [`wrangler.toml`](wrangler.toml) | Project entry/configuration file |

## Commands and checks

```bash
npm run dev
```

These commands are declared in package.json; the list is not a test execution report. Test commands may need a browser, service or prepared database.

## Deployment

Configure KV bindings with your own resource IDs and store secrets using Wrangler secret. Deploy the Worker and register an HTTPS webhook for a bot. Repository resource IDs are not provisioned for your account.

## Limitations

Worker limits and provider quotas apply. Model catalog entries may require changes as providers evolve. Media functions in src/cf.js are explicitly disabled in this snapshot.

## Troubleshooting

- Authentication/provider errors: verify credentials and selected model/provider.
- No Telegram updates: check polling/webhook mode and concurrent bot instances.
- Missing dependencies: use the declared manifest or inspect imports if no manifest is provided.

## Contributing

Create a focused branch, verify the affected behavior and explain the change clearly. Keep private data, build outputs and local databases out of commits.

## License

No repository-level license file is included in this snapshot. Public visibility alone does not grant reuse rights; contact the repository owner for terms.

---

Part of **PIMX** · Documentation in English and Persian.

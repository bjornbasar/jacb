# JACB — Just Another Chat Bot

Personal webhook bot server handling Telegram admin commands and Facebook Messenger keyword replies.

## Stack

- **Runtime**: Node.js 22 (ESM)
- **Server**: Fastify 5 + `@fastify/rate-limit`
- **HTTP**: Native `fetch` via undici
- **Deployment**: Docker

## Features

### Telegram
Admin-gated commands (only `TELEGRAM_ADMIN_ID` can use these):

| Command | Description |
|---|---|
| `/gh repo <owner>/<repo>` | Repo summary |
| `/gh runs <owner>/<repo>` | Recent workflow runs |
| `/gh issues <owner>/<repo>` | Open issues |
| `/gh prs <owner>/<repo>` | Open pull requests |
| `/gh discuss <owner>/<repo>` | Recent discussions |
| `/gh audit [org]` | Org audit log (Enterprise only) |
| `/help` | Help text |

Standard replies (hi, bye, thanks, help) work for all users.

### Messenger
Keyword replies and quick reply payloads across multiple Facebook pages. OpenAI fallback optional.

## Setup

```bash
cp .env.example .env
# fill in .env
docker compose up -d --build
```

Register the Telegram webhook (once):
```bash
curl "https://api.telegram.org/bot<TG_TOKEN>/setWebhook?url=https://<your-domain>/webhook/telegram"
```

## Development

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up
```

Mounts `src/` and runs nodemon — file saves trigger automatic restart.

## Environment

| Variable | Description |
|---|---|
| `TG_TOKEN` | Telegram bot token (BotFather) |
| `TELEGRAM_ADMIN_ID` | Your Telegram user ID |
| `FB_PAGE_TOKEN` | Facebook page access token |
| `FB_VERIFY_TOKEN` | Webhook verify token (self-chosen) |
| `GITHUB_TOKEN` | Fine-grained PAT (Actions/Issues/PRs/Contents read) |
| `USE_OPENAI` | `true` to enable OpenAI fallback |
| `OPENAI_API_KEY` | OpenAI API key |

## Endpoints

| Endpoint | Description |
|---|---|
| `GET /` | Health check |
| `POST /webhook/telegram` | Telegram webhook |
| `GET /webhook/messenger` | Messenger verification |
| `POST /webhook/messenger` | Messenger webhook |

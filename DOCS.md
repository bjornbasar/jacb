# JACB — Just Another Chat Bot

**Version:** 3.0.0 | **Author:** Bjorn Basar | **License:** MIT

A lightweight, self-hosted webhook bot server handling admin commands via Telegram and keyword-based replies on Facebook Messenger. Built with Fastify and Node.js ESM.

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Directory Structure](#directory-structure)
- [API Endpoints](#api-endpoints)
- [Telegram Integration](#telegram-integration)
- [Messenger Integration](#messenger-integration)
- [Docker API Integration](#docker-api-integration)
- [GitHub API Integration](#github-api-integration)
- [OpenAI Fallback](#openai-fallback)
- [Core Functions](#core-functions)
- [Utility Functions](#utility-functions)
- [Caching](#caching)
- [Error Handling](#error-handling)
- [Docker & Deployment](#docker--deployment)
- [Environment Variables](#environment-variables)

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Runtime | Node.js 22 (ESM) |
| Server | Fastify 5 |
| Rate Limiting | @fastify/rate-limit |
| HTTP Client | Native fetch (undici, IPv4-only) |
| Optional AI | OpenAI API |
| Config | dotenv |
| Dev | nodemon |
| Deployment | Docker (node:22-alpine) |

---

## Directory Structure

```
jacb/
├── src/
│   ├── index.js                      # App entry point (Fastify server)
│   ├── channels/
│   │   ├── telegram.js               # Telegram webhook handler
│   │   └── messenger.js              # Messenger webhook handler
│   ├── handlers/
│   │   ├── telegramCmds.js           # Telegram command routing
│   │   ├── github.js                 # GitHub API integration
│   │   ├── docker.js                 # Docker API integration
│   │   ├── standard.js               # Standard replies (hi, bye, thanks, help)
│   │   └── messengerReplies.js       # Messenger keyword/quick reply logic
│   └── lib/
│       ├── utils.js                  # Validation, fetch, sanitization
│       ├── cache.js                  # SimpleCache & GitHubCache classes
│       └── openai.js                 # OpenAI integration
├── docker-compose.yml                # Production config
├── docker-compose.dev.yml            # Dev override (nodemon + src mount)
├── Dockerfile                        # node:22-alpine container
├── package.json
├── .env.example                      # Environment template
└── README.md
```

---

## API Endpoints

| Method | Route | Rate Limit | Description |
|--------|-------|------------|-------------|
| GET | `/` | — | Health check → `{ status: 'healthy' }` |
| POST | `/webhook/telegram` | 30/1000ms | Telegram bot webhook |
| GET | `/webhook/messenger` | — | Messenger verification handshake |
| POST | `/webhook/messenger` | 100/1000ms | Messenger incoming messages |

---

## Telegram Integration

### Webhook Flow (`src/channels/telegram.js`)

1. Validate Telegram update structure
2. Route through handlers in order:
   - Admin command handler (if message starts with `/`)
   - Standard replies (keyword matching)
   - OpenAI fallback (if `USE_OPENAI=true`)
   - Random "learning" message (last resort)
3. Send response via `sendTelegramMessage(chatId, text)`

### `sendTelegramMessage(chatId, text)`
Posts to Telegram API with Markdown formatting. If Telegram returns 400 (Markdown rendering failure), retries without `parse_mode`.

### Admin Commands (`src/handlers/telegramCmds.js`)

Only executed for user matching `TELEGRAM_ADMIN_ID`.

#### GitHub Commands (`/gh`)

| Command | Description |
|---------|-------------|
| `/gh repo <owner>/<repo>` | Repository summary (stars, forks, issues, dates) |
| `/gh runs <owner>/<repo>` | Recent workflow runs with status |
| `/gh issues <owner>/<repo>` | Open issues list |
| `/gh prs <owner>/<repo>` | Open pull requests list |
| `/gh discuss <owner>/<repo>` | Recent discussions with categories |
| `/gh audit [org]` | Organization audit log (Enterprise only) |

#### Docker Commands (`/docker`)

| Command | Description |
|---------|-------------|
| `/docker ps` | Running containers with status indicators |
| `/docker all` | All containers (running + stopped) |
| `/docker projects` | Docker Compose project overview |
| `/docker stats` | Container CPU/memory usage |
| `/docker logs <name> [lines]` | Container logs (default: 20 lines) |
| `/docker restart <name>` | Restart a container |

#### Other

| Command | Description |
|---------|-------------|
| `/help` | Help text listing all commands |

### Standard Replies (`src/handlers/standard.js`)

| Trigger (regex) | Response |
|-----------------|----------|
| hi, hello | "Hey there! How can I help you today?" |
| bye, goodbye, see ya | "Goodbye! Come back anytime." |
| thanks, thank you | "You're welcome!" |
| help, support | Contextual help message |

---

## Messenger Integration

### Webhook (`src/channels/messenger.js`)

- **GET** — Verification handshake (validates `FB_VERIFY_TOKEN`)
- **POST** — Processes incoming messages via `handleEvent(event, pageId)`

### Quick Reply Payloads

| Payload | Response |
|---------|----------|
| `SITE` | Link to https://www.basar.co.nz |
| `PORTFOLIO` | Link to GitHub profile |
| `EMAIL` | Email contact info |
| `ABOUT` | Bio/about text |

### Keyword Replies (`src/handlers/messengerReplies.js`)

| Keyword | Response |
|---------|----------|
| site, website | Link to website |
| portfolio, projects | GitHub profile link |
| email, contact | Email contact |
| about | About text |
| help | Quick reply card with all options |

### Page-Specific Replies

Different Facebook pages get custom responses based on page ID environment variables:
- `BASAR_FAMILY_ID` — Family page
- `PEOPSQUIK_ID` — PeopsQuik page
- `FREYA_BRYAN_ID` — Freya Bryan page

Page-specific keywords: `quote`, `services`, `team`

---

## Docker API Integration

### `src/handlers/docker.js`

Multi-host Docker monitoring via Docker API v1.45. Connects to:
- **Nalle** (`192.168.4.9:2375`) — remote via TCP
- **Lars** (`/var/run/docker.sock`) — local socket

All listing commands (ps, all, projects, stats) query both hosts and group results by host. Container-specific commands (logs, restart) auto-resolve which host the container is on.

```javascript
dockerAPI(host: string, path: string): Promise<object>
// HTTP request to named host (TCP or socket)
// 5000ms timeout, returns parsed JSON

allHosts(path: string): Promise<Array<{host, data}>>
// Queries all hosts in parallel, returns successful results

findContainer(name: string): Promise<{host, container} | null>
// Searches all hosts for a container by name

listContainers(showAll: boolean): Promise<string>
// All hosts, grouped by host with status icons: 🟢 running, 🔴 exited, 🟡 other

listProjects(): Promise<string>
// Groups containers by Docker Compose project per host

containerStats(): Promise<string>
// CPU/memory per container from /containers/{id}/stats, grouped by host

containerLogs(name: string, lineCount?: number): Promise<string>
// Auto-resolves host, streams logs with Docker log frame parsing
// Default: 20 lines

restartContainer(name: string): Promise<string>
// Auto-resolves host, POST /containers/{id}/restart
// 30000ms timeout
```

---

## GitHub API Integration

### `src/handlers/github.js`

Uses fine-grained PAT with read-only permissions. Implements endpoint-specific caching.

```javascript
handleGhCommand(args: string[]): Promise<string>
// Main dispatcher for /gh subcommands

fetchRepoSummary(repo: string): Promise<string>
// Repository metadata: description, owner, stars, forks, open issues, dates

fetchWorkflowRuns(repo: string): Promise<string>
// Recent workflow runs with status/conclusion

fetchIssues(repo: string): Promise<string>
// Open issues with assignee info

fetchPRs(repo: string): Promise<string>
// Open pull requests with assignee info

fetchDiscussions(repo: string): Promise<string>
// Recent discussions via GraphQL-style endpoint

fetchAuditLog(org: string): Promise<string>
// Organization audit log (Enterprise GitHub only)

githubHeaders(extended?: boolean): object
// Auth headers with optional extended API support
```

### Cache TTLs

| Endpoint | TTL |
|----------|-----|
| repo | 5 minutes |
| runs | 1 minute |
| issues | 2 minutes |
| prs | 2 minutes |
| discussions | 5 minutes |
| audit | 15 minutes |

---

## OpenAI Fallback

### `src/lib/openai.js`

```javascript
getOpenAIResponse(message: string): Promise<string | null>
// Lazy-loaded via dynamic import if USE_OPENAI=true
// System prompt: "helpful assistant chatbot. Keep responses concise and friendly."
// Configurable model, max_tokens, temperature
// Returns null if disabled or quota exceeded
```

---

## Core Functions

### `src/index.js`

```javascript
// Initializes Fastify server with rate limiting
// Validates required environment variables
// Registers Telegram & Messenger route plugins
// GET / → health check
// Listens on PORT (default 3000)
```

### `src/channels/telegram.js`

```javascript
sendTelegramMessage(chatId: string, text: string): Promise<void>
// Posts to Telegram API, retries without Markdown on 400

// POST /webhook/telegram handler:
// Validates update → routes to command/standard/openai/default
```

### `src/channels/messenger.js`

```javascript
handleEvent(event: object, pageId: string): Promise<void>
// Processes quick reply payloads → standard replies → keyword replies → generic

sendMessage(recipientId: string, payload: string | object): Promise<void>
// Sends text or structured messages to Messenger API

// GET /webhook/messenger → verification handshake
// POST /webhook/messenger → incoming message handler
```

---

## Utility Functions

### `src/lib/utils.js`

```javascript
sanitizeInput(text: string): string
// Trims whitespace, caps at 4096 characters

isValidTelegramUpdate(update: object): boolean
// Validates message.chat.id and message.text exist

isValidMessengerEvent(event: object): boolean
// Validates sender.id and (message or quick_reply) exist

validateEnvVars(): void
// Checks required env vars. TG_TOKEN is required.

fetchJSON(url: string, options?: object): Promise<{ ok, status, data }>
// Wrapper around fetch with:
// - IPv4-only via undici Agent (avoids Docker DNS AAAA issues)
// - 10000ms timeout via AbortController
// - JSON parsing and error logging
```

---

## Caching

### `src/lib/cache.js`

```javascript
class SimpleCache {
  constructor(ttl = 300000)    // Default 5 minutes
  set(key, value, customTtl?)  // Store with optional custom TTL
  get(key)                     // Retrieve with expiry check
  delete(key)                  // Remove and clear timer
  clear()                      // Wipe all entries
  has(key)                     // Boolean check
}

class GitHubCache extends SimpleCache {
  setWithEndpoint(endpoint, key, value)  // Auto TTL from endpoint map
  generateKey(endpoint, ...params)        // Composite key builder
  // Endpoint TTLs: repo(5m), runs(1m), issues(2m), prs(2m), discussions(5m), audit(15m)
}

// Singleton: githubCache (exported instance)
```

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Telegram 400 (Markdown) | Retry without `parse_mode` |
| Messenger errors | Fire-and-forget, errors logged |
| GitHub API failures | User-friendly error messages returned |
| Docker API timeout | 5000ms timeout per host, graceful fallback |
| Docker restart timeout | 30000ms timeout |
| OpenAI quota exceeded | Graceful null return, logged |
| HTTP timeouts | 10000ms AbortController, errors logged |
| Missing env vars | Startup validation, TG_TOKEN required |

---

## Docker & Deployment

### Dockerfile

- **Base:** `node:22-alpine`
- Install prod dependencies + curl (healthcheck)
- Copy source to `/app`
- Expose port 3000
- CMD: `node src/index.js`

### Docker Compose

**Production** (`docker-compose.yml`):
- Image: `192.168.4.9:5000/jacb:dev` (pulled from local registry)
- Port: 3500→3000
- Volume: `/var/run/docker.sock:/var/run/docker.sock:ro` (read-only, for Lars local Docker access)
- Health check: `curl -f http://localhost:3000` (30s interval)
- Restart: always
- `NODE_OPTIONS: --dns-result-order=ipv4first`
- Runs on **Lars**, monitors Docker on both Lars (local socket) and Nalle (TCP 192.168.4.9:2375)

**Development** (`docker-compose.dev.yml`):
- Overrides command: `npm run dev`
- Mounts `./src:/app/src` for hot-reload via nodemon

### Webhook Registration

**Telegram:**
```bash
curl "https://api.telegram.org/bot<TG_TOKEN>/setWebhook?url=https://<domain>/webhook/telegram"
```

**Messenger:**
1. Configure webhook URL: `https://<domain>/webhook/messenger`
2. Set verify token matching `FB_VERIFY_TOKEN`
3. Subscribe to `message_postbacks` events

---

## Environment Variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `PORT` | No | 3000 | Server port |
| `TG_TOKEN` | **Yes** | — | Telegram bot token |
| `TELEGRAM_ADMIN_ID` | No | — | Admin user ID for privileged commands |
| `FB_PAGE_TOKEN` | No | — | Facebook page access token |
| `FB_VERIFY_TOKEN` | No | — | Messenger webhook verification token |
| `BASAR_FAMILY_ID` | No | — | Page ID for page-specific replies |
| `PEOPSQUIK_ID` | No | — | Page ID for page-specific replies |
| `FREYA_BRYAN_ID` | No | — | Page ID for page-specific replies |
| `GITHUB_TOKEN` | No | — | GitHub fine-grained PAT (read-only) |
| `USE_OPENAI` | No | `false` | Enable OpenAI fallback |
| `OPENAI_API_KEY` | No | — | OpenAI API key |
| `OPENAI_MODEL` | No | `gpt-3.5-turbo` | Model name |
| `OPENAI_MAX_TOKENS` | No | `200` | Max response tokens |
| `OPENAI_TEMPERATURE` | No | `0.7` | Response temperature |
| `NODE_ENV` | No | `production` | Environment mode |

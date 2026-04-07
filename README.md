# Email-to-Asana Automation

An automation system that monitors your Gmail inbox, uses Google Gemini AI to intelligently parse emails into structured task data, and automatically creates tasks in Asana — with smart assignment, deduplication, and a queue-based architecture for reliability.

## How It Works

```
Gmail Inbox (IMAP)
      │  poll every 30s
      ▼
Poller (imapflow + mailparser)
      │  enqueue job
      ▼
BullMQ Job Queue (Redis)
      │  dequeue job
      ▼
Worker
  ├── Deduplication Check    → Redis (Message-ID / fallback hash)
  ├── HTML Sanitization      → sanitize-html
  ├── Gemini AI              → structured task JSON
  ├── Zod Validation         → schema enforcement
  ├── Auto-Assignment        → team roster matching
  └── Asana API              → create task
      │
      ▼
Success: mark processed, log
Failure: retry (x3, exponential backoff)
```

Non-actionable emails (newsletters, receipts, notifications) are detected by Gemini and skipped automatically.

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Runtime | Node.js 20+ | Async I/O, large ecosystem |
| Language | TypeScript | Type safety |
| Email ingestion | imapflow + mailparser | Gmail IMAP polling and MIME parsing |
| Job queue | BullMQ + Redis | Retries, concurrency control, DLQ |
| AI parsing | Google Gemini (free tier) | Semantic email understanding |
| Task management | Asana REST API | Task creation with auto-assignment |
| Validation | Zod | Runtime schema validation for AI output |
| HTTP server | Fastify | Health endpoint + Bull Board UI |
| Logging | Pino | Structured JSON logs |
| Sanitization | sanitize-html | Strip HTML before AI processing |

## Project Structure

```
automation/
├── src/
│   ├── ai/
│   │   ├── geminiClient.ts      # Gemini SDK wrapper
│   │   └── prompts.ts           # Prompt templates (versioned)
│   ├── asana/
│   │   └── client.ts            # Asana task creation with auto-assignment
│   ├── config/
│   │   ├── index.ts             # Typed env var loader
│   │   ├── team.json            # Team roster for auto-assignment
│   │   └── team.ts              # Team matching logic
│   ├── dedup/
│   │   └── redis.ts             # Dedup via Redis (Message-ID or fallback hash)
│   ├── ingestion/
│   │   └── poller.ts            # Gmail IMAP poller
│   ├── parser/
│   │   ├── emailParser.ts       # Raw email → structured payload
│   │   └── sanitize.ts          # HTML stripping for email bodies
│   ├── queue/
│   │   ├── producer.ts          # Enqueue email jobs
│   │   └── worker.ts            # Process jobs through the full pipeline
│   ├── validator/
│   │   └── taskSchema.ts        # Zod schema for Gemini output
│   ├── logger.ts                # Shared Pino logger
│   └── server.ts                # Entry point (Fastify + poller + worker)
├── test/
│   └── emails/                  # 15 JSON fixtures for prompt testing
├── .env.example
├── docker-compose.yml           # Redis + app services
├── Dockerfile                   # Multi-stage production build
├── package.json
└── tsconfig.json
```

## Prerequisites

- **Node.js** 20 or later
- **Docker** (for Redis, or provide your own Redis instance)
- **Gmail account** with 2FA enabled and an App Password
- **Google AI Studio** API key (free tier)
- **Asana** personal access token and a project GID

## Setup

### 1. Clone and install

```bash
git clone <repo-url> automation
cd automation
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | Yes | From [Google AI Studio](https://aistudio.google.com/apikey) |
| `ASANA_ACCESS_TOKEN` | Yes | From [Asana Developer Console](https://app.asana.com/0/developer-console) |
| `ASANA_PROJECT_ID` | Yes | GID of your Asana project (from the project URL) |
| `GMAIL_USER` | Yes | Your Gmail address |
| `GMAIL_APP_PASSWORD` | Yes | 16-char app password from [Google App Passwords](https://myaccount.google.com/apppasswords) |
| `REDIS_URL` | Yes | `redis://localhost:6379` for local Docker |
| `BULL_BOARD_PASS` | Yes | Password to protect the queue dashboard |
| `PORT` | No | HTTP server port (default: 3000) |
| `GMAIL_POLL_INTERVAL_MS` | No | Polling interval in ms (default: 30000) |
| `BULL_BOARD_USER` | No | Dashboard username (default: admin) |
| `ASANA_PROMPT_VERSION_FIELD_GID` | No | Asana custom field GID for prompt version tracking |

### 3. Gmail App Password

Your regular Gmail password won't work with IMAP. Generate an App Password:

1. Enable 2FA at https://myaccount.google.com/security
2. Go to https://myaccount.google.com/apppasswords
3. Create a password for "Mail"
4. Copy the 16-character code (no spaces) into `.env` as `GMAIL_APP_PASSWORD`

### 4. Start Redis

```bash
docker compose up -d redis
```

### 5. Run

```bash
npm start
```

Expected output:

```
[server] Starting email-to-asana automation...
[worker] Worker listening on queue: email-tasks
[poller] Connecting as you@gmail.com, polling every 30s...
[poller] Found 2 unseen email(s), processing...
[worker] Processing: "URGENT: Server migration needs approval"
[worker] Gemini extracted: "Approve server migration plan" (actionable=true)
[worker] Task created in Asana: https://app.asana.com/... (assigned to Alice Chen)
[worker] Processing: "Weekly Tech Digest"
[worker] Skipped: not actionable
[server] HTTP server listening on :3000
```

## Docker

Run the full stack (app + Redis) in containers:

```bash
docker compose up --build
```

Or build and run the app image standalone:

```bash
docker build -t email-to-asana .
docker run --env-file .env email-to-asana
```

## Endpoints

| Endpoint | Auth | Description |
|---|---|---|
| `GET /health` | None | Returns `{ status, redis, asana }` — checks Redis ping and Asana API |
| `GET /admin/queues` | Basic auth | Bull Board UI for inspecting the job queue |

## Auto-Assignment

The system can automatically assign tasks based on the email content. Gemini suggests a role (backend, frontend, devops, design) and expertise level (senior, junior), which is matched against your team roster in `src/config/team.json`:

```json
[
  { "name": "Alice Chen", "email": "alice@company.com", "role": "backend", "level": "senior" },
  { "name": "Bob Park", "email": "bob@company.com", "role": "frontend", "level": "junior" }
]
```

If no match is found or the file is empty, tasks are created unassigned.

## Scripts

| Command | Description |
|---|---|
| `npm start` | Start the full automation (poller + worker + HTTP server) |
| `npm run test-pipeline` | Run hardcoded emails through the pipeline (manual test) |
| `npm run test-prompt` | Batch-test all 15 email fixtures against Gemini |

## Rate Limits

| Service | Limit | Mitigation |
|---|---|---|
| Gemini (free tier) | 1,500 req/day, 15 req/min | BullMQ concurrency: 1, exponential backoff |
| Asana API | 150 req/min | Single-concurrency worker |

## Deployment

| Option | Cost | Notes |
|---|---|---|
| Railway | Free tier | Quick start, managed Redis available |
| Render | Free tier | Simple deploys |
| Fly.io | Free tier | Persistent Redis, more control |
| VPS (Hetzner/DigitalOcean) | ~$5/mo | Full control |

For managed Redis in production, [Upstash](https://upstash.com) offers a free tier (10,000 req/day).

## License

MIT

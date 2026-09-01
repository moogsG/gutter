# Architecture

Gutter is a Next.js 16 app router application with one SQLite database, local AI via Ollama, and tight macOS Calendar integration. Built for low latency, local-first operation, and zero dependencies on cloud services.

---

## Stack

```
Next.js 16 (App Router)    →  Framework
React 19                   →  UI
Tailwind CSS v4            →  Styling
shadcn/ui                  →  Components
SQLite + better-sqlite3    →  Storage (two DBs)
Redux Toolkit + RTK Query  →  State management
Ollama                     →  Local LLM (meeting prep, NL commands)
whisper.cpp                →  Local STT (voice capture)
LanceDB                    →  Vector search (semantic search)
Apple Calendar (accli)     →  Calendar sync (macOS only)
bun                        →  Runtime and package manager
```

---

## Data Layer

### SQLite Database

Gutter uses one SQLite database in WAL mode for concurrent read/write performance.

#### `gutter-journal.db`
- **Path:** `$DATABASE_PATH` (default: `./gutter-journal.db`)
- **Connection:** `lib/db.ts` → `getDb()`
- **Tables:** `journal_entries`, `task_comments`, `agent_credentials`, `collections`, `projects`, `future_log`, `meeting_prep`, and supporting feature tables
- **Features:** 
  - Ordered, transactional schema migrations (current version: 8)
  - Automatic daily backups to `./backups/` (last 7 retained)
  - `_meta` table for version tracking

**Schema details:** See [docs/DATABASE.md](docs/DATABASE.md)

---

## Application Flow

### High-Level Data Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Browser (React)                            │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐   │
│  │  Daily Log   │  │ Month View   │  │   OmniBar (Search)     │   │
│  │  EntryInput  │  │ Calendar Grid│  │   Full-text + Vector   │   │
│  └──────┬───────┘  └──────┬───────┘  └────────────┬───────────┘   │
│         │                  │                        │               │
│         └──────────────────┴────────────────────────┘               │
│                             │                                       │
│                    RTK Query (Redux)                                │
└─────────────────────────────┬───────────────────────────────────────┘
                              │ HTTP
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Next.js API Routes (/app/api)                    │
│  ┌────────────┐  ┌──────────────┐  ┌────────────┐  ┌────────────┐ │
│  │  /journal  │  │  /calendar   │  │ /meeting   │  │ /jira      │ │
│  │            │  │              │  │ -prep      │  │            │ │
│  └─────┬──────┘  └──────┬───────┘  └─────┬──────┘  └─────┬──────┘ │
└────────┼─────────────────┼────────────────┼───────────────┼────────┘
         │                 │                │               │
         ▼                 ▼                ▼               ▼
┌─────────────┐   ┌────────────────┐   ┌──────────┐   ┌──────────┐
│  SQLite DBs │   │ accli (macOS)  │   │  Ollama  │   │   Jira   │
│             │   │ Apple Calendar │   │  Local   │   │   API    │
│  gutter.db  │   │                │   │   LLM    │   │          │
│  journal.db │   └────────────────┘   └──────────┘   └──────────┘
└──────┬──────┘                              │
       │                                     │
       └─────────────────┬───────────────────┘
                         ▼
                  ┌──────────────┐
                  │   LanceDB    │
                  │   (Vector)   │
                  │   Embeddings │
                  └──────────────┘
```

---

## Request Flow Examples

### Task conversation

The `/kanban` page queries all active lifecycle statuses through RTK Query. Selecting a card opens a responsive detail drawer. Human comments authenticate with the signed session cookie; agents use a scoped bearer credential whose stable actor identity is derived server-side. Agent writes require an `Idempotency-Key`, and comments are append-only. Status moves update `journal_entries` optimistically and roll back in the client if the API rejects the mutation.

Comments retain `actor_type`, `actor_id`, optional `source_ref`, and creation time. The schema prevents duplicate agent delivery with a unique actor/key pair and cascades comments only when their parent task is permanently deleted.

### 1. Natural Language Command

```
User: "buy milk tomorrow"
  │
  ▼
EntryInput → POST /api/journal/command { command: "buy milk tomorrow", context: { currentDate } }
  │
  ▼
lib/ollama → callOllama(SYSTEM_PROMPT, user_prompt)
  │          → Returns: { actions: [{ method: "POST", path: "/api/journal", body: {...} }], message: "..." }
  │
  ▼
executeAction → Insert into journal_entries (date=tomorrow, signifier=task, text="Buy milk")
  │
  ▼
lib/vector-store → upsertJournalEntry (fire-and-forget embedding)
  │
  ▼
Response: { ok: true, message: "Added task: Buy milk" }
```

### 2. Voice Capture → Transcription → Command

```
User clicks mic button
  │
  ▼
VoiceButton → MediaRecorder (browser) → records audio
  │
  ▼
FormData(audio) → POST /api/journal/transcribe
  │
  ▼
whisper-cpp (local) → transcribe audio to text
  │
  ▼
Response: { text: "schedule meeting with Thiago at 3pm tomorrow" }
  │
  ▼
EntryInput → POST /api/journal/command { command: text }
  │
  ▼
Ollama → creates journal entry + calendar event
```

### 3. Meeting Prep Generation

```
User clicks "Prepare" on upcoming meeting
  │
  ▼
POST /api/meeting-prep/prepare { eventId, title, time, calendar }
  │
  ▼
Upsert meeting_prep row with prep_status = 'preparing'
  │
  ▼
lib/ollama-prep → generateMeetingPrep(title, time, calendar)
  │                → Ollama with tool calling
  │                → Tools: searchJira(), searchSlack(), searchJournalEntries()
  │
  ▼
Ollama → calls tools → fetches Jira issues, Slack messages, journal notes
  │
  ▼
Ollama → generates structured prep notes (markdown)
  │
  ▼
Update meeting_prep set prep_notes = ..., prep_status = 'ready'
  │
  ▼
Client polls → sees prep_status='ready' → displays notes
```

### 4. Semantic Search

```
User types in OmniBar → "database migrations"
  │
  ▼
GET /api/journal/search?q=database+migrations (full-text search)
  │
  ▼
SQLite FTS → LIKE query → returns < 3 results
  │
  ▼
Fallback: GET /api/search/semantic?q=database+migrations&limit=5
  │
  ▼
lib/vector-store → searchJournalEntries(query, limit)
  │                → Embeds query with Ollama
  │                → LanceDB vector similarity search
  │
  ▼
Response: [{ id, text, date, signifier, _distance }]
```

---

## Core Libraries

### `lib/db.ts` — Primary Journal Database
- Exports `getDb()` for synchronous access to `gutter-journal.db`
- WAL mode and foreign keys enabled
- Schema versioning via `_meta` table
- Automatic daily backups via `triggerBackup()`
- Ordered, transactional migrations applied on startup

### `lib/jira.ts` — Jira Integration
- `fetchAssignedIssues(forceRefresh)` — fetches open Jira issues, caches for 5 minutes
- `createIssue(summary, description)` — creates Jira issue in first configured project
- `updateIssueStatus(issueKey, status)` — transitions issue status
- `getJiraStatus()` — returns integration config and cache status

### `lib/calendar.ts` — Apple Calendar Integration (macOS)
- `createCalendarEvent({ summary, date, startTime, endTime, allDay, calendar, location, description })`
- Uses `accli` CLI (npm package `@joargp/accli`)
- Retry logic with exponential backoff
- Graceful degradation if disabled

### `lib/ollama-prep.ts` — Meeting Prep with Tool Calling
- `generateMeetingPrep(title, time, calendar, context)` — calls Ollama with tool definitions
- Tools: `searchJira()`, `searchSlack()`, `searchJournalEntries()`
- Returns formatted markdown prep notes

### `lib/vector-store.ts` — LanceDB Vector Search
- `upsertJournalEntry({ id, text, date, signifier, collection_id })` — embeds and stores entry
- `searchJournalEntries(query, limit)` — semantic search over journal entries
- `upsertMeetingTranscript({ id, text, title, date })` — embeds and stores transcript
- Uses Ollama for embeddings (`nomic-embed-text` model)

### `lib/validation.ts` — Input Validation & Sanitization
- `validateJournalEntry({ content, tags })` — checks length, XSS, SQL injection
- `sanitizeText(text)` — removes dangerous HTML
- `validateId(id)` — prevents SQLi in ID parameters

### `lib/rate-limit.ts` — In-Memory Rate Limiting
- `rateLimitMiddleware(req, { windowMs, maxRequests })` — sliding window rate limiter
- Keyed by IP address
- Simple in-memory map (use Redis in production for multi-instance)

---

## Authentication

Single-user password auth via HTTP-only cookie.

**Flow:**
1. User enters password → `POST /api/auth`
2. Compare password hash with `AUTH_PASSWORD_HASH` env var (bcrypt)
3. Generate an expiring session token signed with `AUTH_SECRET`
4. Set `gutter-session` cookie (HTTP-only, SameSite=lax, 30-day expiry)
5. Middleware verifies the token signature and expiry on protected routes

**Logout:** `DELETE /api/auth` → deletes the browser cookie

**Security:**
- Rate limited (5 attempts/min)
- Bcrypt password hashing
- HMAC-SHA-256 signed tokens with cryptographically secure nonces
- HTTP-only cookies (no JS access)
- Failed login attempts logged to `security.log`

---

## AI Features

### Natural Language Commands
- Model: `JOURNAL_COMMAND_MODEL` (default: `qwen3:latest`)
- System prompt defines API endpoints, signifier rules, subtask support, calendar event creation
- Ollama responds with JSON: `{ actions: [...], message: "..." }`
- Actions executed sequentially against local DB (no HTTP round-trip)
- Supports `parent_ref` for subtask creation

### Meeting Prep with Tool Calling
- Model: `OLLAMA_MODEL` (default: `qwen3:latest`) — must support tool calling
- Tools: `searchJira()`, `searchSlack()`, `searchJournalEntries()`
- Ollama calls tools autonomously, gathers context, generates prep notes
- Prep notes stored in `meeting_prep.prep_notes` as markdown

### Voice Transcription
- Local STT via `whisper.cpp` (no cloud API)
- Audio: browser MediaRecorder → WebM → uploaded to `/api/journal/transcribe`
- Server: ffmpeg converts to 16kHz mono WAV → whisper-cpp transcribes
- Transcript sent to NL command interpreter

### Semantic Search
- Embeddings: Ollama `nomic-embed-text` model (384-dim)
- Vector DB: LanceDB (local, file-based)
- Fallback for OmniBar when full-text search returns < 3 results
- Top-K similarity search with cosine distance

---

## Environment Configuration

See [CONFIGURATION.md](CONFIGURATION.md) for full details.

**Critical vars:**
- `AUTH_PASSWORD_HASH` — bcrypt hash of login password
- `OLLAMA_URL` — Ollama server (default: `http://localhost:11434`)
- `CALENDARS` — comma-separated Apple Calendar names
- `JIRA_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN`, `JIRA_PROJECTS` — Jira integration
- `SLACK_BOT_TOKEN`, `SLACK_CHANNELS` — Slack integration (pipe-delimited `ID|name` pairs)

---

## Deployment Considerations

**Single User:** Designed for single-user local-first operation. Multi-user support planned.

**Performance:**
- SQLite WAL mode → concurrent reads
- In-memory rate limiting → replace with Redis for multi-instance
- LanceDB → local file-based, fast for < 100k entries
- Calendar cache → 5min TTL, avoids hammering accli

**Security:**
- HTTPS recommended in production (set `secure: true` on cookies)
- Rate limiting on all endpoints
- Input validation and sanitization
- SQL injection protection via parameterized queries
- XSS prevention via sanitizeText()

**Backups:**
- Journal DB auto-backups daily to `./backups/` (last 7 retained)
- Manual trigger: `triggerBackup()` from `lib/db.ts`
- Snapshots use SQLite `VACUUM INTO`, so committed pages still in the WAL are included; raw file copying is not used

**Monitoring:**
- Failed auth attempts → `security.log`
- LLM errors → console (add structured logging in production)
- Calendar errors → cached and reported in `/api/journal/calendar` status

---

## Future Architecture

Planned improvements:


- **Graph database** → Neo4j, Memgraph, or SQLite + vector for entity relationships
- **RAG with long-term context** → Embed all history, query across transcripts/notes/docs
- **LLM router** → Swap Ollama/OpenAI/Claude/Gemini via env config
- **Multi-user support** → User table, per-user journals, shared collections/projects
- **Projects** → Richer than collections, tie together transcripts/prep/tasks by initiative
- **Automated project linking** → AI tags entries to projects based on content
- **Native Meetly support** → Auto start/stop transcription when meetings begin/end

---

For database schema details, see [docs/DATABASE.md](docs/DATABASE.md).  
For API route documentation, see [API.md](API.md).  
For contribution guidelines, see [CONTRIBUTING.md](CONTRIBUTING.md).

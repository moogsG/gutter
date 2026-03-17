# Changelog

All notable changes to Gutter will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.1.0] - 2026-03-17

### Initial Release

First public release of Gutter — AI-native bullet journal for ADHD brains.

---

### ✨ Features

#### Bullet Journal System
- **Daily Log** — Sequential entries with signifier-based tagging (task, appointment, note, memory, important)
- **Monthly Calendar** — Color-coded grid synced from Apple Calendar
- **Day Detail View** — Events, entries, and meeting prep in unified interface
- **Future Log** — Plan entries for upcoming months without cluttering today
- **Collections** — Topic-specific pages (Books, Goals, Recipes, custom topics)
- **Migration Flow** — End-of-month review to mark done, carry forward, or drop tasks

#### AI-Powered Features (Local-First)
- **Natural Language Commands** — Parse human input into structured actions (e.g., "buy milk tomorrow" → task entry)
- **Meeting Prep** — AI-generated prep notes using Ollama, pulling context from Jira, Slack, and journal history
- **Transcript Upload** — Paste meeting transcripts, get AI summaries and action items
- **Semantic Search** — Vector embeddings for contextual search (powered by LanceDB)
- **Voice Capture** — Local transcription via whisper.cpp, no cloud APIs

#### Integrations
- **Apple Calendar** — Read and create events via accli (macOS only)
- **Jira** — Multi-project support, pull open tickets, create issues, update status
- **Slack** — Read channel history for meeting prep context (optional)
- **Ollama** — Local LLM for all AI features (meeting prep, NL commands)
- **Whisper** — Local speech-to-text (no cloud dependencies)

#### Developer Experience
- **Next.js 16** — React 19, App Router, Server Components
- **Bun Runtime** — Fast installs, native TypeScript, built-in test runner
- **Two SQLite Databases** — `gutter.db` (app data) + `gutter-journal.db` (journal with automatic backups)
- **RTK Query** — Centralized state management, automatic caching, optimistic updates
- **Tailwind CSS v4** — Theme-first styling with cyberpink, tokyo-night, and rose-pine themes
- **shadcn/ui** — Beautiful, accessible components

#### Additional Features
- **OmniBar** — Full-text search across all entries (always accessible via `Cmd+K`)
- **Subtasks** — Parent-child entry relationships (e.g., "Buy groceries: milk, eggs, bread")
- **PWA** — Installable, works offline
- **Authentication** — Single-user, bcrypt password hashing, HTTP-only cookies, 30-day sessions
- **Automatic Backups** — Daily backups of journal database (7-day retention)
- **Kanban View** — Task board with status columns (todo, in-progress, blocked, done)

---

### 🗄️ Database

- **Schema Version 2** — Includes subtask support (`parent_id` column)
- **WAL Mode** — Write-Ahead Logging for concurrent reads/writes
- **Daily Backups** — Automatic backups on first connection each day
- **Two Databases**:
  - `gutter.db` — App data (ideas, notes, calendar events, chat messages, meeting prep)
  - `gutter-journal.db` — Journal entries, collections, future log (versioned schema, automatic migrations)

**Tables:**
- `journal_entries` — Core bullet journal entries
- `collections` — Topic-specific pages
- `future_log` — Entries scheduled for future months
- `meeting_prep` — Meeting preparation notes, transcripts, summaries
- `projects` — Project definitions (for tagging)
- `ideas` — Quick-capture ideas bucket
- `notes` — Timestamped notes
- `calendar_events` — Cached calendar events
- `chat_messages` — Chat/AI conversation history
- `_meta` — Schema versioning and backup tracking

---

### 🔌 API Routes

**26 API endpoints** organized by feature area:

#### Authentication
- `POST /api/auth` — Login
- `DELETE /api/auth` — Logout

#### Journal Entries
- `GET /api/journal` — Fetch entries for date
- `POST /api/journal` — Create entry
- `PATCH /api/journal/[id]` — Update entry
- `DELETE /api/journal/[id]` — Delete entry
- `GET /api/journal/search` — Full-text search
- `GET /api/journal/unresolved` — Open tasks for migration
- `POST /api/journal/migrate` — Migrate entries to new date
- `POST /api/journal/transcribe` — Voice transcription
- `POST /api/journal/command` — Natural language command interpreter
- `POST /api/journal/calendar` — Create calendar event
- `GET /api/journal/calendar` — Calendar integration status

#### Tasks
- `GET /api/tasks` — Fetch tasks with filtering
- `POST /api/tasks` — Update task status

#### Collections
- `GET /api/collections` — List collections
- `POST /api/collections` — Create collection

#### Future Log
- `GET /api/future-log` — Fetch future log entries
- `POST /api/future-log` — Create future log entry

#### Daily Log
- `GET /api/daily-log` — Fetch today's activity log
- `POST /api/daily-log` — Add note to today's log

#### Search
- `GET /api/search/semantic` — Semantic search via vector embeddings

#### Meeting Prep
- `GET /api/meeting-prep` — List upcoming meetings
- `POST /api/meeting-prep/prepare` — Request AI prep
- `POST /api/meeting-prep/transcript` — Upload transcript
- `POST /api/meeting-prep/update` — Update prep data

#### Calendar
- `GET /api/calendar` — Fetch calendar events
- `GET /api/calendar/events` — Fetch events with caching

#### Context
- `GET /api/context/meeting` — RAG search for meeting context

#### Jira Integration
- `GET /api/integrations/jira/status` — Integration status
- `GET /api/integrations/jira/issues` — Fetch assigned issues
- `POST /api/integrations/jira/create` — Create Jira issue
- `POST /api/integrations/jira/sync` — Update issue status

#### Projects
- `GET /api/projects` — Project statistics

---

### 🎨 Themes

Three built-in themes:
- **Cyberpink** — Neon pink/cyan on deep dark background
- **Tokyo Night** — Deep blues and purples
- **Rose Pine** — Muted rose gold and earth tones

User-switchable in UI. Default set via `DEFAULT_THEME` env variable.

---

### 📦 Tech Stack

| Component | Technology |
|-----------|------------|
| Framework | Next.js 16 + React 19 |
| Runtime | Bun |
| Styling | Tailwind CSS v4 |
| Components | shadcn/ui |
| State | Redux Toolkit + RTK Query |
| Database | SQLite + better-sqlite3 |
| Vector Search | LanceDB |
| Local LLM | Ollama |
| Speech-to-Text | whisper.cpp |
| Calendar | Apple Calendar (accli) |
| Test Runner | bun:test |

---

### 🔒 Security

- **Bcrypt Password Hashing** — 10 rounds, salted
- **HTTP-Only Cookies** — Session tokens not accessible via JavaScript
- **30-Day Session Expiration** — Configurable via `SESSION_MAX_AGE_DAYS`
- **Single-User Auth** — No multi-user complexity (for now)
- **No Cloud APIs** — All AI/transcription runs locally (privacy-first)

---

### 📚 Documentation

- **README.md** — Overview, quick start, features
- **INSTALLATION.md** — Step-by-step setup for macOS and Linux
- **CONFIGURATION.md** — All environment variables documented
- **FAQ.md** — Common issues and solutions
- **ARCHITECTURE.md** — System design, data flow
- **API.md** — Complete API reference (26 routes)
- **CONTRIBUTING.md** — Contribution guidelines
- **CODING-STANDARDS.md** — Code style and patterns
- **TESTING.md** — Test strategy and commands
- **docs/DATABASE.md** — Database schema reference
- **docs/JIRA-SETUP.md** — Jira integration guide
- **docs/SLACK-SETUP.md** — Slack integration guide
- **docs/CALENDAR-SETUP.md** — Calendar integration guide (macOS)
- **docs/OLLAMA-SETUP.md** — Ollama setup and model recommendations
- **docs/WHISPER-SETUP.md** — Voice transcription setup

---

### 🐛 Known Issues

- **Calendar integration is macOS-only** — Linux support requires alternative (Google Calendar roadmapped)
- **Jira multi-project sync can be slow** — 5-minute cache helps, but initial load takes time for large backlogs
- **PWA install requires HTTPS** — Works on `localhost` in dev, but needs HTTPS in production
- **Ollama models require significant RAM** — 7B models need ~8GB RAM (quantized models work on 4GB)
- **Semantic search degrades gracefully** — If LanceDB fails, falls back to full-text search

---

### 🚀 Roadmap

See [README.md](README.md#roadmap) for full roadmap.

**Highlights:**
- Multi-user support with role-based access
- RAG-powered meeting prep with long-term context
- Native Meetly integration for auto-transcription
- Projects (richer than collections, with kanban and LLM queries)
- LLM router (swap between Ollama, OpenAI, Claude, Gemini)
- Google Calendar support (for non-macOS users)
- Weekly AI-generated review summaries
- Habit tracker with streak visualization
- Entry templates for standups and reviews

---

### 🙏 Credits

Built by **Moogs** with **Jynx** (OpenCode AI agent).

**Dependencies:**
- [Next.js](https://nextjs.org/) — React framework
- [Bun](https://bun.sh/) — JavaScript runtime
- [Ollama](https://ollama.com/) — Local LLM platform
- [whisper.cpp](https://github.com/ggerganov/whisper.cpp) — Local STT
- [accli](https://github.com/joargp/accli) — Apple Calendar CLI
- [shadcn/ui](https://ui.shadcn.com/) — Component library
- [Tailwind CSS](https://tailwindcss.com/) — Utility-first CSS
- [Redux Toolkit](https://redux-toolkit.js.org/) — State management
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) — SQLite bindings
- [LanceDB](https://lancedb.com/) — Vector database

**Inspiration:**
- [Bullet Journal Method](https://bulletjournal.com/) by Ryder Carroll
- ADHD productivity research
- Personal frustration with context switching

---

### 📝 License

MIT

---

## [Unreleased]

Nothing yet. See [roadmap](README.md#roadmap) for planned features.

---

<!-- Template for future releases

## [X.Y.Z] - YYYY-MM-DD

### Added
- New features

### Changed
- Changes to existing functionality

### Deprecated
- Soon-to-be removed features

### Removed
- Removed features

### Fixed
- Bug fixes

### Security
- Security fixes

-->

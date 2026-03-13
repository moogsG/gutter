<div align="center">

```
╔══════════════════════════════════════════════╗
║                                              ║
║   ░██████╗░██╗░░░██╗████████╗████████╗███████╗██████╗  ║
║   ██╔════╝░██║░░░██║╚══██╔══╝╚══██╔══╝██╔════╝██╔══██╗ ║
║   ██║░░██╗░██║░░░██║░░░██║░░░░░░██║░░░█████╗░░██████╔╝ ║
║   ██║░░╚██╗██║░░░██║░░░██║░░░░░░██║░░░██╔══╝░░██╔══██╗ ║
║   ╚██████╔╝╚██████╔╝░░░██║░░░░░░██║░░░███████╗██║░░██║ ║
║   ░╚═════╝░░╚═════╝░░░░╚═╝░░░░░░╚═╝░░░╚══════╝╚═╝░░╚═╝ ║
║                                              ║
╚══════════════════════════════════════════════╝
```

<img src="public/logo.png" alt="Gutter" width="280" />

**AI-native bullet journal for ADHD brains.**

*Sequential logging · Jira triage · AI meeting prep · Voice capture*
*Local-first · Privacy-first · Zero context switching*

---

![Next.js](https://img.shields.io/badge/Next.js_16-black?style=flat-square&logo=next.js)
![Bun](https://img.shields.io/badge/bun-black?style=flat-square&logo=bun)
![SQLite](https://img.shields.io/badge/SQLite-black?style=flat-square&logo=sqlite&logoColor=0f80cc)
![Ollama](https://img.shields.io/badge/Ollama-black?style=flat-square)
![Tailwind](https://img.shields.io/badge/Tailwind_v4-black?style=flat-square&logo=tailwindcss&logoColor=38bdf8)
![License](https://img.shields.io/badge/MIT-black?style=flat-square)

</div>

---

## what is this

Gutter is a personal productivity system built around the [Bullet Journal method](https://bulletjournal.com/) — wired up with the stuff that actually matters: AI that runs locally, Jira integration so you don't lose your flow, voice transcription, natural language commands, and meeting prep that does the research for you.

It's not a note-taking app. It's not a task manager. It's the place you dump everything — tasks, thoughts, appointments, blockers — and let the system help you make sense of it.

Designed specifically for the way ADHD brains actually work. Low friction capture, external scaffolding, zero context switching.

---

## quick start

```bash
git clone <repo-url>
cd gutter
bun install
cp .env.example .env
bun run dev
# → http://localhost:3000
```

---

## features

### ▸ bullet journal

The full BUJO system as a web app.

| Signifier | Meaning |
|-----------|---------|
| `•` | Task |
| `○` | Appointment |
| `-` | Note |
| `~` | Memory |
| `*` | Important |

- **Daily Log** — Sequential entries, signifier-tagged, timestamped
- **Monthly Calendar** — Color-coded grid synced from Apple Calendar
- **Day Detail** — Events, entries, and meeting prep in one view
- **Future Log** — Plan entries for upcoming months without cluttering today
- **Collections** — Topic-specific pages: Books, Goals, Recipes, whatever
- **Migration** — End-of-month review. Mark done, carry forward, or drop

---

### ▸ AI — all local, via Ollama

No cloud APIs. No data leaving your machine.

- **Natural Language Commands** — Type like a human. The system figures it out.
- **Meeting Prep** — One click. Ollama searches your Jira tickets, Slack channels, and local notes, then generates formatted prep notes with context and talking points.
- **Transcript Upload** — Paste a meeting transcript, get a summary and action items back
- **AI Triage** — Surface what matters in your Jira backlog without reading 47 tickets

```bash
# Get Ollama running with a tool-calling model
ollama pull qwen3
```

---

### ▸ natural language commands

| You type | What happens |
|----------|-------------|
| `buy milk tomorrow` | Task entry for tomorrow |
| `meeting at 3pm with Ryan` | Journal appointment + Apple Calendar event |
| `create a Books collection` | New Collections page |
| `migrate tasks from yesterday` | Pulls open tasks into today |
| `done with GDEV-123` | Marks Jira ticket complete |
| `standup 9am daily` | Recurring appointment |

---

### ▸ jira

- Multi-project support — `JIRA_PROJECTS=GDEV,ISE`
- Pull open tickets into your daily context
- Create issues directly from journal entries
- Update issue status without leaving the app
- 5-minute in-memory cache so you're not hammering the API

---

### ▸ voice

- Hit the mic, speak your entry
- Local transcription via whisper.cpp — no Whisper API, no cloud
- Voice input runs through the same NL command interpreter

```bash
brew install whisper-cpp ffmpeg
mkdir -p ~/.cache/whisper
curl -L https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin \
  -o ~/.cache/whisper/ggml-base.en.bin
```

---

### ▸ calendar

- Reads from Apple Calendar (any calendars you specify)
- Color-coded monthly grid
- Natural language commands create real Apple Calendar events
- Day view shows events alongside journal entries

```bash
npm install -g @joargp/accli
npx @joargp/accli calendars list
```

---

### ▸ everything else

- **OmniBar** — Full-text search across all entries. Always accessible.
- **Subtasks** — "Buy groceries: milk, eggs, bread" creates parent + children
- **PWA** — Installable, works offline
- **Auth** — Single-user, password-protected, HTTP-only cookie, 30-day session
- **Themes** — Cyberpink · Tokyo Night · Rose Pine
- **Two DBs** — `gutter.db` for app data, `gutter-journal.db` for journal (easy to back up separately)

---

## configuration

```bash
cp .env.example .env
```

### auth

| Variable | Description |
|----------|-------------|
| `AUTH_PASSWORD` | Login password (leave empty to disable) |
| `AUTH_SECRET` | Secret for session tokens |

### calendars

| Variable | Description | Example |
|----------|-------------|---------|
| `CALENDARS` | Apple Calendar names, comma-separated | `Calendar,Family Calendar,Home` |

### ollama

| Variable | Default | Description |
|----------|---------|-------------|
| `OLLAMA_URL` | `http://localhost:11434` | Ollama server |
| `OLLAMA_MODEL` | `qwen3:latest` | Model for meeting prep (needs tool calling) |
| `JOURNAL_COMMAND_MODEL` | `qwen3:latest` | Model for NL commands |

### jira

| Variable | Description |
|----------|-------------|
| `JIRA_URL` | Instance URL e.g. `https://company.atlassian.net` |
| `JIRA_EMAIL` | Your Jira email |
| `JIRA_API_TOKEN` | API token from Atlassian account settings |
| `JIRA_PROJECTS` | Comma-separated project keys e.g. `GDEV,ISE` |

### slack (optional, for meeting prep context)

| Variable | Description |
|----------|-------------|
| `SLACK_BOT_TOKEN` | Bot token `xoxb-...` |
| `SLACK_CHANNELS` | Pipe-delimited `CHANNEL_ID\|name` pairs |

### misc

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `DATABASE_PATH` | `./gutter-journal.db` | SQLite path |
| `DEFAULT_THEME` | `cyberpink` | Starting theme |
| `SESSION_MAX_AGE_DAYS` | `30` | Auth session duration |
| `WHISPER_MODEL_PATH` | `~/.cache/whisper/ggml-base.en.bin` | Whisper model |
| `CALENDAR_ENABLED` | `true` | Enable Apple Calendar sync |

---

## routes

| Route | Description |
|-------|-------------|
| `/` | Daily log |
| `/month` | Monthly calendar grid |
| `/day/YYYY-MM-DD` | Day detail — events + entries + meeting prep |
| `/future` | Future log |
| `/collections` | Collections list |
| `/collections/:id` | Collection detail |
| `/migrate` | Migration review |
| `/login` | Auth |

## api

| Route | Method | Description |
|-------|--------|-------------|
| `/api/auth` | POST/DELETE | Login / logout |
| `/api/journal` | GET/POST | List / create entries |
| `/api/journal/:id` | PATCH/DELETE | Update / delete entry |
| `/api/journal/search` | GET | Full-text search `?q=` |
| `/api/journal/command` | POST | NL command interpreter |
| `/api/journal/unresolved` | GET | Open tasks for migration |
| `/api/journal/migrate` | POST | Migrate entries to new date |
| `/api/journal/transcribe` | POST | Voice transcription |
| `/api/journal/calendar` | GET | Entries with calendar context |
| `/api/calendar` | GET | Upcoming events |
| `/api/calendar/events` | GET | Events for monthly grid |
| `/api/meeting-prep` | GET | All meetings with prep data |
| `/api/meeting-prep/prepare` | POST | Trigger AI prep |
| `/api/meeting-prep/transcript` | POST | Upload + process transcript |
| `/api/meeting-prep/update` | POST | Update prep from external source |
| `/api/collections` | GET/POST | List / create collections |
| `/api/future-log` | GET/POST | Future log entries |
| `/api/integrations/jira/issues` | GET | Fetch Jira issues |
| `/api/integrations/jira/create` | POST | Create Jira issue |
| `/api/integrations/jira/sync` | POST | Force sync Jira cache |
| `/api/integrations/jira/status` | GET | Integration status |

---

## stack

```
Next.js 16 + React 19   →  framework
Tailwind CSS v4          →  styling
shadcn/ui                →  components
SQLite + better-sqlite3  →  storage (two DBs)
Redux Toolkit + RTK Query →  state
Ollama                   →  local LLM (meeting prep, NL commands)
whisper.cpp              →  local STT (voice capture)
Apple Calendar / accli   →  calendar sync
bun                      →  runtime
```

---

## project structure

```
gutter/
├── app/
│   ├── page.tsx              # daily log
│   ├── month/page.tsx        # monthly calendar
│   ├── day/[date]/page.tsx   # day detail
│   ├── future/page.tsx       # future log
│   ├── collections/          # collections
│   ├── migrate/page.tsx      # migration review
│   └── api/                  # all api routes
├── components/
│   ├── journal/              # EntryInput, EntryList, OmniBar, VoiceButton, etc.
│   ├── meeting/              # MeetingDrawer
│   └── ui/                   # shadcn components
├── lib/
│   ├── db.ts                 # main db (gutter.db)
│   ├── journal-db.ts         # journal db (gutter-journal.db)
│   ├── jira.ts               # jira integration + cache
│   ├── ollama-prep.ts        # meeting prep with tool calling
│   ├── calendar.ts           # calendar event creation
│   └── env.ts                # env validation
└── store/api/                # RTK Query slices
```

---

## roadmap

```
[ ] = planned   [~] = in progress   [x] = done
```

### integrations

| Status | Feature |
|--------|---------|
| `[x]` | Jira — issues, create, sync, status |
| `[x]` | Apple Calendar — read + create events |
| `[x]` | Slack — channels for meeting prep context |
| `[ ]` | ClickUp — tasks, spaces, lists alongside Jira |
| `[ ]` | Google Workspace CLI — Drive, Docs, Meet, Calendar via Google CLI |
| `[ ]` | Email — read inbox, surface urgent messages, log replies as journal entries |
| `[ ]` | Google Calendar — for non-macOS or alongside Apple Calendar |
| `[ ]` | Outlook / Microsoft 365 — calendar + email in one |
| `[ ]` | iMessage / SMS — log conversations as entries, reply from journal |
| `[ ]` | Linear — issue tracking alternative |
| `[ ]` | GitHub Issues — surface PRs and issues in meeting prep |

### meetings

| Status | Feature |
|--------|---------|
| `[x]` | Manual transcript upload + AI summary |
| `[x]` | AI meeting prep with Jira + Slack context |
| `[ ]` | **Native Meetly support** — auto start/stop transcription when a meeting begins and ends. No more manual paste. |
| `[ ]` | Transcript auto-linked to project/collection |
| `[ ]` | Action items extracted and added as tasks automatically |

### projects

| Status | Feature |
|--------|---------|
| `[x]` | Collections — topic-specific pages |
| `[ ]` | **Projects** — like collections but richer. Ties together transcripts, prep notes, tasks, and entries by feature or initiative. Queryable by LLM ("what have we discussed about auth in the last month?") |
| `[ ]` | Automated project linking — entries and transcripts auto-tagged to the right project based on content |
| `[ ]` | Project kanban — visual task board per project with status columns |
| `[ ]` | Global kanban — all tasks across all projects in one board |

### AI

| Status | Feature |
|--------|---------|
| `[x]` | Ollama (local LLM) — meeting prep + NL commands |
| `[x]` | whisper.cpp (local STT) — voice capture |
| `[ ]` | **RAG** — embed journal history, transcripts, notes, and docs. Meeting prep with real long-term context, not just what's in Jira right now. Needs proper graph DB investigation. |
| `[ ]` | **Graph database** — store entities, relationships, and context as a knowledge graph (investigating: Neo4j, Memgraph, LanceDB, or SQLite + vector). Unlocks semantic querying across everything. |
| `[ ]` | **LLM router** — swap between Ollama, OpenAI, Claude, Gemini via env config. If you already have an OpenCode, OpenClaw, or Claude Code subscription, use those credits instead of paying twice. |
| `[ ]` | **Assign task to LLM** — flag any entry and delegate it to a connected AI agent. "Do this" sends it to Claude Code, OpenCode, or a local Ollama agent. |
| `[ ]` | **Local agent integration** — first-class support for Claude Code, OpenCode, and OpenClaw. Tasks flow in, results flow back as journal entries. |
| `[ ]` | Embeddings — semantic search across entries, not just FTS keyword matching |
| `[ ]` | Auto-tagging — AI assigns signifiers, tags, and project links on capture |
| `[ ]` | Weekly review — AI-generated summary: what got done, open loops, patterns |

### journal

| Status | Feature |
|--------|---------|
| `[x]` | Daily, Monthly, Future log |
| `[x]` | Collections |
| `[x]` | Migration flow |
| `[x]` | Natural language commands |
| `[ ]` | **Better migration** — smarter handling of unfinished tasks. Aging, context-aware migration suggestions, auto-carry vs auto-drop rules. |
| `[ ]` | Habit tracker — daily check-ins with streak visualization |
| `[ ]` | Recurring tasks — "every Monday" without manual entry |
| `[ ]` | Entry templates — pre-fill daily standups, weekly reviews |
| `[ ]` | Export — markdown, PDF, plain text |

### multi-user

| Status | Feature |
|--------|---------|
| `[x]` | Single-user auth |
| `[ ]` | **Multi-user support** — invite teammates, shared collections/projects, per-user journal with shared task visibility. Role-based access (owner, member, viewer). |
| `[ ]` | Shared kanban — team task board with assignees |
| `[ ]` | @mentions in entries — notify teammates |

### UX / UI

| Status | Feature |
|--------|---------|
| `[x]` | Cyberpink · Tokyo Night · Rose Pine themes |
| `[ ]` | **UX overhaul** — modernize the layout. Better hierarchy, improved mobile experience, smoother interactions. The bones are good, the polish needs work. |
| `[ ]` | Keyboard-first navigation throughout |
| `[ ]` | Command palette improvements — more actions, fuzzy match |
| `[ ]` | Drag-and-drop entry reordering |

---

## scripts

```bash
bun run dev       # dev server
bun run build     # production build
bun run start     # production server
bun run test      # run tests
```

---

<div align="center">

```
╔══════════════════════════╗
║  local-first. always.   ║
╚══════════════════════════╝
```

MIT

</div>

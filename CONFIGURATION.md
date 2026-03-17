# Configuration

Complete reference for all environment variables in Gutter.

Copy `.env.example` to `.env` and customize as needed.

---

## Server

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP server port |
| `HOST` | `localhost` | Bind address |

**Example:**
```env
PORT=8080
HOST=0.0.0.0
```

---

## Authentication

| Variable | Required | Description |
|----------|----------|-------------|
| `AUTH_PASSWORD_HASH` | No | Bcrypt hash of login password. Leave empty to disable auth. |
| `AUTH_SECRET` | **Yes** | Secret key for session tokens (random string, 32+ chars recommended) |
| `SESSION_MAX_AGE_DAYS` | `30` | Session cookie expiration in days |

**Generate password hash:**
```bash
# Using Node.js
node -e "console.log(require('bcryptjs').hashSync('your-password', 10))"

# Using bun
bun -e "import bcrypt from 'bcryptjs'; console.log(bcrypt.hashSync('your-password', 10))"
```

**Example:**
```env
AUTH_PASSWORD_HASH=$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy
AUTH_SECRET=your-random-secret-key-here-make-it-long
SESSION_MAX_AGE_DAYS=30
```

**Security notes:**
- `AUTH_SECRET` should be unique per installation
- Never commit `.env` to version control
- Rotate `AUTH_SECRET` if compromised (invalidates all sessions)
- Auth is single-user only (multi-user support roadmapped)

---

## Database

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_PATH` | `./gutter-journal.db` | Path to journal SQLite database |
| `JOURNAL_BACKUP_DIR` | `./backups` | Directory for automatic daily backups |

**Example:**
```env
DATABASE_PATH=/var/lib/gutter/journal.db
JOURNAL_BACKUP_DIR=/var/lib/gutter/backups
```

**Backup behavior:**
- Automatic daily backup on first connection
- Retention: last 7 days
- Manual trigger: call `triggerBackup()` in `lib/journal-db.ts`

---

## Theme

| Variable | Default | Description |
|----------|---------|-------------|
| `DEFAULT_THEME` | `cyberpink` | Starting theme |

**Available themes:**
- `cyberpink` — Neon pink/cyan on dark background
- `tokyo-night` — Deep blues and purples
- `rose-pine` — Muted rose gold and earth tones

**Example:**
```env
DEFAULT_THEME=tokyo-night
```

Users can switch themes in the UI. This only sets the default for new sessions.

---

## Ollama (AI Features)

| Variable | Default | Description |
|----------|---------|-------------|
| `OLLAMA_URL` | `http://localhost:11434` | Ollama server endpoint |
| `OLLAMA_MODEL` | `qwen3:latest` | Model for meeting prep (needs tool calling support) |
| `JOURNAL_COMMAND_MODEL` | `qwen3:latest` | Model for natural language command interpreter |

**Recommended models:**
- `qwen3:latest` — Best overall (7B, fast, good tool calling)
- `qwen2.5-coder:7b` — Alternative for coding-focused tasks
- `llama3.2:latest` — Fallback if qwen3 unavailable

**Example:**
```env
OLLAMA_URL=http://192.168.1.100:11434
OLLAMA_MODEL=qwen3:latest
JOURNAL_COMMAND_MODEL=qwen3:latest
```

**Notes:**
- Ollama must be running (`ollama serve`) before starting Gutter
- Pull models first: `ollama pull qwen3:latest`
- Tool calling is required for meeting prep and command interpreter
- If models unavailable, AI features gracefully degrade

**Hardware requirements:**
- 7B models: 8GB+ RAM recommended
- Quantized models (e.g., `qwen3:7b-q4_0`) work on 4GB RAM

---

## Apple Calendar Integration (macOS only)

| Variable | Default | Description |
|----------|---------|-------------|
| `CALENDARS` | `Calendar` | Comma-separated list of calendar names to sync |
| `ACCLI_CMD` | `accli` | Path to accli binary (auto-detected if in PATH) |
| `CALENDAR_ENABLED` | `true` | Enable/disable calendar integration |

**Example:**
```env
CALENDARS=Calendar,Family Calendar,Work,Home
ACCLI_CMD=/usr/local/bin/accli
CALENDAR_ENABLED=true
```

**Setup:**
1. Install accli: `npm install -g @joargp/accli`
2. Grant Calendar permissions: `npx @joargp/accli calendars list`
3. List your calendars: `npx @joargp/accli calendars list`
4. Add calendar names to `CALENDARS` (exact match, case-sensitive)

**Linux users:**
Set `CALENDAR_ENABLED=false` (Apple Calendar is macOS-only).

---

## Jira Integration

| Variable | Required | Description |
|----------|----------|-------------|
| `JIRA_URL` | No | Jira instance URL (e.g., `https://company.atlassian.net`) |
| `JIRA_EMAIL` | No | Your Jira email address |
| `JIRA_API_TOKEN` | No | Jira API token |
| `JIRA_PROJECTS` | No | Comma-separated project keys to track (e.g., `GDEV,ISE`) |

**Example:**
```env
JIRA_URL=https://yourcompany.atlassian.net
JIRA_EMAIL=you@company.com
JIRA_API_TOKEN=ATATT3xFfGF0...
JIRA_PROJECTS=GDEV,ISE,PLATFORM
```

**Get API token:**
1. Go to https://id.atlassian.com/manage-profile/security/api-tokens
2. Click "Create API token"
3. Copy token and set `JIRA_API_TOKEN`

**Notes:**
- All 4 variables required for Jira integration to work
- If any are missing, Jira features are disabled (app still works)
- 5-minute in-memory cache to reduce API calls
- See [docs/JIRA-SETUP.md](docs/JIRA-SETUP.md) for details

---

## Slack Integration (optional)

| Variable | Required | Description |
|----------|----------|-------------|
| `SLACK_BOT_TOKEN` | No | Slack bot token (starts with `xoxb-`) |
| `SLACK_CHANNELS` | No | Pipe-delimited channel mappings: `CHANNEL_ID\|name,CHANNEL_ID\|name` |

**Example:**
```env
SLACK_BOT_TOKEN=xoxb-your-token-here
SLACK_CHANNELS=C029BN2FBPD|dev-chat,C027SHEDUET|senior-devs,C028XYZ|design
```

**Get bot token:**
1. Create Slack app at https://api.slack.com/apps
2. Add **Bot Token Scopes**: `channels:history`, `channels:read`, `chat:write`
3. Install app to workspace
4. Copy **Bot User OAuth Token** (starts with `xoxb-`)

**Get channel IDs:**
1. Open Slack in browser
2. Click channel name → "View channel details"
3. Scroll down → Channel ID is shown
4. Format: `CHANNEL_ID|human-readable-name`

**Notes:**
- Used for meeting prep context (AI searches Slack channels for relevant messages)
- If not configured, Slack features are skipped (meeting prep still works with Jira context)
- See [docs/SLACK-SETUP.md](docs/SLACK-SETUP.md) for details

---

## Whisper (Voice Transcription)

| Variable | Default | Description |
|----------|---------|-------------|
| `WHISPER_MODEL_PATH` | `~/.cache/whisper/ggml-base.en.bin` | Path to Whisper model file |

**Example:**
```env
WHISPER_MODEL_PATH=/Users/you/.cache/whisper/ggml-base.en.bin
```

**Setup:**
```bash
# Install whisper.cpp
brew install whisper-cpp  # macOS
# or compile from source on Linux

# Download model
mkdir -p ~/.cache/whisper
curl -L https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin \
  -o ~/.cache/whisper/ggml-base.en.bin
```

**Available models:**
- `ggml-tiny.en.bin` — Fastest, least accurate (~75MB)
- `ggml-base.en.bin` — **Recommended** — Good balance (~150MB)
- `ggml-small.en.bin` — More accurate, slower (~500MB)
- `ggml-medium.en.bin` — Best accuracy, slow (~1.5GB)

**Notes:**
- Requires `ffmpeg` for audio conversion
- If model path is invalid, voice transcription is disabled
- See [docs/WHISPER-SETUP.md](docs/WHISPER-SETUP.md) for details

---

## NODE_ENV

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `development` | Runtime environment mode |

**Valid values:**
- `development` — Dev mode with hot reloading, verbose logging
- `production` — Production mode with optimizations, minimal logging
- `test` — Testing mode (used by vitest)

**Example:**
```env
NODE_ENV=production
```

**Notes:**
- Set to `production` for deployed environments (VPS, Docker, etc.)
- Affects Next.js behavior, logging verbosity, and error display
- In production mode:
  - Errors show generic messages (no stack traces to users)
  - Static assets are optimized and cached
  - React runs in production mode (faster, smaller bundles)
- In development mode:
  - Detailed error messages and stack traces
  - Hot module reloading
  - Source maps enabled

---

## Example: Complete Configuration

```env
# Server
PORT=3000
HOST=localhost

# Auth
AUTH_PASSWORD_HASH=$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy
AUTH_SECRET=your-random-secret-key-here
SESSION_MAX_AGE_DAYS=30

# Database
DATABASE_PATH=./gutter-journal.db
JOURNAL_BACKUP_DIR=./backups

# Theme
DEFAULT_THEME=cyberpink

# Calendars (macOS only)
CALENDARS=Calendar,Family Calendar,Work,Home
ACCLI_CMD=accli
CALENDAR_ENABLED=true

# Ollama
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=qwen3:latest
JOURNAL_COMMAND_MODEL=qwen3:latest

# Jira
JIRA_URL=https://yourcompany.atlassian.net
JIRA_EMAIL=you@company.com
JIRA_API_TOKEN=ATATT3xFfGF0...
JIRA_PROJECTS=GDEV,ISE

# Slack (optional)
SLACK_BOT_TOKEN=xoxb-your-token-here
SLACK_CHANNELS=C029BN2FBPD|dev-chat,C027SHEDUET|senior-devs

# Whisper
WHISPER_MODEL_PATH=~/.cache/whisper/ggml-base.en.bin
```

---

## Environment-Specific Configs

### Development

```env
PORT=3000
HOST=localhost
DEFAULT_THEME=cyberpink
```

### Production

```env
PORT=80
HOST=0.0.0.0
SESSION_MAX_AGE_DAYS=7
DATABASE_PATH=/var/lib/gutter/journal.db
JOURNAL_BACKUP_DIR=/var/lib/gutter/backups
```

### Minimal (no integrations)

```env
AUTH_PASSWORD_HASH=your-hash
AUTH_SECRET=your-secret
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=qwen3:latest
JOURNAL_COMMAND_MODEL=qwen3:latest
CALENDAR_ENABLED=false
```

---

## Validation

Missing required variables will cause startup errors:

- `AUTH_SECRET` — **Required always**
- `OLLAMA_URL` — **Required for AI features**
- All Jira variables — Required together (all or none)

Check logs on startup for validation errors.

---

## Security Best Practices

1. **Never commit `.env`** — Already in `.gitignore`, but double-check
2. **Use strong `AUTH_SECRET`** — 32+ random characters
3. **Rotate secrets regularly** — Especially after team changes
4. **Use bcrypt for passwords** — Never store plaintext
5. **Restrict file permissions** — `chmod 600 .env` on production servers
6. **Separate dev/prod configs** — Different secrets for each environment

---

## Related Documentation

- [INSTALLATION.md](INSTALLATION.md) — Setup guide
- [FAQ.md](FAQ.md) — Troubleshooting
- [docs/JIRA-SETUP.md](docs/JIRA-SETUP.md) — Jira integration guide
- [docs/SLACK-SETUP.md](docs/SLACK-SETUP.md) — Slack integration guide
- [docs/OLLAMA-SETUP.md](docs/OLLAMA-SETUP.md) — Ollama setup guide
- [docs/CALENDAR-SETUP.md](docs/CALENDAR-SETUP.md) — Calendar integration guide
- [docs/WHISPER-SETUP.md](docs/WHISPER-SETUP.md) — Voice transcription guide

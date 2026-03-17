# Installation

Step-by-step setup guide for Gutter on macOS and Linux.

---

## Prerequisites

### Required

- **Bun** — JavaScript runtime (replaces Node.js)
  ```bash
  # macOS / Linux
  curl -fsSL https://bun.sh/install | bash
  ```

- **Ollama** — Local LLM for AI features
  ```bash
  # macOS
  brew install ollama
  
  # Linux
  curl -fsSL https://ollama.com/install.sh | sh
  ```

- **accli** — Apple Calendar CLI (macOS only)
  ```bash
  npm install -g @joargp/accli
  ```

### Optional (for voice transcription)

- **whisper.cpp** — Local speech-to-text
  ```bash
  # macOS
  brew install whisper-cpp
  
  # Linux
  git clone https://github.com/ggerganov/whisper.cpp
  cd whisper.cpp
  make
  sudo cp main /usr/local/bin/whisper
  ```

- **ffmpeg** — Audio conversion
  ```bash
  # macOS
  brew install ffmpeg
  
  # Linux (Ubuntu/Debian)
  sudo apt install ffmpeg
  ```

---

## Installation

### 1. Clone the repository

```bash
git clone <repo-url>
cd gutter
```

### 2. Install dependencies

```bash
bun install
```

### 3. Set up environment variables

```bash
cp .env.example .env
```

Edit `.env` with your configuration. See [CONFIGURATION.md](CONFIGURATION.md) for all options.

**Minimum required:**

```env
# Auth (generate bcrypt hash — see below)
AUTH_PASSWORD_HASH=your-bcrypt-hash-here
AUTH_SECRET=change-this-to-something-random

# Ollama
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=qwen3:latest
JOURNAL_COMMAND_MODEL=qwen3:latest

# Calendars (macOS only)
CALENDARS=Calendar,Family Calendar,Home
```

### 4. Generate password hash

Gutter uses bcrypt for password authentication. Generate a hash:

```bash
# Using Node.js
node -e "console.log(require('bcryptjs').hashSync('your-password-here', 10))"

# Or using bun
bun -e "import bcrypt from 'bcryptjs'; console.log(bcrypt.hashSync('your-password-here', 10))"
```

Copy the output and set `AUTH_PASSWORD_HASH` in `.env`.

### 5. Pull Ollama models

```bash
ollama pull qwen3:latest
```

**Recommended models:**
- `qwen3:latest` — Best for tool calling (meeting prep, NL commands)
- `qwen2.5-coder:7b` — Alternative for coding-focused tasks

### 6. Download Whisper model (optional)

```bash
mkdir -p ~/.cache/whisper
curl -L https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin \
  -o ~/.cache/whisper/ggml-base.en.bin
```

Set `WHISPER_MODEL_PATH=~/.cache/whisper/ggml-base.en.bin` in `.env`.

### 7. Grant Calendar permissions (macOS only)

```bash
npx @joargp/accli calendars list
```

This will prompt for Calendar access. Grant it in **System Settings → Privacy & Security → Calendars**.

---

## First Run

### Start Ollama

```bash
ollama serve
```

Leave this running in a separate terminal.

### Start Gutter

```bash
bun run dev
```

Visit **http://localhost:3000**

You'll be prompted to log in with the password you set in step 4.

---

## Production Deployment

### Build for production

```bash
bun run build
```

### Start production server

```bash
bun run start
```

Runs on `http://localhost:3000` (or `PORT` from `.env`).

---

## macOS vs Linux

### macOS

Fully supported. Calendar integration works out of the box via `accli`.

### Linux

Supported, but **calendar integration is disabled**. Apple Calendar is macOS-only. To use calendar features on Linux:

1. Set `CALENDAR_ENABLED=false` in `.env`
2. Consider alternative integrations (Google Calendar support is roadmapped)

All other features (journal, tasks, Jira, Slack, Ollama, Whisper) work identically.

---

## Troubleshooting

### Build fails with "module not found"

```bash
rm -rf node_modules bun.lockb
bun install
bun run build
```

### Ollama connection refused

```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# If not, start it
ollama serve
```

### Calendar permissions denied (macOS)

```bash
# Reset accli permissions
tccutil reset Calendar
npx @joargp/accli calendars list
```

Grant access when prompted.

### Whisper transcription fails

Check paths:
```bash
# Verify whisper binary exists
which whisper

# Verify model file exists
ls ~/.cache/whisper/ggml-base.en.bin

# Test manually
whisper -m ~/.cache/whisper/ggml-base.en.bin -f test.wav
```

---

## Next Steps

- [Configuration Guide](CONFIGURATION.md) — All environment variables explained
- [FAQ](FAQ.md) — Common issues and solutions
- [Integration Guides](docs/) — Set up Jira, Slack, Calendar, Ollama, Whisper

---

## Uninstall

```bash
cd gutter
rm -rf node_modules bun.lockb
rm gutter.db gutter-journal.db
rm -rf backups/
```

To remove Ollama models:
```bash
ollama rm qwen3:latest
```

To uninstall Ollama:
```bash
# macOS
brew uninstall ollama

# Linux
sudo rm /usr/local/bin/ollama
```

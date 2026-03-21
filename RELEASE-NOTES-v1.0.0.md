# Gutter v1.0.0 - Initial Public Release

**Release Date:** March 20, 2026

Gutter is a digital bullet journal designed specifically for people with ADHD. It combines the simplicity of paper bullet journaling with the power of modern integrations and local-first AI.

## Why Gutter?

Traditional productivity tools are built for neurotypical brains. They demand organization you don't have, create decision paralysis with endless features, and punish you for not being "disciplined enough."

Gutter is different. It's built on the bullet journal method — a system proven to work for ADHD brains — with carefully chosen integrations that reduce friction instead of adding it.

## Core Features

### Bullet Journal System
- **Daily Log** - Sequential journal entries with semantic signifiers (task, note, appointment, important, memory)
- **Monthly Calendar** - Apple Calendar integration for time-based commitments
- **Future Log** - Long-term planning and reference
- **Collections** - Organize related entries without complex hierarchy
- **Migration** - Move incomplete tasks forward (manually or automatically)
- **Search** - Full-text search across all entries

### Natural Language Interface
- **Voice Input** - Whisper.cpp integration for hands-free entry creation
- **Command Parsing** - "buy milk tomorrow" → task entry on tomorrow's date
- **Intelligent Signifiers** - Automatic detection based on entry content

### Work Integrations
- **Jira** - Multi-project support, bi-directional sync, create issues from entries
- **Slack** - Context-aware meeting prep (pull recent channel messages)
- **Confluence** - Documentation references (coming soon)

### AI-Powered Features
- **Meeting Prep** - Local LLM summarization of Slack context + calendar events
- **Semantic Search** - LanceDB vector store for finding related entries
- **Flexible LLM Backend** - Support for Ollama, OpenAI, Anthropic, Google Gemini

### Developer Experience
- **Next.js 16** - Modern React framework with App Router
- **RTK Query** - Type-safe API layer with optimistic updates
- **Tailwind CSS** - Utility-first styling
- **shadcn/ui** - Accessible component library
- **bun** - Fast package manager and runtime
- **Vitest** - 200+ tests with 100% pass rate

### Security & Privacy
- **Local-First** - All data stored locally (SQLite + LanceDB)
- **Rate Limiting** - All 26 API endpoints protected
- **Input Validation** - Comprehensive sanitization and validation
- **SQL Injection Protection** - Parameterized queries throughout
- **XSS Prevention** - HTML escaping and Content-Security-Policy headers

### Themes
- **Cyberpink** - High-contrast cyberpunk aesthetic
- **Tokyo Night** - Dark, cozy coding theme
- **Rosé Pine** - Warm, low-contrast minimalism

## Deployment Options

- **Docker Compose** - One-command setup with optional Ollama
- **VPS Deployment** - Ubuntu guide with nginx + SSL
- **Self-Hosted** - Bare metal with systemd service
- **Railway/Vercel** - Cloud deployment guides

## Documentation

- **README.md** - Quick start, feature overview, "Why Gutter?"
- **ARCHITECTURE.md** - System design, database schema, data flow
- **API.md** - Complete API reference (26 endpoints)
- **TESTING.md** - Test strategy and contribution guide
- **LLM-PROVIDERS.md** - LLM backend configuration
- **Deployment Guides** - Docker, VPS, Railway, Vercel, self-hosted

## Community

- **MIT License** - Free and open source
- **Code of Conduct** - Welcoming, inclusive community
- **Contributing Guide** - PR process, code style, testing requirements
- **Security Policy** - Responsible disclosure process

## What's Next (Post-Launch Roadmap)

- Advanced agent integration (OpenClaw, Claude Code, OpenCode)
- Habit tracking and analytics
- Weekly/monthly review automation
- Mobile app (iOS/Android)
- Browser extension for quick capture
- Obsidian sync (bidirectional)

## Credits

Built by [Moogs](https://github.com/moogsG) with help from Jynx (AI assistant), Forge (builder agent), Vex (code reviewer), and Wraith (scout).

## Installation

```bash
# Clone the repo
git clone https://github.com/moogsG/gutter.git
cd gutter

# Install dependencies
bun install

# Set up environment variables (copy .env.example to .env.local)
cp .env.example .env.local

# Run development server
bun run dev
```

Visit http://localhost:3000

For full installation and configuration guides, see the [README](README.md) and [docs](docs/) directory.

---

**ADHD brains deserve better tools. Here's one built specifically for us.**

# AI Context — Gutter Repo

This file is **LLM-ready context** for working in this repository. Keep it accurate, concise, and source-of-truth aligned with code.

## What this repo is

**Gutter** is a local-first bullet journal built with **Next.js App Router**. It stores data in **SQLite** and supports local AI via **Ollama** (and optional cloud providers via a router).

## Stack (current)

- Next.js App Router (`app/`)
- React (`components/`)
- TypeScript (strict) (`tsconfig.json`)
- Tailwind CSS v4
- SQLite via `better-sqlite3`
- Redux Toolkit + RTK Query (`store/`)
- Tests: **Vitest** (`vitest.config.ts`, `lib/__tests__/*`)

Refs:
- `ARCHITECTURE.md`
- `package.json`

## Directory map

- `app/` — Next.js routes (pages + `app/api/**/route.ts` handlers)
- `components/` — UI (includes `components/ui/` shadcn primitives)
- `lib/` — server/client shared logic (db, integrations, AI, utils)
- `store/` — RTK store + RTK Query slices
- `types/` — shared TS types
- `docs/` — setup and deployment guides

## Local development (daily commands)

```bash
bun install
cp .env.example .env
bun run dev
```

Pre-PR checks:

```bash
bun run build
bunx tsc --noEmit
bun run test
```

Refs:
- `README.md`
- `.github/workflows/lint.yml`
- `package.json`

## Environment variables

Typed access lives in `lib/env.ts` (import `env`). The canonical variable reference is `CONFIGURATION.md`.

Key ones:
- Auth: `AUTH_PASSWORD_HASH`, `AUTH_SECRET`, `SESSION_MAX_AGE_DAYS`
- DB: `DATABASE_PATH`
- Ollama: `OLLAMA_URL`, `OLLAMA_MODEL`, `JOURNAL_COMMAND_MODEL`
- Optional integrations: Jira/Slack/Calendar/Whisper

## Core flows to understand before editing

### Natural-language journal commands

- Implementation: `lib/journal-agent.ts`
- Pattern: an LLM produces a JSON “plan” (actions against local API semantics) and the server executes those actions.

### Meeting prep

- See `ARCHITECTURE.md` and `lib/meeting-prep.ts` / `lib/ollama-prep.ts`
- Uses tool-calling (Jira/Slack/journal search) and stores results in DB.

## Project conventions (do not fight them)

- Prefer **RTK Query** for client data fetching (no ad-hoc fetch in components).
- Styling: Tailwind classes; avoid inline styles. Use theme tokens.
- Treat `components/ui/` as read-only (wrap instead of editing).
- For data access: prefer the existing DB modules and parameterized queries.

Ref:
- `CODING-STANDARDS.md`

## Gotchas / sharp edges

- **macOS-only**: Apple Calendar integration via `accli` (disable via `CALENDAR_ENABLED=false` on Linux).
- **Secrets**: `.env` must never be committed (repo gitignore covers it). Prefer `process.env` injection; avoid adding new patterns that read plaintext `.env` at runtime.
- **Docs drift**: `CONTRIBUTING.md` mentions `bun run lint`/Biome, but the repo currently relies on `bun run build` + `bunx tsc --noEmit` for CI “linting” and has no Biome config.

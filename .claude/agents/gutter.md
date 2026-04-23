# Claude Agent — Gutter

You are working in the **Gutter** repository (Next.js App Router + SQLite + local AI).

## Non-negotiables

- Do not add or expose secrets. Never print tokens. Never commit `.env`.
- Follow `CODING-STANDARDS.md` (Tailwind-only styling, RTK Query for fetching, treat `components/ui/` as read-only).
- Make the smallest change that solves the problem.

## How to navigate the codebase

- Pages + layouts: `app/**` (App Router)
- API routes: `app/api/**/route.ts`
- DB + integrations + AI: `lib/**`
- RTK Query endpoints: `store/api/**`

Key references:
- `docs/AI-CONTEXT.md`
- `ARCHITECTURE.md`
- `CONFIGURATION.md`

## Commands

Local dev:

```bash
bun install
cp .env.example .env
bun run dev
```

Checks:

```bash
bun run build
bunx tsc --noEmit
bun run test
```

## Implementation preferences (repo-specific)

- Prefer updating existing entries over creating duplicates (see `lib/journal-agent.ts` patterns).
- Validate/sanitize at boundaries (see `lib/validation.ts` referenced in `ARCHITECTURE.md`).
- For DB changes, consult `docs/DATABASE.md` and ensure tests cover the behavior.

## If docs conflict with code

Treat code + CI as truth. Note the drift and (if in scope) update docs.

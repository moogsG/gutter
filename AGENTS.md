# Agent Playbook (Repo)

This repo already contains strong general standards in `CODING-STANDARDS.md`.

This file is the **entrypoint** for AI agents (and humans) to work effectively in this codebase.

## Read first

1. `docs/AI-CONTEXT.md` (repo-specific quick context)
2. `ARCHITECTURE.md` (how the app actually works)
3. `CODING-STANDARDS.md` (non-negotiables)
4. `CONFIGURATION.md` / `.env.example` (env contract)

## Default workflow

```bash
bun install
cp .env.example .env
bun run dev
```

Before opening a PR:

```bash
bun run build
bunx tsc --noEmit
bun run test
```

## Where to make changes

- UI pages/routes: `app/**/page.tsx`
- API handlers: `app/api/**/route.ts`
- Shared logic/integrations/AI: `lib/**`
- Client data fetching: `store/api/**` (RTK Query)

## Repo-specific agent instructions

If your agent framework supports per-repo agent files, use:

- `.claude/agents/gutter.md`

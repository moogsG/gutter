# Testing

## Local release gate

Install dependencies once, then run the same core gates used by CI:

```bash
bun install --frozen-lockfile
bun run test
bunx tsc --noEmit
bun run build
bunx playwright install chromium
bun run test:e2e
```

Vitest uses an isolated temporary SQLite database. Playwright starts the real Next application on port 3123 with a fresh database under the operating system temporary directory and removes it during global teardown. Neither suite reads the default personal database.

## Task Threads coverage

- `__tests__/lib/db-migrations.test.ts` boots a fresh database, upgrades a pre-feature schema fixture without data loss, verifies repeatability, and proves a failed migration rolls back without advancing `_meta.schema_version`.
- `__tests__/app/api/tasks/comments.test.ts` exercises real route composition, auth rejection, server-derived provenance, sanitization, append-only persistence, hash-only credentials, exact retry behavior, changed-payload conflicts, and concurrent same-key delivery.
- `__tests__/lib/db-backup.test.ts` leaves writes in WAL mode, creates a SQLite-native snapshot, restores it, runs `PRAGMA integrity_check`, and verifies the task comment survived.
- `__tests__/components/kanban-task-conversation.test.tsx` covers drawer states, Markdown rendering, status rollback, accessible activation, and focus restoration.
- `e2e/task-conversation.spec.ts` drives capture → all-task board → drawer → human comment → agent comment → idempotent retry → status move → reload through a running Next server. It also verifies HTTP auth rejection and rendered provenance.

## Dogfood checklist

1. Start Gutter with the single command `bun run dev` and open `http://localhost:3000`.
2. Capture a uniquely named task in the journal.
3. Open `/kanban`, find the task regardless of capture date, and open its drawer by click and keyboard.
4. Add a Markdown human comment; close and reopen the drawer and confirm it persists.
5. Generate an agent token with `bun run agent-token:create -- --actor-id jynx`, store the printed value as a secret, and append a comment with a unique `Idempotency-Key`.
6. Retry the same agent request and confirm only one comment appears; expand Provenance in the drawer.
7. Move the task with the accessible status menu, reload, and confirm status and both comments persist.
8. Close the drawer with Escape and its close button and confirm focus returns to the exact card that opened it.

Task Threads intentionally does not include nested threads, editing/deletion, reactions, attachments, notifications, realtime updates, polling, webhooks, MCP, assignments, or multi-user permissions.

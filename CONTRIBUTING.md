# Contributing to Gutter

Thanks for considering a contribution. This guide covers the development workflow, code standards, and pull request process.

---

## Getting Started

### Fork and Clone

```bash
# Fork the repo on GitHub, then:
git clone https://github.com/YOUR-USERNAME/gutter.git
cd gutter
bun install
```

### Set Up Environment

```bash
cp .env.example .env
# Edit .env with your local config
```

**Required for local dev:**
- bun (runtime)
- Ollama running locally (`http://localhost:11434`)
- At least one Ollama model pulled (e.g., `ollama pull qwen3`)

**Optional (for full feature testing):**
- accli for calendar integration (`npm install -g @joargp/accli`)
- whisper.cpp for voice transcription
- Jira API token
- Slack bot token

---

## Development Workflow

### Branch Naming

Use conventional prefixes:

| Prefix | Use Case | Example |
|--------|----------|---------|
| `feat/` | New feature | `feat/add-recurring-tasks` |
| `fix/` | Bug fix | `fix/calendar-timezone-bug` |
| `docs/` | Documentation only | `docs/update-api-reference` |
| `refactor/` | Code refactor (no behavior change) | `refactor/extract-calendar-logic` |
| `test/` | Add/update tests | `test/journal-entry-validation` |
| `chore/` | Maintenance, deps | `chore/upgrade-next-to-16` |

**Example:**
```bash
git checkout -b feat/add-habit-tracker
```

---

## Commit Messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting, no code change
- `refactor`: Code refactor
- `test`: Add/update tests
- `chore`: Maintenance

**Scopes:** `journal`, `calendar`, `jira`, `ollama`, `api`, `ui`, `db`, etc.

**Examples:**
```
feat(journal): add recurring task support

Allows users to create tasks that repeat daily, weekly, or monthly.
Adds new table `recurring_tasks` and cron-based migration.

Closes #42
```

```
fix(calendar): handle timezone offset in event creation

Events were being created in UTC instead of local time.
Now correctly passes timezone to accli.
```

```
docs(api): document semantic search endpoint
```

---

## Code Style

Gutter uses Biome for linting and formatting. Code must pass checks before merging.

### Run Checks Locally

```bash
# Format + lint + import sorting
bun run lint

# Auto-fix issues
bun run lint --fix
```

### Key Standards

- **TypeScript:** Strict mode. No `any` without comment justification.
- **Naming:**
  - Components: PascalCase (`EntryInput.tsx`)
  - Functions: camelCase (`createCalendarEvent`)
  - Files: kebab-case for non-components (`journal-db.ts`)
- **Imports:** Sorted automatically by Biome. Use `@/` alias for `src/`.
- **Async:** Prefer `async/await` over `.then()` chains.
- **Error Handling:** Always catch and log errors. Return user-friendly messages in API responses.

### Database Queries

- Use parameterized queries (no string interpolation)
- Validate/sanitize all user input (see `lib/validation.ts`)
- Document complex queries with comments

**Good:**
```typescript
db.prepare("SELECT * FROM journal_entries WHERE date = ?").all(date);
```

**Bad:**
```typescript
db.prepare(`SELECT * FROM journal_entries WHERE date = '${date}'`).all();
```

### React Components

- Use functional components + hooks
- Extract complex logic to custom hooks
- Keep components focused (single responsibility)
- Prefer composition over prop drilling (use context for deep trees)

---

## Testing Requirements

### Before Submitting a PR

1. **Manual Testing:**
   - Test your feature in the browser (`bun run dev`)
   - Verify edge cases (empty states, error states)
   - Test on macOS if touching calendar/whisper features

2. **API Testing:**
   - Use curl or Postman to test API routes
   - Verify rate limiting behavior
   - Check error responses (400, 401, 500)

3. **Database Integrity:**
   - Ensure no orphaned records
   - Verify foreign key constraints
   - Test migration from clean DB

### Automated Tests (future)

No automated test suite yet. **Contributions welcome!** Ideal setup:
- Vitest for unit tests
- Playwright for E2E
- In-memory SQLite for DB tests

---

## Pull Request Process

### Before Creating a PR

1. **Rebase on latest `main`:**
   ```bash
   git fetch origin
   git rebase origin/main
   ```

2. **Run lint checks:**
   ```bash
   bun run lint
   ```

3. **Build succeeds:**
   ```bash
   bun run build
   ```

4. **Self-review your changes:**
   - Remove debug logs
   - Check for commented-out code
   - Verify no secrets in diff

### Create Pull Request

1. Push your branch:
   ```bash
   git push -u origin feat/your-feature
   ```

2. Open PR on GitHub with:
   - **Title:** Conventional commit format (`feat(scope): description`)
   - **Description:**
     - What does this PR do?
     - Why is this change needed?
     - How was it tested?
     - Screenshots/GIFs for UI changes
     - Link to related issues (`Closes #123`)

### PR Template

```markdown
## Description
Brief description of changes.

## Motivation
Why is this change needed? What problem does it solve?

## Changes
- Added X
- Updated Y
- Fixed Z

## Testing
- [ ] Tested manually in browser
- [ ] Tested API endpoints with curl
- [ ] Verified database integrity
- [ ] Tested on macOS (if applicable)

## Screenshots
(if UI changes)

## Related Issues
Closes #123
```

### Review Process

- Maintainers will review within 7 days
- Address feedback with fixup commits or new commits (don't force-push during review)
- Once approved, maintainer will squash-merge

---

## Code Review Guidelines

### As a Reviewer

- **Be kind.** Assume good intent.
- **Be specific.** Cite code lines and explain why.
- **Distinguish:** blocking issues vs. suggestions
- **Approve quickly** if changes are minor

### As a Contributor

- **Respond to all comments** (even if just "Done")
- **Don't take it personally.** Code review improves the codebase.
- **Ask questions** if feedback is unclear

---

## Project Structure

```
gutter/
├── app/
│   ├── page.tsx              # Daily log
│   ├── month/page.tsx        # Monthly calendar
│   ├── day/[date]/page.tsx   # Day detail
│   ├── future/page.tsx       # Future log
│   ├── collections/          # Collections pages
│   ├── migrate/page.tsx      # Migration review
│   └── api/                  # All API routes
├── components/
│   ├── journal/              # EntryInput, EntryList, OmniBar, VoiceButton
│   ├── meeting/              # MeetingDrawer
│   └── ui/                   # shadcn components
├── lib/
│   ├── db.ts                 # Main DB (gutter.db)
│   ├── journal-db.ts         # Journal DB (gutter-journal.db)
│   ├── jira.ts               # Jira integration + cache
│   ├── ollama-prep.ts        # Meeting prep with tool calling
│   ├── calendar.ts           # Calendar event creation
│   ├── vector-store.ts       # LanceDB vector search
│   ├── validation.ts         # Input validation & sanitization
│   ├── rate-limit.ts         # Rate limiting middleware
│   └── env.ts                # Env validation
├── store/api/                # RTK Query slices
├── docs/                     # Additional documentation
├── ARCHITECTURE.md           # System design
├── API.md                    # API reference
├── CONFIGURATION.md          # Env var guide
└── CONTRIBUTING.md           # This file
```

---

## Adding a New Feature

### Step-by-Step

1. **Check existing issues** — avoid duplicating work
2. **Create a feature branch** (`feat/your-feature`)
3. **Design the data model** (if DB changes needed)
   - Add migration in `lib/journal-db.ts`
   - Update `docs/DATABASE.md`
4. **Implement API route** (if backend needed)
   - Add route to `app/api/`
   - Add validation/sanitization
   - Add rate limiting
   - Document in `API.md`
5. **Build UI component** (if frontend needed)
   - Add to `components/`
   - Use RTK Query for data fetching
   - Follow existing component patterns
6. **Test thoroughly** (manual + edge cases)
7. **Update documentation**
   - Update `README.md` if user-facing
   - Update `ARCHITECTURE.md` if architecture changed
   - Update `CONFIGURATION.md` if new env vars
8. **Create PR** with clear description

---

## Database Migrations

When adding/modifying tables:

1. **Increment schema version** in `lib/journal-db.ts`:
   ```typescript
   const TARGET_SCHEMA_VERSION = 3; // was 2
   ```

2. **Add migration** in `initJournalDb()`:
   ```typescript
   if (currentVersion < 3) {
     db.exec(`
       ALTER TABLE journal_entries ADD COLUMN priority TEXT DEFAULT 'normal';
     `);
     db.prepare("UPDATE _meta SET value = ? WHERE key = 'schema_version'").run('3');
   }
   ```

3. **Test migration:**
   - Start with v2 DB
   - Run migration
   - Verify schema
   - Verify data integrity

4. **Update docs:**
   - `docs/DATABASE.md` — add new column to table schema
   - `ARCHITECTURE.md` — note migration version

---

## Release Process

(For maintainers)

1. **Update version** in `package.json`
2. **Update `CHANGELOG.md`** with release notes
3. **Tag release:**
   ```bash
   git tag -a v1.2.0 -m "Release v1.2.0"
   git push origin v1.2.0
   ```
4. **Create GitHub release** with changelog
5. **Announce** in discussions/Discord/Twitter

---

## Questions?

- **Bugs/Features:** Open an issue on GitHub
- **Questions:** Start a discussion on GitHub Discussions
- **Security:** Email maintainer directly (see README)

---

Thanks for contributing!

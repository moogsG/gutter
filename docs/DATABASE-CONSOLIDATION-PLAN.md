# Database Consolidation Plan

**Date:** 2026-03-23  
**Status:** 🔴 CRITICAL BUG FOUND  
**Priority:** P0 (blocks data integrity)

---

## Problem Statement

Gutter currently uses **two SQLite databases** with **duplicate schemas**, causing data inconsistency:

1. **`gutter.db`** (via `lib/db.ts` → `getDb()`)
2. **`gutter-journal.db`** (via `lib/journal-db.ts` → `getJournalDb()`)

**Both databases create the same tables:**
- `journal_entries`
- `collections`
- `future_log`
- `meeting_prep`

**Current Usage (Audit Results):**

| Endpoint | Database Used | Correct? |
|----------|---------------|----------|
| `/api/journal/*` | `gutter-journal.db` | ✅ |
| `/api/tasks` | `gutter-journal.db` | ✅ |
| `/api/collections` | `gutter.db` | ❌ WRONG |
| `/api/daily-log` | `gutter.db` | ❌ WRONG |
| `/api/future-log` | `gutter.db` | ❌ WRONG |
| `/api/meeting-prep/*` | `gutter.db` | ❌ WRONG |
| `/api/projects` | `gutter.db` | ❌ WRONG |

**Impact:**
- User creates journal entry via `/api/journal` → saved to `gutter-journal.db`
- User views collections via `/api/collections` → reads from `gutter.db`
- **Result:** Collections and journal entries are split across databases! 🚨

---

## Root Cause

From code review:
1. **`lib/db.ts`** was the original database (legacy)
2. **`lib/journal-db.ts`** was added later for "journal-specific" features
3. Refactoring was incomplete — some endpoints kept using `getDb()` instead of migrating to `getJournalDb()`
4. Both schemas create the same tables, masking the bug (no immediate errors)

---

## Solution: Single Database

**Goal:** Consolidate to `gutter-journal.db` as the single source of truth.

**Steps:**

### Phase 1: Audit & Document ✅ (Current)
- [x] Identify all database usages
- [x] Document which endpoints use which database
- [x] Create migration plan

### Phase 2: Refactor API Routes
- [ ] Update all endpoints to use `getJournalDb()`:
  - [ ] `/api/collections/route.ts`
  - [ ] `/api/daily-log/route.ts`
  - [ ] `/api/future-log/route.ts`
  - [ ] `/api/meeting-prep/prepare/route.ts`
  - [ ] `/api/meeting-prep/route.ts`
  - [ ] `/api/meeting-prep/transcript/route.ts`
  - [ ] `/api/meeting-prep/update/route.ts`
  - [ ] `/api/projects/route.ts`
  - [ ] `/api/journal/command/route.ts` (uses both!)

### Phase 3: Data Migration Script
- [ ] Create migration script: `scripts/migrate-to-single-db.ts`
- [ ] Copy data from `gutter.db` → `gutter-journal.db`:
  - [ ] `journal_entries`
  - [ ] `collections`
  - [ ] `future_log`
  - [ ] `meeting_prep`
  - [ ] `projects`
- [ ] Merge duplicate entries (handle conflicts by timestamp)
- [ ] Verify data integrity (row counts, foreign keys)

### Phase 4: Remove Legacy Database
- [ ] Delete `lib/db.ts`
- [ ] Rename `lib/journal-db.ts` → `lib/db.ts` (simplify naming)
- [ ] Update all imports (`getJournalDb()` → `getDb()`)
- [ ] Remove `TASKS_DB_PATH` env var (obsolete)
- [ ] Update `.env.example`

### Phase 5: Schema Cleanup
- [ ] Remove legacy tables from schema (only in old gutter.db):
  - `tasks`, `task_events`, `task_notes` (superseded by journal_entries)
  - `ideas`, `notes` (superseded by journal_entries)
  - `calendar_events` (fetched via accli, not cached)
  - `chat_messages` (experimental, unused)
- [ ] Update `docs/DATABASE.md` to reflect single database

### Phase 6: Testing
- [ ] Run test suite: `bun test`
- [ ] Manual smoke test:
  - [ ] Create journal entry
  - [ ] Create collection
  - [ ] Add entry to collection
  - [ ] Migrate entry to future date
  - [ ] Create meeting prep note
  - [ ] Search journal entries
- [ ] Verify data persists across app restarts

### Phase 7: Documentation
- [ ] Update `docs/DATABASE.md` (remove gutter.db references)
- [ ] Update `README.md` if database mentioned
- [ ] Update `docs/ARCHITECTURE.md` if database mentioned
- [ ] Add migration notes to `CHANGELOG.md`

---

## Migration Script Design

**File:** `scripts/migrate-to-single-db.ts`

**Strategy:**
1. Backup both databases before starting
2. Disable foreign key constraints during migration
3. Use `INSERT OR REPLACE` for idempotent merging (safe for repeat runs)
4. Migrate tables in order: collections → journal_entries → future_log → meeting_prep → projects
5. Re-enable foreign key constraints
6. Verify row counts match between databases
7. Provide clear success/failure messaging with next steps

**Key features:**
- `--dry-run` flag for preview mode
- Automatic backups before migration (stored in `./backups/`)
- Progress reporting for each table
- Row count verification
- Handles missing tables gracefully (legacy DB may not have all tables)
- Safe for repeat runs (INSERT OR REPLACE strategy)

**Usage:**
```bash
cd ~/workspace/gutter
bun run scripts/migrate-to-single-db.ts
```

---

## Risk Assessment

**Risks:**
1. **Data loss** during migration (if script fails mid-way)
2. **Breaking existing deployments** (users with data in gutter.db)
3. **Schema drift** (if tables have subtle differences)

**Mitigations:**
1. **Automated backups** before migration (already in place for journal-db)
2. **INSERT OR REPLACE** strategy (preserves newer data)
3. **Dry-run mode** in migration script (preview changes first)
4. **Thorough testing** before merging to master
5. **Migration guide** for existing users in CHANGELOG

---

## Timeline

**Estimated:** 2-3 hours

- Phase 2 (Refactor routes): 30 min
- Phase 3 (Migration script): 45 min
- Phase 4 (Remove legacy): 15 min
- Phase 5 (Schema cleanup): 15 min
- Phase 6 (Testing): 30 min
- Phase 7 (Documentation): 15 min

**Target completion:** This session (2026-03-23)

---

## Rollout Plan

**For v1.0.1 patch release:**
1. Merge this branch to master
2. Run migration script in production (backup first!)
3. Monitor for 24 hours
4. Tag v1.0.1 with migration notes

**For existing users:**
```bash
# Before updating to v1.0.1
cp gutter.db gutter.db.backup

# Update Gutter
git pull origin master
bun install

# Run migration (if gutter.db exists)
bun run scripts/migrate-to-single-db.ts

# Verify data
bun run dev
# Check collections, entries, meeting prep

# Clean up (after verification)
rm gutter.db
```

---

## Open Questions

- [ ] Should we support rollback? (keep gutter.db around for 1 week?)
- [ ] Should migration run automatically on app startup? (risky)
- [ ] Should we add a "database health check" API endpoint?

---

## Next Steps

1. ✅ Create this plan document
2. ⏭️ Refactor API routes (Phase 2)
3. ⏭️ Create migration script (Phase 3)
4. ⏭️ Test thoroughly (Phase 6)
5. ⏭️ Update docs (Phase 7)
6. ⏭️ Open PR for review

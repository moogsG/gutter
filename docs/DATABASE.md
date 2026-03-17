# Database Schema

Gutter uses two SQLite databases with WAL mode for concurrent read/write performance.

---

## `gutter.db` — Main Database

**Path:** `$TASKS_DB_PATH` (default: `./gutter.db`)  
**Connection:** `lib/db.ts` → `getDb()`

### Tables

#### `ideas`
Quick-capture ideas bucket.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | UUID |
| `text` | TEXT | NOT NULL | Idea content |
| `created_at` | TEXT | NOT NULL | ISO timestamp |
| `tags` | TEXT | | JSON array of tags |

#### `notes`
Timestamped notes (distinct from journal entries).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | UUID |
| `text` | TEXT | NOT NULL | Note content |
| `created_at` | TEXT | NOT NULL | ISO timestamp |
| `timestamp` | TEXT | NOT NULL | Display timestamp |

**Indexes:** `idx_notes_timestamp(timestamp)`

#### `calendar_events`
Cached calendar events from Apple Calendar.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | UUID |
| `title` | TEXT | NOT NULL | Event title |
| `description` | TEXT | | Event description |
| `start_time` | TEXT | NOT NULL | ISO start time |
| `created_at` | TEXT | NOT NULL | ISO timestamp |

#### `chat_messages`
Chat/AI conversation history.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | UUID |
| `text` | TEXT | NOT NULL | Message content |
| `sender` | TEXT | NOT NULL | "user" or "assistant" |
| `timestamp` | TEXT | NOT NULL | ISO timestamp |
| `created_at` | TEXT | NOT NULL | ISO timestamp |

**Indexes:** `idx_chat_sender(sender)`, `idx_chat_timestamp(timestamp)`

#### `meeting_prep`
Meeting preparation notes, transcripts, and AI summaries.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | UUID |
| `event_id` | TEXT | NOT NULL | Calendar event ID |
| `title` | TEXT | NOT NULL | Meeting title |
| `time` | TEXT | NOT NULL | Meeting time |
| `calendar` | TEXT | NOT NULL | Source calendar name |
| `prep_notes` | TEXT | | Preparation notes (markdown) |
| `prep_status` | TEXT | DEFAULT 'none' | none / preparing / ready |
| `transcript` | TEXT | | Meeting transcript |
| `summary` | TEXT | | AI-generated summary |
| `action_items` | TEXT | | Extracted action items (JSON) |
| `occurrence_date` | TEXT | | For recurring events |
| `created_at` | TEXT | NOT NULL | ISO timestamp |
| `updated_at` | TEXT | NOT NULL | ISO timestamp |

**Indexes:** `UNIQUE idx_meeting_prep_event_date(event_id, occurrence_date)`, `idx_meeting_prep_status(prep_status)`, `idx_meeting_prep_date(occurrence_date)`

#### `journal_entries`
Core bullet journal entries (tasks, notes, appointments, memories).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | UUID |
| `date` | TEXT | NOT NULL | YYYY-MM-DD |
| `signifier` | TEXT | NOT NULL | Bullet type: `task`, `event`, `note`, `memory`, `important` |
| `text` | TEXT | NOT NULL | Entry content |
| `status` | TEXT | DEFAULT 'open' | open / done / migrated / dropped / scheduled |
| `migrated_to` | TEXT | | Target entry ID if migrated |
| `migrated_from` | TEXT | | Source entry ID if migrated |
| `collection_id` | TEXT | FK → collections(id) ON DELETE SET NULL | Collection membership |
| `tags` | TEXT | DEFAULT '[]' | JSON array of tags |
| `sort_order` | INTEGER | NOT NULL | Display order within date |
| `created_at` | TEXT | DEFAULT now | ISO timestamp |
| `updated_at` | TEXT | DEFAULT now | ISO timestamp |

**Indexes:** `idx_je_date(date)`, `idx_je_status(status)`, `idx_je_signifier(signifier)`, `idx_je_collection(collection_id)`, `idx_je_sort(date, sort_order)`

#### `collections`
Topic-specific pages (Books, Goals, Recipes, etc.).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | UUID |
| `title` | TEXT | NOT NULL | Collection name |
| `icon` | TEXT | | Emoji icon |
| `created_at` | TEXT | DEFAULT now | ISO timestamp |

#### `future_log`
Entries scheduled for future months.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | UUID |
| `target_month` | TEXT | NOT NULL | YYYY-MM format |
| `signifier` | TEXT | NOT NULL | Bullet type |
| `text` | TEXT | NOT NULL | Entry content |
| `migrated` | INTEGER | DEFAULT 0 | 1 if migrated to daily log |
| `created_at` | TEXT | DEFAULT now | ISO timestamp |

**Indexes:** `idx_fl_month(target_month)`

---

## `gutter-journal.db` — Journal Database

**Path:** `$JOURNAL_DB_PATH` (default: `./gutter-journal.db`)  
**Connection:** `lib/journal-db.ts` → `getJournalDb()`

This is the primary journal database with schema versioning and automatic daily backups.

### Tables

Contains the same `journal_entries`, `collections`, `future_log`, and `meeting_prep` tables as above, plus:

#### `projects`
Project definitions for tagging and filtering entries.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | UUID |
| `name` | TEXT | NOT NULL | Project name |
| `description` | TEXT | | Project description |
| `color` | TEXT | | Hex color code |
| `icon` | TEXT | | Emoji icon |
| `active` | INTEGER | DEFAULT 1 | 1 = active, 0 = archived |
| `created_at` | TEXT | DEFAULT now | ISO timestamp |
| `updated_at` | TEXT | DEFAULT now | ISO timestamp |

**Indexes:** `idx_projects_active(active)`

#### `_meta`
Internal metadata for schema versioning and backup tracking.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `key` | TEXT | PRIMARY KEY | Metadata key |
| `value` | TEXT | NOT NULL | Metadata value |

**Known keys:** `schema_version` (current: 2), `created_at`, `last_backup`

### Migrations

| Version | Changes |
|---------|---------|
| 1 | Initial schema |
| 2 | Added `parent_id` column to `journal_entries` for subtask support |

**Additional journal_entries columns (via migration):**

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `parent_id` | TEXT | FK → journal_entries(id) | Parent entry for subtasks |

**Additional indexes:** `idx_je_parent(parent_id)`, `idx_je_sort(date, sort_order)`, `idx_je_updated(updated_at)`, `idx_meeting_prep_status(prep_status)`, `idx_meeting_prep_date(occurrence_date)`, `idx_fl_migrated(migrated)`

---

## Configuration

| Env Variable | Default | Description |
|-------------|---------|-------------|
| `TASKS_DB_PATH` | `./gutter.db` | Path to main database |
| `JOURNAL_DB_PATH` | `./gutter-journal.db` | Path to journal database |
| `JOURNAL_BACKUP_DIR` | `./backups` | Backup directory |

## SQLite Pragmas

Both databases use:
- `journal_mode = WAL` — Write-Ahead Logging for concurrent reads
- `foreign_keys = ON` — Enforce foreign key constraints
- `wal_checkpoint(TRUNCATE)` — Flush WAL on connection

Journal DB additionally:
- `synchronous = NORMAL` — Balance durability/performance
- `cache_size = 10000` — ~40MB page cache

## Backups

The journal database performs automatic daily backups:
- Triggered on first connection each day
- Stored in `$JOURNAL_BACKUP_DIR` (default: `./backups/`)
- Retention: last 7 daily backups
- Manual trigger: `triggerBackup()` from `lib/journal-db.ts`

## Design Notes

**Why two databases?** Historical — `gutter.db` was the original task/chat DB, `gutter-journal.db` was added for the bullet journal system with proper schema versioning. Both contain `journal_entries` and related tables, but `gutter-journal.db` is the canonical source for journal data (it has migrations, backups, and the `_meta` table).

**Future consideration:** Consolidate into a single database. The journal DB has the better infrastructure (versioning, backups, migrations). This would simplify the codebase and eliminate duplicate table definitions.

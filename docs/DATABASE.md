# Database Schema Documentation

Gutter uses two SQLite databases for data persistence:

1. **`gutter.db`** — Legacy database (being phased out)
2. **`gutter-journal.db`** — Primary database for journal entries and related data

---

## `gutter-journal.db` (Primary Database)

### Core Tables

#### `journal_entries`
Daily log entries following bullet journal methodology.

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT PRIMARY KEY | Unique entry ID (format: `je-{timestamp}-{random}`) |
| `date` | TEXT NOT NULL | Entry date (YYYY-MM-DD) |
| `signifier` | TEXT NOT NULL | Entry type: `task`, `appointment`, `note`, `memory`, `important` |
| `text` | TEXT NOT NULL | Entry content (max 50,000 chars) |
| `status` | TEXT NOT NULL | Entry status: `open`, `in-progress`, `blocked`, `done`, `killed`, `migrated` |
| `migrated_to` | TEXT | Target date if migrated (YYYY-MM-DD) |
| `migrated_from` | TEXT | Source date if migrated from another date |
| `collection_id` | TEXT | Foreign key to `collections.id` |
| `parent_id` | TEXT | Parent entry ID for nested entries |
| `tags` | TEXT | JSON array of tags (default: `[]`) |
| `sort_order` | INTEGER NOT NULL | Display order within date |
| `created_at` | TEXT NOT NULL | ISO 8601 timestamp |
| `updated_at` | TEXT NOT NULL | ISO 8601 timestamp |

**Indexes:**
- `idx_je_date` — Date lookup
- `idx_je_status` — Status filtering (Kanban, migration)
- `idx_je_signifier` — Type filtering
- `idx_je_collection` — Collection filtering
- `idx_je_parent` — Nested entry lookup
- `idx_je_sort` — Composite index on (date, sort_order) for daily display
- `idx_je_updated` — Recently updated entries

#### `collections`
Thematic groupings for related entries (Projects, Reading List, etc.).

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT PRIMARY KEY | Format: `col-{timestamp}` |
| `title` | TEXT NOT NULL | Collection name |
| `icon` | TEXT | Optional emoji/icon |
| `created_at` | TEXT NOT NULL | ISO 8601 timestamp |

#### `future_log`
Forward planning for future months (3-6+ months out).

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT PRIMARY KEY | Format: `fl-{timestamp}` |
| `target_month` | TEXT NOT NULL | Target month (YYYY-MM) |
| `signifier` | TEXT NOT NULL | Entry type |
| `text` | TEXT NOT NULL | Entry content |
| `migrated` | INTEGER | Boolean: 0 or 1 |
| `created_at` | TEXT NOT NULL | ISO 8601 timestamp |

**Indexes:**
- `idx_fl_month` — Month lookup
- `idx_fl_migrated` — Filter migrated/unmigrated

#### `projects`
Project metadata for tracking multi-step work.

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT PRIMARY KEY | Project ID |
| `name` | TEXT NOT NULL | Project name |
| `description` | TEXT | Project description |
| `color` | TEXT | Hex color for UI |
| `icon` | TEXT | Project icon/emoji |
| `active` | INTEGER | Boolean: 1 (active) or 0 (archived) |
| `created_at` | TEXT NOT NULL | ISO 8601 timestamp |
| `updated_at` | TEXT NOT NULL | ISO 8601 timestamp |

**Indexes:**
- `idx_projects_active` — Active/archived filtering

#### `meeting_prep`
Meeting preparation notes and transcripts.

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT PRIMARY KEY | Meeting prep ID |
| `event_id` | TEXT NOT NULL | Calendar event ID |
| `occurrence_date` | TEXT | Date of this occurrence (for recurring meetings) |
| `title` | TEXT NOT NULL | Meeting title |
| `time` | TEXT | Meeting time |
| `calendar` | TEXT | Source calendar name |
| `prep_notes` | TEXT | Pre-meeting notes |
| `prep_status` | TEXT | Status: `none`, `draft`, `ready`, `complete` |
| `transcript` | TEXT | Voice transcript from meeting |
| `summary` | TEXT | LLM-generated summary |
| `action_items` | TEXT | Extracted action items |
| `created_at` | TEXT | ISO 8601 timestamp |
| `updated_at` | TEXT | ISO 8601 timestamp |

**Indexes:**
- `idx_meeting_prep_event` — Unique composite index on (event_id, occurrence_date)
- `idx_meeting_prep_status` — Status filtering
- `idx_meeting_prep_date` — Date lookup

#### `_meta`
Metadata key-value store for database versioning and config.

| Column | Type | Description |
|--------|------|-------------|
| `key` | TEXT PRIMARY KEY | Metadata key |
| `value` | TEXT NOT NULL | Metadata value |

---

## `gutter.db` (Legacy Database)

**Status:** Being phased out. New features should use `gutter-journal.db`.

Contains duplicate tables and experimental features from early development:

- `tasks` — Task management (superseded by `journal_entries` with signifier `task`)
- `task_events` — Task history
- `task_notes` — Task-specific notes
- `ideas` — Quick capture (moved to journal entries)
- `notes` — General notes (moved to journal entries)
- `calendar_events` — Local calendar cache (deprecated, now fetched via accli)
- `chat_messages` — Chat history (experimental feature)

**Migration Plan:**
1. Extract any remaining data from `gutter.db`
2. Migrate to `gutter-journal.db` schema
3. Remove `gutter.db` dependencies
4. Delete legacy database

---

## Data Relationships

```
collections
  ↓ (1:many)
journal_entries
  ↓ (parent_id)
journal_entries (nested)

projects
  ↓ (via collection_id reference)
journal_entries

meeting_prep
  ↓ (references calendar events)
calendar events (external via accli)
```

---

## Best Practices

### Entry IDs
- **Format:** `{prefix}-{timestamp}-{random}`
  - `je-` — Journal entry
  - `col-` — Collection
  - `fl-` — Future log
- **Benefits:** Sortable, collision-resistant, human-readable

### Date Formats
- **Dates:** ISO 8601 (YYYY-MM-DD)
- **Timestamps:** ISO 8601 with timezone (YYYY-MM-DDTHH:mm:ss.sssZ)

### JSON Fields
- `tags` — Always store as JSON array: `["tag1", "tag2"]`
- Parse after SELECT: `JSON.parse(entry.tags)`
- Stringify before INSERT/UPDATE: `JSON.stringify(tags)`

### Indexes
- **Use composite indexes** for common queries (e.g., `date + sort_order`)
- **Index foreign keys** (e.g., `collection_id`, `parent_id`)
- **Index filter columns** (e.g., `status`, `signifier`)

### Migrations
When schema changes are needed:
1. Create migration script in `migrations/YYYY-MM-DD-description.sql`
2. Update `_meta` table with version number
3. Run migration before app startup
4. Test with backup database first

---

## Performance Considerations

### Query Optimization
- Use indexed columns in WHERE clauses
- Limit result sets (default: 100-500 rows)
- Use prepared statements (prevents SQL injection + caching)

### Backup Strategy
- Automatic backups triggered on journal writes (max 5 backups retained)
- Backups stored in `./backups/journal-{timestamp}.db`
- Manual backup: `sqlite3 gutter-journal.db ".backup backups/manual-{date}.db"`

### Database Size
- Current size: ~100KB - 1MB (typical for 1000 entries)
- Growth rate: ~1KB per entry (text + metadata)
- Vacuum periodically: `sqlite3 gutter-journal.db "VACUUM;"`

---

## Schema Evolution

### Version History
- **v1.0** (2026-03-20): Initial public release
  - Dual database system (gutter.db + gutter-journal.db)
  - Journal entries with signifiers, collections, future log
  - Meeting prep with LLM integration

### Planned Changes
- [ ] Consolidate into single database (remove gutter.db)
- [ ] Add foreign key constraints (currently disabled for flexibility)
- [ ] Migrate to migrations system (currently ad-hoc schema updates)
- [ ] Add database versioning in `_meta` table
- [ ] Archive old entries (auto-archive entries >1 year old)

---

## Troubleshooting

### Common Issues

**Database locked**
```bash
# Kill processes holding locks
lsof | grep gutter-journal.db
# Or restart app
```

**Corrupted database**
```bash
# Restore from backup
cp backups/journal-{latest}.db gutter-journal.db
# Or rebuild from scratch (last resort)
rm gutter-journal.db && bun run dev
```

**Missing indexes**
```sql
-- Run .schema to verify indexes exist
sqlite3 gutter-journal.db ".schema"

-- Recreate if missing
sqlite3 gutter-journal.db < schema.sql
```

---

## Developer Reference

### Creating New Tables

```sql
CREATE TABLE new_table (
  id TEXT PRIMARY KEY,
  field TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_new_table_field ON new_table(field);
```

### Safe Schema Changes

1. **Add column** (backward compatible):
   ```sql
   ALTER TABLE journal_entries ADD COLUMN new_field TEXT;
   ```

2. **Drop column** (requires recreation):
   ```sql
   -- SQLite doesn't support DROP COLUMN
   -- Must recreate table:
   BEGIN TRANSACTION;
   CREATE TABLE journal_entries_new (...);
   INSERT INTO journal_entries_new SELECT id, date, ... FROM journal_entries;
   DROP TABLE journal_entries;
   ALTER TABLE journal_entries_new RENAME TO journal_entries;
   COMMIT;
   ```

3. **Rename column** (requires recreation, same as drop)

### Querying from Code

```typescript
import { getJournalDb } from "@/lib/journal-db";

const db = getJournalDb();

// Prepared statement (prevents SQL injection)
const entries = db
  .prepare("SELECT * FROM journal_entries WHERE date = ?")
  .all(date);

// Insert
db.prepare(
  "INSERT INTO journal_entries (id, date, signifier, text, ...) VALUES (?, ?, ?, ?, ...)"
).run(id, date, signifier, text, ...);

// Update
db.prepare(
  "UPDATE journal_entries SET status = ?, updated_at = ? WHERE id = ?"
).run(status, now, id);
```

---

## See Also
- [API Documentation](./API.md)
- [Architecture Overview](./ARCHITECTURE.md)
- [Testing Guide](../TESTING.md)

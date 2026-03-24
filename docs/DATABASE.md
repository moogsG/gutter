# Database Schema Documentation

Gutter uses a single SQLite database for all data persistence:

**`gutter-journal.db`** — Primary database for journal entries, collections, meeting prep, and all core features.

---

## Database Schema

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

## Migration from Legacy Database

Prior to v1.0.1, Gutter used two databases (`gutter.db` and `gutter-journal.db`), causing data inconsistency. This was consolidated in the database refactor.

**If upgrading from v1.0.0 or earlier:**

1. Backup your data: `cp gutter.db gutter.db.backup`
2. Run the migration script: `bun run scripts/migrate-to-single-db.ts`
3. Verify data in the UI
4. Delete legacy database: `rm gutter.db`

See `docs/DATABASE-CONSOLIDATION-PLAN.md` for technical details.

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
- **v1.0.1** (2026-03-23): Database consolidation
  - Consolidated to single database (gutter-journal.db)
  - Removed legacy gutter.db module
  - Migration script for safe data merge

### Planned Changes
- [ ] Add foreign key constraints (currently enabled but not enforced on all relationships)
- [ ] Formal migrations system (currently ad-hoc ALTER TABLE in lib/db.ts)
- [ ] Archive old entries (auto-archive entries >1 year old)
- [ ] Vacuum automation (periodic VACUUM to reclaim space)

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
import { getDb } from "@/lib/db";

const db = getDb();

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

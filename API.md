# API Reference

All API routes for Gutter. Routes are grouped by feature area.

Base URL: `http://localhost:3000` (default)

---

## Authentication

### POST `/api/auth`

**Login**

**Request:**
```json
{
  "password": "your-password"
}
```

**Response (200):**
```json
{
  "ok": true
}
```

**Response (401):**
```json
{
  "error": "Wrong password"
}
```

**Rate Limit:** 5 requests/min  
**Auth Required:** No  
**Notes:**
- Sets HTTP-only cookie `gutter-session` (30-day expiry by default)
- Password compared against `AUTH_PASSWORD_HASH` env var (bcrypt)
- Failed attempts logged to `security.log`

---

### DELETE `/api/auth`

**Logout**

**Response (200):**
```json
{
  "ok": true
}
```

**Rate Limit:** None  
**Auth Required:** No  
**Notes:**
- Revokes session token and deletes `gutter-session` cookie

---

## Journal Entries

### GET `/api/journal`

**Fetch entries for a specific date**

**Query Params:**
- `date` (required): `YYYY-MM-DD` format

**Response (200):**
```json
[
  {
    "id": "je-1234567890-abc123",
    "date": "2026-03-17",
    "signifier": "task",
    "text": "Buy milk",
    "status": "open",
    "migrated_to": null,
    "migrated_from": null,
    "collection_id": null,
    "parent_id": null,
    "tags": ["groceries"],
    "sort_order": 0,
    "created_at": "2026-03-17T10:00:00.000Z",
    "updated_at": "2026-03-17T10:00:00.000Z",
    "children": []
  }
]
```

**Rate Limit:** 100 requests/min  
**Auth Required:** Yes (middleware)  
**Notes:**
- Returns entries nested by parent/child (subtasks)
- Top-level entries only (children nested in `children` array)

---

### POST `/api/journal`

**Create a new journal entry**

**Request:**
```json
{
  "date": "2026-03-17",
  "signifier": "task",
  "text": "Buy milk",
  "tags": ["groceries"],
  "parent_id": null
}
```

**Response (200):**
```json
{
  "id": "je-1234567890-abc123",
  "date": "2026-03-17",
  "signifier": "task",
  "text": "Buy milk",
  "status": "open",
  "tags": ["groceries"],
  "sort_order": 0,
  "created_at": "2026-03-17T10:00:00.000Z",
  "updated_at": "2026-03-17T10:00:00.000Z"
}
```

**Rate Limit:** 30 requests/min  
**Auth Required:** Yes  
**Validation:**
- `date` must be `YYYY-MM-DD` format
- `signifier` must be one of: `•`, `○`, `×`, `—`, `>`, `<`, `*`, `!`, `?`
- `text` max length: 50,000 chars
- `tags` sanitized for XSS/SQLi

**Notes:**
- Fire-and-forget embedding to vector store (LanceDB)
- If `parent_id` provided, entry becomes a subtask

---

### PATCH `/api/journal/:id`

**Update an existing entry**

**Request:**
```json
{
  "status": "done",
  "text": "Buy milk and eggs",
  "signifier": "task",
  "collection_id": "col-123"
}
```

**Response (200):**
```json
{
  "success": true
}
```

**Rate Limit:** 50 requests/min  
**Auth Required:** Yes  
**Notes:**
- All fields optional
- Valid statuses: `open`, `in-progress`, `blocked`, `done`, `killed`, `migrated`
- If `text`, `signifier`, or `collection_id` changed → re-embeds entry

---

### DELETE `/api/journal/:id`

**Delete an entry (soft delete by default)**

**Query Params:**
- `hard` (optional): `true` to permanently delete (default: soft delete)

**Response (200):**
```json
{
  "success": true
}
```

**Rate Limit:** 30 requests/min  
**Auth Required:** Yes  
**Notes:**
- Soft delete sets `status = 'killed'`
- Hard delete removes from DB and vector store

---

### GET `/api/journal/search`

**Full-text search across all entries**

**Query Params:**
- `q` (required): Search query (min 2 chars)
- `limit` (optional): Max results (default: 20)

**Response (200):**
```json
[
  {
    "id": "je-1234567890-abc123",
    "date": "2026-03-17",
    "signifier": "task",
    "text": "Buy milk for database project",
    "status": "open",
    "tags": ["groceries"],
    ...
  }
]
```

**Rate Limit:** None  
**Auth Required:** Yes  
**Notes:**
- SQLite LIKE query (`%term%`)
- Excludes entries with `status = 'killed'`
- Returns empty array if query < 2 chars

---

### GET `/api/journal/unresolved`

**Get all open tasks and appointments for a month**

**Query Params:**
- `month` (required): `YYYY-MM` format

**Response (200):**
```json
[
  {
    "id": "je-1234567890-abc123",
    "date": "2026-03-15",
    "signifier": "task",
    "text": "Finish documentation",
    "status": "open",
    ...
  }
]
```

**Rate Limit:** None  
**Auth Required:** Yes  
**Notes:**
- Used by migration flow
- Only returns entries with `signifier IN ('task', 'appointment')` and `status = 'open'`

---

### POST `/api/journal/migrate`

**Migrate entries to a new date**

**Request:**
```json
{
  "entryIds": ["je-123", "je-456"],
  "targetDate": "2026-03-18"
}
```

**Response (200):**
```json
{
  "success": true,
  "count": 2
}
```

**Rate Limit:** None  
**Auth Required:** Yes  
**Notes:**
- Creates new entries on `targetDate` with `migrated_from` set to original `date`
- Marks original entries with `status = 'migrated'` and `migrated_to = targetDate`

---

### POST `/api/journal/command`

**Natural language command interpreter**

**Request:**
```json
{
  "command": "buy milk tomorrow",
  "context": {
    "currentDate": "2026-03-17",
    "currentPage": "daily"
  }
}
```

**Response (200):**
```json
{
  "ok": true,
  "message": "Added task: Buy milk",
  "actions": [
    {
      "method": "POST",
      "path": "/api/journal",
      "success": true
    }
  ]
}
```

**Rate Limit:** None  
**Auth Required:** Yes  
**Notes:**
- Uses Ollama (model: `JOURNAL_COMMAND_MODEL`) to interpret command
- Returns structured actions executed locally
- Supports subtasks via `parent_ref`
- Can create calendar events alongside journal entries

---

### POST `/api/journal/transcribe`

**Transcribe voice audio to text**

**Request:**
- Form data with `audio` field (WebM file)

**Response (200):**
```json
{
  "text": "Buy milk tomorrow",
  "duration": 4096
}
```

**Rate Limit:** None  
**Auth Required:** Yes  
**Notes:**
- Converts WebM to 16kHz mono WAV via ffmpeg
- Transcribes with whisper.cpp (local STT)
- Model path: `WHISPER_MODEL_PATH` env var

---

### POST `/api/journal/calendar`

**Create an Apple Calendar event**

**Request:**
```json
{
  "summary": "Meeting with Thiago",
  "date": "2026-03-18",
  "startTime": "15:00",
  "endTime": "16:00",
  "allDay": false,
  "calendar": "work",
  "location": "Zoom",
  "description": "Discuss autopilot review"
}
```

**Response (200):**
```json
{
  "ok": true,
  "message": "Created \"Meeting with Thiago\" on work",
  "event": { ... },
  "cacheStatus": {
    "lastSync": 1710694800000,
    "lastSuccess": 1710694800000
  }
}
```

**Rate Limit:** None  
**Auth Required:** Yes  
**Notes:**
- Uses `accli` CLI (macOS only)
- Times must be 24-hour format (`HH:mm`)
- Default calendar: `home` (or `DEFAULT_CALENDAR` env var)
- Returns `disabled: true` if `CALENDAR_ENABLED=false`

---

### GET `/api/journal/calendar`

**Get calendar integration status**

**Response (200):**
```json
{
  "enabled": true,
  "config": {
    "cli": "npx @joargp/accli",
    "defaultCalendar": "home",
    "retryAttempts": 3,
    "retryDelayMs": 1000,
    "cacheDurationMs": 300000
  },
  "status": {
    "lastSync": 1710694800000,
    "lastSuccess": 1710694800000,
    "lastError": null,
    "timeSinceLastSync": 1234
  }
}
```

**Rate Limit:** None  
**Auth Required:** Yes

---

## Calendar

### GET `/api/calendar`

**Fetch upcoming calendar events**

**Query Params:**
- `month` (optional): `YYYY-MM` format (fetches entire month; default: next 7 days)

**Response (200):**
```json
{
  "events": [
    {
      "id": "evt-123",
      "title": "Meeting with Thiago",
      "startDate": "2026-03-18T15:00:00Z",
      "endDate": "2026-03-18T16:00:00Z",
      "calendar": "work",
      "allDay": false
    }
  ]
}
```

**Rate Limit:** 50 requests/min  
**Auth Required:** Yes  
**Notes:**
- Fetches from all calendars in `CALENDARS` env var
- Default (no month): next 7 days, non-all-day events only, limit 5
- With month: all events in that month, limit 100

---

### GET `/api/calendar/events`

**Fetch calendar events for a date range**

**Query Params:**
- `from` (required): `YYYY-MM-DD`
- `to` (required): `YYYY-MM-DD`

**Response (200):**
```json
[
  {
    "id": "evt-123",
    "summary": "Meeting with Thiago",
    "startDate": "2026-03-18T15:00:00Z",
    "endDate": "2026-03-18T16:00:00Z",
    "allDay": false,
    "calendar": "work",
    "location": "Zoom"
  }
]
```

**Rate Limit:** None  
**Auth Required:** Yes  
**Notes:**
- 5-minute cache (keyed by `from-to`)
- Uses `accli` to fetch from each calendar in parallel

---

## Meeting Prep

### GET `/api/meeting-prep`

**Fetch all meetings with prep data**

**Response (200):**
```json
{
  "meetings": [
    {
      "id": "mp-123",
      "eventId": "evt-456",
      "title": "Sprint Planning",
      "time": "2026-03-18T10:00:00Z",
      "calendar": "work",
      "occurrenceDate": "2026-03-18",
      "prepNotes": "## Context\n- Review backlog\n- ...",
      "prepStatus": "ready",
      "transcript": null,
      "summary": null,
      "actionItems": null
    }
  ]
}
```

**Rate Limit:** None  
**Auth Required:** Yes  
**Notes:**
- Fetches next 14 days of calendar events
- Joins with `meeting_prep` table by `event_id` + `occurrence_date`
- Includes past meetings with prep data (transcript/notes)

---

### POST `/api/meeting-prep/prepare`

**Request AI-generated meeting prep**

**Request:**
```json
{
  "eventId": "evt-456",
  "title": "Sprint Planning",
  "time": "2026-03-18T10:00:00Z",
  "calendar": "work",
  "context": "Optional user-provided context"
}
```

**Response (200):**
```json
{
  "ok": true,
  "id": "mp-123",
  "status": "preparing"
}
```

**Rate Limit:** 10 requests/min  
**Auth Required:** Yes  
**Notes:**
- Sets `prep_status = 'preparing'` immediately
- Fire-and-forget: calls Ollama with tool calling in background
- Tools: `searchJira()`, `searchSlack()`, `searchJournalEntries()`
- Updates `prep_notes` and sets `prep_status = 'ready'` when done
- Client should poll `/api/meeting-prep` to check status

---

### POST `/api/meeting-prep/transcript`

**Upload meeting transcript**

**Request:**
```json
{
  "eventId": "evt-456",
  "title": "Sprint Planning",
  "time": "2026-03-18T10:00:00Z",
  "calendar": "work",
  "transcript": "Full transcript text..."
}
```

**Response (200):**
```json
{
  "ok": true,
  "id": "mp-123"
}
```

**Rate Limit:** 10 requests/min  
**Auth Required:** Yes  
**Notes:**
- Stores transcript in `meeting_prep.transcript`
- Fire-and-forget: sends to Jynx (openclaw) for summarization
- Fire-and-forget: embeds transcript in vector store for RAG

---

### POST `/api/meeting-prep/update`

**Update meeting prep data (called by Jynx after processing)**

**Request:**
```json
{
  "eventId": "evt-456",
  "occurrenceDate": "2026-03-18",
  "summary": "Discussed backlog, decided on sprint goals.",
  "actionItems": ["Item 1", "Item 2"]
}
```

**Response (200):**
```json
{
  "ok": true
}
```

**Rate Limit:** None  
**Auth Required:** No (intended for Jynx callbacks)  
**Notes:**
- Updates `meeting_prep` row by `event_id` + `occurrence_date`
- All fields optional except `eventId`

---

## Collections

### GET `/api/collections`

**List all collections**

**Response (200):**
```json
[
  {
    "id": "col-123",
    "title": "Books",
    "icon": "📚",
    "created_at": "2026-03-01T12:00:00.000Z",
    "entry_count": 12
  }
]
```

**Rate Limit:** None  
**Auth Required:** Yes  
**Notes:**
- Includes count of journal entries linked to each collection

---

### POST `/api/collections`

**Create a new collection**

**Request:**
```json
{
  "title": "Books",
  "icon": "📚"
}
```

**Response (200):**
```json
{
  "id": "col-1234567890",
  "title": "Books",
  "icon": "📚",
  "created_at": "2026-03-17T10:00:00.000Z"
}
```

**Rate Limit:** None  
**Auth Required:** Yes

---

## Future Log

### GET `/api/future-log`

**Fetch future log entries**

**Query Params:**
- `month` (optional): `YYYY-MM` format (filters by target month)

**Response (200):**
```json
[
  {
    "id": "fl-123",
    "target_month": "2026-04",
    "signifier": "task",
    "text": "File taxes",
    "migrated": false,
    "created_at": "2026-03-01T10:00:00.000Z"
  }
]
```

**Rate Limit:** None  
**Auth Required:** Yes  
**Notes:**
- If no month param, returns all future log entries

---

### POST `/api/future-log`

**Create a future log entry**

**Request:**
```json
{
  "target_month": "2026-04",
  "signifier": "task",
  "text": "File taxes"
}
```

**Response (200):**
```json
{
  "id": "fl-1234567890",
  "target_month": "2026-04",
  "signifier": "task",
  "text": "File taxes",
  "migrated": false,
  "created_at": "2026-03-17T10:00:00.000Z"
}
```

**Rate Limit:** None  
**Auth Required:** Yes

---

## Jira Integration

### GET `/api/integrations/jira/issues`

**Fetch assigned Jira issues**

**Query Params:**
- `refresh` (optional): `true` to bypass cache

**Response (200):**
```json
{
  "ok": true,
  "issues": [
    {
      "key": "GDEV-123",
      "summary": "Fix login bug",
      "status": "In Progress",
      "priority": "High",
      "assignee": "Morgan",
      "project": "GDEV"
    }
  ],
  "count": 1
}
```

**Rate Limit:** 30 requests/min  
**Auth Required:** Yes  
**Notes:**
- 5-minute in-memory cache (force refresh with `?refresh=true`)
- Fetches from all projects in `JIRA_PROJECTS` env var
- Returns `503` if Jira disabled

---

### POST `/api/integrations/jira/create`

**Create a Jira issue**

**Request:**
```json
{
  "summary": "Fix login bug",
  "description": "Users cannot log in with SSO"
}
```

**Response (200):**
```json
{
  "ok": true,
  "issueKey": "GDEV-123",
  "message": "Created GDEV-123"
}
```

**Rate Limit:** 10 requests/min  
**Auth Required:** Yes  
**Notes:**
- Creates issue in first project from `JIRA_PROJECTS`
- Default issue type: Task

---

### POST `/api/integrations/jira/sync`

**Update Jira issue status**

**Request:**
```json
{
  "issueKey": "GDEV-123",
  "status": "Done"
}
```

**Response (200):**
```json
{
  "ok": true,
  "message": "Updated GDEV-123 to Done"
}
```

**Rate Limit:** None  
**Auth Required:** Yes  
**Notes:**
- Transitions issue to target status
- Status must match available transition names in Jira

---

### GET `/api/integrations/jira/status`

**Get Jira integration status**

**Response (200):**
```json
{
  "ok": true,
  "jira": {
    "enabled": true,
    "url": "https://company.atlassian.net",
    "email": "user@company.com",
    "projects": ["GDEV", "ISE"],
    "cacheSize": 12,
    "lastFetch": 1710694800000
  }
}
```

**Rate Limit:** None  
**Auth Required:** Yes

---

## Semantic Search

### GET `/api/search/semantic`

**Semantic search over journal entries (vector similarity)**

**Query Params:**
- `q` (required): Search query (min 2 chars)
- `limit` (optional): Max results (default: 5, max: 20)

**Response (200):**
```json
[
  {
    "id": "je-123",
    "text": "Finished database migrations",
    "date": "2026-03-15",
    "signifier": "task",
    "collection_id": null,
    "_distance": 0.234
  }
]
```

**Rate Limit:** 30 requests/min  
**Auth Required:** Yes  
**Notes:**
- Uses LanceDB for vector similarity search
- Embeds query with Ollama (`nomic-embed-text`)
- Fallback for OmniBar when full-text search returns < 3 results
- Returns empty array on error (graceful degradation)

---

## Projects

### GET `/api/projects`

**List all projects with task counts**

**Response (200):**
```json
[
  {
    "name": "gutter",
    "total": 24,
    "open": 12,
    "completed": 10,
    "last_activity": "2026-03-17T10:00:00.000Z"
  }
]
```

**Rate Limit:** None  
**Auth Required:** Yes  
**Notes:**
- Aggregates from `tasks` table (legacy table, not journal_entries)

---

## Daily Log

### GET `/api/daily-log`

**Fetch today's journal entries (alias for `/api/journal?date=today`)**

**Response (200):**
Same as `/api/journal` GET

**Rate Limit:** None  
**Auth Required:** Yes  
**Notes:**
- Convenience endpoint
- Equivalent to `/api/journal?date=YYYY-MM-DD` with today's date

---

## Context (Meeting)

### GET `/api/context/meeting`

**Get meeting context for AI prep (internal endpoint)**

**Query Params:**
- `title` (required): Meeting title
- `calendar` (optional): Calendar name

**Response (200):**
```json
{
  "jiraIssues": [...],
  "slackMessages": [...],
  "relevantNotes": [...]
}
```

**Rate Limit:** None  
**Auth Required:** Yes  
**Notes:**
- Used internally by `lib/ollama-prep.ts`
- Not typically called directly by clients

---

## Tasks (Legacy)

### GET `/api/tasks`

**Fetch tasks from legacy `tasks` table**

**Response (200):**
```json
[
  {
    "id": "task-123",
    "text": "Fix bug",
    "status": "open",
    "project": "gutter",
    "created_at": "2026-03-01T10:00:00.000Z"
  }
]
```

**Rate Limit:** None  
**Auth Required:** Yes  
**Notes:**
- Legacy endpoint (pre-journal system)
- New entries should use `/api/journal`

---

## Rate Limiting Summary

| Endpoint | Limit | Window |
|----------|-------|--------|
| `POST /api/auth` | 5 | 1 min |
| `GET /api/journal` | 100 | 1 min |
| `POST /api/journal` | 30 | 1 min |
| `PATCH /api/journal/:id` | 50 | 1 min |
| `DELETE /api/journal/:id` | 30 | 1 min |
| `POST /api/meeting-prep/prepare` | 10 | 1 min |
| `POST /api/meeting-prep/transcript` | 10 | 1 min |
| `GET /api/integrations/jira/issues` | 30 | 1 min |
| `POST /api/integrations/jira/create` | 10 | 1 min |
| `GET /api/search/semantic` | 30 | 1 min |
| `GET /api/calendar` | 50 | 1 min |

All other endpoints: no rate limit (or enforced at middleware level).

**Implementation:** In-memory sliding window. Use Redis in production for multi-instance deployments.

---

## Error Responses

All endpoints return standard error format:

**400 Bad Request:**
```json
{
  "error": "Missing required fields"
}
```

**401 Unauthorized:**
```json
{
  "error": "Wrong password"
}
```

**429 Too Many Requests:**
```json
{
  "error": "Rate limit exceeded. Try again in 60 seconds."
}
```

**500 Internal Server Error:**
```json
{
  "error": "Failed to fetch entries"
}
```

**503 Service Unavailable:**
```json
{
  "error": "Jira integration is disabled",
  "disabled": true
}
```

---

For implementation details, see [ARCHITECTURE.md](ARCHITECTURE.md).  
For contribution guidelines, see [CONTRIBUTING.md](CONTRIBUTING.md).

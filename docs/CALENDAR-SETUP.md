# Calendar Setup (macOS Only)

Gutter integrates with Apple Calendar via the `accli` CLI tool. Read events, sync to monthly grid, and create events from natural language commands.

**Platform:** macOS only (uses macOS Calendar.app)

---

## Features

- Fetch upcoming events from Apple Calendar
- Color-coded monthly calendar grid
- Create events via natural language commands
- Day view shows events alongside journal entries
- Multi-calendar support (work, personal, family, etc.)

---

## Prerequisites

- **macOS** (Ventura 13+ recommended)
- **Calendar.app** with at least one calendar
- **Node.js** (for npm/npx)

---

## Step 1: Install accli

```bash
npm install -g @joargp/accli
```

**Verify installation:**
```bash
npx @joargp/accli --version
```

---

## Step 2: Grant Calendar Permissions

The first time you run `accli`, macOS will prompt for Calendar access.

**Test access:**
```bash
npx @joargp/accli calendars list
```

**Expected output:**
```
Calendar
Family Calendar
Work
Home
JW
School
```

**If permission denied:**
1. Go to **System Settings → Privacy & Security → Calendars**
2. Ensure Terminal (or your terminal app) is checked
3. Restart terminal and try again

---

## Step 3: Find Your Calendar Names

```bash
npx @joargp/accli calendars list
```

Note the **exact names** (case-sensitive).

**Examples:**
- `Calendar` (default macOS calendar)
- `Work`
- `Family Calendar`
- `Home`
- `JW`
- `School`

---

## Step 4: Configure Environment Variables

Add to your `.env` file:

```bash
# Apple Calendar Integration (macOS only)
CALENDARS=Calendar,Family Calendar,Work,Home,JW,School
CALENDAR_ENABLED=true
```

**Notes:**
- Comma-separated list
- Exact names (case-sensitive)
- No quotes needed
- No spaces around commas

**Single calendar:**
```bash
CALENDARS=Calendar
```

---

## Step 5: Test Integration

```bash
# Restart dev server
bun run dev

# Test calendar status:
curl -sk http://localhost:3000/api/journal/calendar | jq
```

**Expected output:**
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

---

## Step 6: Fetch Events

```bash
# Next 7 days
curl -sk http://localhost:3000/api/calendar | jq

# Specific month
curl -sk 'http://localhost:3000/api/calendar?month=2026-03' | jq
```

**Expected output:**
```json
{
  "events": [
    {
      "id": "evt-abc123",
      "title": "Meeting with Thiago",
      "startDate": "2026-03-18T15:00:00Z",
      "endDate": "2026-03-18T16:00:00Z",
      "calendar": "Work",
      "allDay": false
    }
  ]
}
```

---

## Usage Examples

### Natural Language Event Creation

From the journal input:

```
meeting with Thiago at 3pm tomorrow
```
→ Creates journal entry + Apple Calendar event

```
dentist appointment March 25 at 10am
```
→ Creates appointment in Calendar

```
standup 9am daily
```
→ Creates recurring event (future feature)

### Manual API Calls

**Create event:**
```bash
curl -sk http://localhost:3000/api/journal/calendar \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "summary": "Meeting with Thiago",
    "date": "2026-03-18",
    "startTime": "15:00",
    "endTime": "16:00",
    "calendar": "work",
    "location": "Zoom",
    "description": "Discuss autopilot review"
  }'
```

**All-day event:**
```bash
curl -sk http://localhost:3000/api/journal/calendar \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "summary": "Vacation",
    "date": "2026-04-01",
    "allDay": true,
    "calendar": "personal"
  }'
```

---

## Calendar Names Mapping

The NL command interpreter maps keywords to calendar names:

| Keyword | Maps To |
|---------|---------|
| `work`, `meeting`, `standup`, `sprint` | `work` |
| `family`, `dinner`, `birthday` | `family` |
| `jw`, `ministry`, `service`, `meeting (jw context)` | `jw` |
| `school`, `class`, `homework` | `school` |
| (default) | `home` |

**Customize default calendar:**
```bash
DEFAULT_CALENDAR=personal
```

---

## Cache Behavior

- **Duration:** 5 minutes
- **Scope:** In-memory (per server instance)
- **Purpose:** Avoid re-fetching events on every request

**How it works:**
- First request fetches from accli
- Subsequent requests within 5 min use cache
- Cache key: `from-to` date range

---

## Troubleshooting

### "Calendar integration is disabled"

**Cause:** `CALENDAR_ENABLED=false` or missing `CALENDARS` env var  
**Fix:** Set both in `.env`:
```bash
CALENDAR_ENABLED=true
CALENDARS=Calendar,Work
```

### "accli: command not found"

**Cause:** accli not installed or not in PATH  
**Fix:**
```bash
npm install -g @joargp/accli
# Verify:
which accli
npx @joargp/accli --version
```

### "Permission denied" when fetching events

**Cause:** macOS Calendar permissions not granted  
**Fix:**
1. **System Settings → Privacy & Security → Calendars**
2. Check Terminal (or iTerm, Warp, etc.)
3. Restart terminal
4. Test: `npx @joargp/accli calendars list`

### Events not appearing

**Possible causes:**
1. Calendar name mismatch (case-sensitive)
2. Empty calendar
3. Date range outside event dates

**Debug:**
```bash
# List calendar names
npx @joargp/accli calendars list

# Fetch events directly
npx @joargp/accli events "Calendar" --from 2026-03-01 --to 2026-03-31 --json

# Check Gutter status
curl -sk http://localhost:3000/api/journal/calendar | jq
```

### Events created in wrong calendar

**Cause:** Default calendar not set or NL command keyword mismatch  
**Fix:**
```bash
DEFAULT_CALENDAR=work
```

Or specify explicitly in API call:
```json
{
  "calendar": "work",
  ...
}
```

### Timezone issues

**Cause:** accli uses system timezone  
**Fix:** Ensure macOS timezone is correct (System Settings → General → Date & Time)

---

## Multi-Calendar Configuration

Gutter supports multiple calendars:

```bash
CALENDARS=Calendar,Work,Family Calendar,JW,School,Personal
```

**How it works:**
- Fetches events from **all** configured calendars
- Events displayed with calendar name/color
- New events created in **default** calendar (or specified calendar)

**Color coding:**
- Calendar colors preserved from Calendar.app
- Displayed in monthly grid and day view

---

## Recurring Events

**Current support:**
- Reads recurring events from Calendar.app
- Each occurrence appears as separate event

**Creating recurring events:**
- Not yet supported via Gutter
- Create manually in Calendar.app

**Future feature:**
```
standup 9am daily
```
→ Will create recurring event

**Track progress:** Issue #TODO

---

## Event Reminders

**Not supported:**
- Gutter cannot set event reminders
- Set reminders manually in Calendar.app

---

## Event Invites

**Not supported:**
- Gutter cannot send calendar invites
- Use Calendar.app for multi-attendee events

---

## Advanced Configuration

### Custom accli Path

If accli installed in non-standard location:

```bash
ACCLI_CMD=/usr/local/bin/accli
```

### Retry Logic

Calendar creation retries on failure:

```bash
# Default values (in lib/calendar.ts)
RETRY_ATTEMPTS=3
RETRY_DELAY_MS=1000
```

Not yet configurable via env vars. Feature request: #TODO

---

## Disabling Calendar Integration

```bash
CALENDAR_ENABLED=false
```

Or remove/comment out:
```bash
# CALENDARS=Calendar,Work
# CALENDAR_ENABLED=true
```

**Verify:**
```bash
curl -sk http://localhost:3000/api/journal/calendar
```

Should return:
```json
{
  "enabled": false,
  "message": "Calendar integration is disabled"
}
```

---

## Alternative: Google Calendar

**Not yet supported.**

Planned integration via Google Calendar CLI or API.

**Workarounds:**
1. Sync Google Calendar to Apple Calendar (iCloud sync)
2. Wait for native Google Calendar support

**Track progress:** Issue #TODO

---

## Alternative: Outlook Calendar

**Not yet supported.**

Planned integration via Microsoft Graph API or Outlook CLI.

**Track progress:** Issue #TODO

---

## API Reference

See [API.md](../API.md) for full endpoint documentation:

- `GET /api/calendar` — Fetch upcoming events
- `GET /api/calendar/events` — Fetch events for date range
- `POST /api/journal/calendar` — Create calendar event
- `GET /api/journal/calendar` — Calendar integration status

---

For questions or issues, open a GitHub issue or discussion.

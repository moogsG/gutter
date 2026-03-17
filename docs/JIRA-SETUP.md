# Jira Setup

Gutter integrates with Atlassian Jira for issue tracking. Pull open tickets into your daily context, create issues from journal entries, and update status without leaving the app.

---

## Features

- Fetch assigned issues across multiple Jira projects
- 5-minute in-memory cache (reduces API hammering)
- Create new issues from journal entries
- Update issue status via natural language commands
- Jira context in AI meeting prep

---

## Prerequisites

- Atlassian Jira Cloud account
- Access to at least one Jira project
- Permission to create API tokens

---

## Step 1: Generate API Token

1. Go to https://id.atlassian.com/manage-profile/security/api-tokens
2. Click **Create API token**
3. Name: `Gutter Integration`
4. Copy the token — you won't see it again

---

## Step 2: Find Your Jira URL

Your Jira instance URL format:
```
https://YOUR-COMPANY.atlassian.net
```

Example: `https://acme-corp.atlassian.net`

---

## Step 3: Get Project Keys

Project keys are short codes (e.g., `GDEV`, `ISE`, `PROJ`).

**Find them:**
1. Go to Jira → Projects
2. Click on each project
3. Look at the URL: `https://company.atlassian.net/jira/software/projects/GDEV/board`
   - Project key: `GDEV`

---

## Step 4: Configure Environment Variables

Add to your `.env` file:

```bash
# Jira Integration
JIRA_URL=https://your-company.atlassian.net
JIRA_EMAIL=your-email@company.com
JIRA_API_TOKEN=your-api-token-here
JIRA_PROJECTS=GDEV,ISE,PROJ
```

**Multi-project support:**
- Comma-separated project keys
- No spaces
- All caps

---

## Step 5: Test Integration

```bash
# Restart dev server
bun run dev

# Test in browser or via curl:
curl -sk http://localhost:3000/api/integrations/jira/status | jq
```

**Expected output:**
```json
{
  "ok": true,
  "jira": {
    "enabled": true,
    "url": "https://your-company.atlassian.net",
    "email": "you@company.com",
    "projects": ["GDEV", "ISE"],
    "cacheSize": 0,
    "lastFetch": null
  }
}
```

---

## Step 6: Fetch Issues

```bash
curl -sk http://localhost:3000/api/integrations/jira/issues | jq
```

**Expected output:**
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

---

## Usage Examples

### Natural Language Commands

From the journal input:

```
done with GDEV-123
```
→ Marks GDEV-123 as Done in Jira

```
create a jira ticket: Fix calendar sync bug
```
→ Creates new issue in first configured project

### Manual API Calls

**Create issue:**
```bash
curl -sk http://localhost:3000/api/integrations/jira/create \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "summary": "Fix calendar timezone bug",
    "description": "Events are created in UTC instead of local time"
  }'
```

**Update status:**
```bash
curl -sk http://localhost:3000/api/integrations/jira/sync \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "issueKey": "GDEV-123",
    "status": "Done"
  }'
```

---

## Cache Behavior

- **Duration:** 5 minutes
- **Scope:** In-memory (per server instance)
- **Bypass:** Add `?refresh=true` to issues endpoint

**Force refresh:**
```bash
curl -sk http://localhost:3000/api/integrations/jira/issues?refresh=true
```

---

## Troubleshooting

### "Jira integration is disabled"

**Cause:** Missing env vars  
**Fix:** Ensure all four vars are set (`JIRA_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN`, `JIRA_PROJECTS`)

### "401 Unauthorized" from Jira API

**Cause:** Invalid credentials  
**Fix:**
1. Verify email matches Jira account
2. Regenerate API token
3. Check for trailing spaces in `.env`

### "No issues found"

**Possible causes:**
1. No issues assigned to you in configured projects
2. Project keys incorrect (check capitalization)
3. Projects exist but you're not a member

**Debug:**
```bash
# Check status endpoint
curl -sk http://localhost:3000/api/integrations/jira/status | jq

# Force refresh
curl -sk http://localhost:3000/api/integrations/jira/issues?refresh=true | jq
```

### "Rate limit exceeded"

**Cause:** Too many requests to Jira API  
**Fix:** Wait 60 seconds. The 5-minute cache should prevent this in normal use.

### Issues not appearing in meeting prep

**Cause:** Meeting prep searches by JQL query (title keywords)  
**Fix:** Jira issues are pulled contextually based on meeting title. Ensure issue summaries contain relevant keywords.

---

## Multi-Project Configuration

Gutter supports multiple Jira projects:

```bash
JIRA_PROJECTS=GDEV,ISE,FRONTEND,BACKEND,INFRA
```

**How it works:**
- Fetches assigned issues from **all** configured projects
- Issues displayed with project prefix (e.g., `GDEV-123`)
- New issues created in **first** project by default

**Customize default project (future):**
Not yet supported. Feature request: #TODO

---

## Security Best Practices

1. **Never commit API tokens** — add `.env` to `.gitignore`
2. **Use dedicated token** — create separate token for Gutter (easy to revoke)
3. **Rotate tokens periodically** — Atlassian recommends 90-day rotation
4. **Limit permissions** — use a service account with minimal permissions if sharing

---

## API Reference

See [API.md](../API.md) for full endpoint documentation:

- `GET /api/integrations/jira/issues` — Fetch assigned issues
- `POST /api/integrations/jira/create` — Create new issue
- `POST /api/integrations/jira/sync` — Update issue status
- `GET /api/integrations/jira/status` — Integration health check

---

## Known Limitations

- **No custom fields** — Only standard fields supported (summary, status, priority, assignee)
- **Single issue type** — Creates "Task" issues only (no bugs, epics, stories)
- **No comments** — Cannot read or post issue comments
- **No attachments** — Cannot upload files to issues
- **No sprints** — No sprint planning integration

**Feature requests:** Open an issue on GitHub

---

## Advanced: Custom JQL Queries (future)

Not yet supported. Planned feature:

```bash
JIRA_CUSTOM_JQL='project = GDEV AND status != Done AND assignee = currentUser()'
```

This would allow:
- Team-wide issue filtering
- Custom status workflows
- Priority-based queries

**Track progress:** Issue #TODO

---

## Disabling Jira

To disable Jira integration:

```bash
# Option 1: Remove all env vars
# (Comment out or delete)

# Option 2: Leave empty
JIRA_URL=
JIRA_EMAIL=
JIRA_API_TOKEN=
JIRA_PROJECTS=
```

Check status:
```bash
curl -sk http://localhost:3000/api/integrations/jira/status
```

Should return:
```json
{
  "ok": true,
  "jira": {
    "enabled": false
  }
}
```

---

For questions or issues, open a GitHub issue or discussion.

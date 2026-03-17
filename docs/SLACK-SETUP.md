# Slack Setup

Gutter integrates with Slack to pull channel context into AI meeting prep. Surface recent messages from relevant channels when preparing for meetings.

**Use case:** Automatically gather conversation context (blockers, updates, decisions) from Slack channels before team meetings.

---

## Features

- Search Slack channels for meeting-related context
- Include recent messages in AI-generated meeting prep
- Multi-channel support
- Read-only access (no posting)

---

## Prerequisites

- Slack workspace admin access (or permission to create apps)
- Access to channels you want to read

---

## Step 1: Create Slack App

1. Go to https://api.slack.com/apps
2. Click **Create New App**
3. Choose **From scratch**
4. **App Name:** `Gutter Integration`
5. **Workspace:** Select your workspace
6. Click **Create App**

---

## Step 2: Configure Bot Permissions

1. In your new app, go to **OAuth & Permissions** (left sidebar)
2. Scroll to **Scopes → Bot Token Scopes**
3. Add the following scopes:
   - `channels:history` — Read public channel messages
   - `channels:read` — View basic channel info
   - `groups:history` — Read private channel messages (optional)
   - `groups:read` — View private channel info (optional)

**Why these scopes?**
- Gutter only reads messages (no posting)
- Needed to search channel history for context

---

## Step 3: Install App to Workspace

1. Scroll to top of **OAuth & Permissions** page
2. Click **Install to Workspace**
3. Review permissions
4. Click **Allow**

**Result:** You'll see a **Bot User OAuth Token** starting with `xoxb-`

---

## Step 4: Copy Bot Token

Copy the **Bot User OAuth Token** (starts with `xoxb-`).

**Example:**
```
xoxb-your-token-here
```

**Security:** Treat this like a password. Never commit to git.

---

## Step 5: Add Bot to Channels

The bot needs to be invited to each channel you want to read.

**For each channel:**
1. Open the channel in Slack
2. Type: `/invite @Gutter Integration`
3. Or: Channel settings → Integrations → Add apps → Gutter Integration

**Required:** Do this for every channel in your `SLACK_CHANNELS` env var.

---

## Step 6: Get Channel IDs

Slack uses internal IDs (not names) to identify channels.

**Option 1: Via Slack UI**
1. Open channel in Slack
2. Click channel name at top
3. Scroll to bottom → **Channel ID** (e.g., `C029BN2FBPD`)

**Option 2: Via API**
```bash
curl -H "Authorization: Bearer xoxb-your-token-here" \
  https://slack.com/api/conversations.list | jq '.channels[] | {name, id}'
```

---

## Step 7: Configure Environment Variables

Add to your `.env` file:

```bash
# Slack Integration
SLACK_BOT_TOKEN=xoxb-your-token-here
SLACK_CHANNELS=C029BN2FBPD|dev-chat,C027SHEDUET|senior-devs,C028ABCDEFG|engineering
```

**Format:**
```
SLACK_CHANNELS=CHANNEL_ID|display-name,CHANNEL_ID|display-name,...
```

**Notes:**
- Pipe (`|`) separates ID from name
- Comma (`,`) separates channels
- No spaces
- Display name is for your reference (used in logs/UI)

**Example (single channel):**
```bash
SLACK_CHANNELS=C029BN2FBPD|team-chat
```

---

## Step 8: Test Integration

```bash
# Restart dev server
bun run dev

# Test (backend only — no public endpoint)
# Check logs for Slack errors when generating meeting prep
```

**Slack integration is used automatically:**
- When generating meeting prep (`/api/meeting-prep/prepare`)
- Ollama calls `searchSlack()` tool with meeting keywords
- Returns recent messages from relevant channels

---

## Usage

Slack integration is **transparent** — it's used automatically during meeting prep generation.

**How it works:**
1. User clicks "Prepare" on upcoming meeting
2. Ollama analyzes meeting title (e.g., "Sprint Planning")
3. Ollama calls `searchSlack(query)` with keywords (e.g., "sprint planning backlog")
4. Gutter fetches recent messages from all configured channels
5. Ollama includes relevant Slack context in prep notes

**Example prep notes:**
```markdown
## Recent Slack Discussion
- Alice mentioned sprint backlog needs refinement (2 days ago)
- Bob flagged auth bug as blocker (yesterday)
- Team agreed on new estimation process (3 days ago)
```

---

## Channel Selection Strategy

**Which channels to configure?**

**Include:**
- Team channels (`#dev-chat`, `#engineering`)
- Project-specific channels (`#frontend`, `#backend`)
- Standup/sync channels (`#daily-standup`)

**Exclude:**
- High-volume channels (`#general`, `#random`)
- Off-topic channels (`#memes`, `#lunch`)
- Channels with sensitive info (unless truly needed)

**Why?** High-volume channels add noise. Focus on channels with relevant technical/project discussion.

---

## Privacy & Security

- **Read-only:** Gutter never posts to Slack
- **Local processing:** Message context processed locally via Ollama
- **No storage:** Slack messages not stored in Gutter DB (only used in meeting prep generation)
- **Bot visibility:** Team members can see bot is in channel

**Best practices:**
1. Use dedicated Slack app (easy to revoke)
2. Only add bot to relevant channels
3. Inform team members (transparency)
4. Never commit `SLACK_BOT_TOKEN` to git

---

## Troubleshooting

### "Slack token not configured"

**Cause:** Missing `SLACK_BOT_TOKEN` env var  
**Fix:** Add to `.env`:
```bash
SLACK_BOT_TOKEN=xoxb-your-token
```

### "Channel not found" errors in logs

**Cause:** Bot not added to channel, or channel ID incorrect  
**Fix:**
1. Verify channel ID is correct
2. Invite bot: `/invite @Gutter Integration`
3. Check bot permissions (OAuth scopes)

### No Slack context in meeting prep

**Possible causes:**
1. Bot not in any configured channels
2. No recent messages matching keywords
3. Ollama didn't call `searchSlack()` tool

**Debug:**
- Check meeting prep logs for Slack tool calls
- Verify channels have recent messages
- Try more specific meeting titles (better keyword matching)

### "invalid_auth" error

**Cause:** Token expired or revoked  
**Fix:**
1. Go to https://api.slack.com/apps
2. Select your app
3. **OAuth & Permissions** → Reinstall to Workspace
4. Copy new token

### Missing private channel messages

**Cause:** Bot needs additional permissions  
**Fix:**
1. Add scopes: `groups:history`, `groups:read`
2. Reinstall app to workspace
3. Invite bot to private channel

---

## Advanced: Custom Search Query (future)

Not yet configurable. Currently:
- Searches last 7 days of messages
- Filters by meeting title keywords
- Returns top 20 relevant messages

**Future feature:** Custom time window and message limits

**Track progress:** Issue #TODO

---

## Rate Limiting

Slack API has rate limits:
- ~1 request/second per method
- Gutter batches searches to minimize calls
- In-memory caching (5 min) reduces redundant requests

**If you hit rate limits:**
- Reduce number of configured channels
- Ensure channels have bot access (avoids retry loops)

---

## Disabling Slack Integration

```bash
# Option 1: Remove env vars
# (Comment out or delete)

# Option 2: Leave empty
SLACK_BOT_TOKEN=
SLACK_CHANNELS=
```

**Verify:**
- Meeting prep still works, but without Slack context
- Only Jira and journal entries used for context

---

## Alternative: Discord, Teams, etc.

**Not yet supported.**

Planned integrations:
- Discord (via bot)
- Microsoft Teams (via Graph API)
- Mattermost

**Track progress:** Issue #TODO

---

## API Reference

Slack integration is internal (no public endpoints).

**Used by:**
- `lib/ollama-prep.ts` → `searchSlack()` tool
- Called automatically during meeting prep generation

**See:**
- [ARCHITECTURE.md](../ARCHITECTURE.md) — Meeting prep flow
- [API.md](../API.md) — `/api/meeting-prep/prepare` endpoint

---

For questions or issues, open a GitHub issue or discussion.

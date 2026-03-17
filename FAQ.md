# FAQ

Common issues and solutions for Gutter.

---

## Installation & Setup

### Build fails with "module not found"

**Symptom:**
```
error: Cannot find module '@/lib/db'
```

**Solution:**
```bash
rm -rf node_modules bun.lockb
bun install
bun run build
```

Bun's lockfile can sometimes get out of sync. Full reinstall fixes it.

---

### `bun install` fails on macOS M1/M2

**Symptom:**
```
error: Unsupported architecture
```

**Solution:**
Make sure you're using the latest Bun:
```bash
curl -fsSL https://bun.sh/install | bash
bun --version  # Should be 1.0.0+
```

If still failing, try Rosetta:
```bash
arch -x86_64 bun install
```

---

### Build succeeds but `bun run dev` crashes

**Symptom:**
```
error: Database connection failed
```

**Solution:**
Check `.env` file exists:
```bash
ls -la .env
```

If missing:
```bash
cp .env.example .env
# Edit .env with your config
```

Ensure `DATABASE_PATH` is writable:
```bash
touch gutter-journal.db
chmod 644 gutter-journal.db
```

---

## Authentication

### How do I generate a bcrypt hash?

**Using Node.js:**
```bash
node -e "console.log(require('bcryptjs').hashSync('your-password', 10))"
```

**Using Bun:**
```bash
bun -e "import bcrypt from 'bcryptjs'; console.log(bcrypt.hashSync('your-password', 10))"
```

**Using online tool (not recommended for production):**
https://bcrypt-generator.com/

Copy the hash and set `AUTH_PASSWORD_HASH` in `.env`.

---

### Login always says "wrong password"

**Check hash format:**
```bash
grep AUTH_PASSWORD_HASH .env
```

Should look like:
```
AUTH_PASSWORD_HASH=$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy
```

**Common mistakes:**
- Hash must start with `$2a$`, `$2b$`, or `$2y$`
- No quotes around the hash
- No spaces before/after `=`

**Regenerate hash:**
```bash
bun -e "import bcrypt from 'bcryptjs'; console.log(bcrypt.hashSync('your-new-password', 10))"
```

Update `.env` and restart server.

---

### Can I disable authentication?

Yes. Leave `AUTH_PASSWORD_HASH` empty or remove it from `.env`:

```env
# AUTH_PASSWORD_HASH=
AUTH_SECRET=your-random-secret-key
```

App will skip login screen. **Not recommended for networked deployments.**

---

## Ollama / AI Features

### "Ollama connection refused"

**Symptom:**
Meeting prep and AI commands don't work.

**Check if Ollama is running:**
```bash
curl http://localhost:11434/api/tags
```

**If fails, start Ollama:**
```bash
ollama serve
```

Leave running in a separate terminal.

**For non-standard Ollama URL:**
```env
OLLAMA_URL=http://192.168.1.100:11434
```

---

### Meeting prep gets stuck on "preparing"

**Symptoms:**
- Meeting prep status stays "preparing" forever
- No prep notes generated

**Causes:**
1. Ollama not running
2. Model doesn't support tool calling
3. Model not pulled

**Solutions:**

**1. Check Ollama status:**
```bash
curl http://localhost:11434/api/tags
```

**2. Verify model:**
```bash
ollama list
```

Should show `qwen3:latest` (or your `OLLAMA_MODEL`).

**3. Pull model if missing:**
```bash
ollama pull qwen3:latest
```

**4. Test tool calling:**
```bash
curl http://localhost:11434/api/generate -d '{
  "model": "qwen3:latest",
  "prompt": "What is 2+2?",
  "stream": false
}'
```

Should return JSON response. If fails, model is broken.

**5. Try alternative model:**
```env
OLLAMA_MODEL=qwen2.5-coder:7b
```

---

### Natural language commands not working

**Symptom:**
Typing "buy milk tomorrow" creates entry with literal text instead of parsing as command.

**Check command model:**
```bash
grep JOURNAL_COMMAND_MODEL .env
```

Should be:
```env
JOURNAL_COMMAND_MODEL=qwen3:latest
```

**Verify model is pulled:**
```bash
ollama list | grep qwen3
```

**Restart Ollama:**
```bash
# Kill existing
pkill ollama
# Restart
ollama serve
```

**Check logs for errors:**
```bash
bun run dev
# Look for "Command interpreter error" in logs
```

---

## Calendar Integration (macOS)

### "accli: command not found"

**Install accli globally:**
```bash
npm install -g @joargp/accli
```

**Verify installation:**
```bash
which accli
# Should print: /usr/local/bin/accli or similar
```

**If still not found:**
```bash
export PATH="/usr/local/bin:$PATH"
# Add to ~/.zshrc or ~/.bashrc to persist
```

---

### Calendar permissions denied

**Symptom:**
```
error: Calendar access denied
```

**Grant permissions:**

1. Run accli to trigger permission prompt:
   ```bash
   npx @joargp/accli calendars list
   ```

2. macOS will show a dialog → Click **OK**

3. If dialog doesn't appear, grant manually:
   - **System Settings → Privacy & Security → Calendars**
   - Check the box next to **Terminal** (or **iTerm**, **VS Code**, etc.)

4. Restart Gutter:
   ```bash
   bun run dev
   ```

---

### Calendar events not showing

**Check calendar names in `.env`:**
```bash
grep CALENDARS .env
```

**List available calendars:**
```bash
npx @joargp/accli calendars list
```

**Update `.env` with exact names (case-sensitive):**
```env
CALENDARS=Calendar,Family Calendar,Work
```

**Restart server:**
```bash
bun run dev
```

---

### "Calendar integration disabled"

**On Linux:** Apple Calendar is macOS-only. Set:
```env
CALENDAR_ENABLED=false
```

**On macOS:** Check that `accli` is installed and accessible:
```bash
which accli
npx @joargp/accli calendars list
```

---

## Jira Integration

### Jira issues not loading

**Verify all 4 Jira variables are set:**
```bash
grep JIRA .env
```

Should have:
```env
JIRA_URL=https://yourcompany.atlassian.net
JIRA_EMAIL=you@company.com
JIRA_API_TOKEN=ATATT3xFfGF0...
JIRA_PROJECTS=GDEV,ISE
```

**Test API token manually:**
```bash
curl -u "you@company.com:ATATT3xFfGF0..." \
  "https://yourcompany.atlassian.net/rest/api/3/myself"
```

Should return your user info. If 401 error, token is invalid.

**Generate new token:**
1. Go to https://id.atlassian.com/manage-profile/security/api-tokens
2. Click "Create API token"
3. Copy token to `.env`
4. Restart Gutter

---

### "Jira integration disabled"

**Cause:** One or more Jira env variables missing.

**Fix:** Set all 4 variables in `.env`:
```env
JIRA_URL=https://yourcompany.atlassian.net
JIRA_EMAIL=you@company.com
JIRA_API_TOKEN=your-token-here
JIRA_PROJECTS=GDEV,ISE
```

Restart server.

---

### Jira API rate limits

**Symptom:**
```
error: Jira API rate limit exceeded
```

**Solution:**
Gutter caches Jira issues for 5 minutes to reduce API calls. Wait 5 minutes or force refresh:

```bash
# Force sync via API
curl -X POST http://localhost:3000/api/integrations/jira/sync
```

**Reduce polling frequency:**
Edit frontend code to poll less often (default: 30 seconds).

---

## Voice Transcription

### Whisper transcription fails

**Check Whisper installation:**
```bash
which whisper
```

Should print path to binary (e.g., `/usr/local/bin/whisper`).

**If not found:**
```bash
# macOS
brew install whisper-cpp

# Linux — compile from source
git clone https://github.com/ggerganov/whisper.cpp
cd whisper.cpp
make
sudo cp main /usr/local/bin/whisper
```

---

### "Whisper model not found"

**Check model path in `.env`:**
```bash
grep WHISPER_MODEL_PATH .env
```

**Download model:**
```bash
mkdir -p ~/.cache/whisper
curl -L https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin \
  -o ~/.cache/whisper/ggml-base.en.bin
```

**Update `.env`:**
```env
WHISPER_MODEL_PATH=~/.cache/whisper/ggml-base.en.bin
```

**Note:** Use absolute path if `~` doesn't expand:
```env
WHISPER_MODEL_PATH=/Users/yourname/.cache/whisper/ggml-base.en.bin
```

---

### "ffmpeg not found"

Whisper requires ffmpeg for audio conversion.

**Install ffmpeg:**
```bash
# macOS
brew install ffmpeg

# Linux (Ubuntu/Debian)
sudo apt install ffmpeg

# Linux (Fedora/RHEL)
sudo dnf install ffmpeg
```

**Verify:**
```bash
which ffmpeg
```

---

### Voice button does nothing

**Check browser console for errors:**
1. Open DevTools (F12 or Cmd+Option+I)
2. Click voice button
3. Look for errors

**Common issues:**

**1. Microphone permissions denied:**
- Browser will prompt for mic access
- Click **Allow**
- Refresh page

**2. HTTPS required:**
- WebRTC requires HTTPS in production
- In dev, `localhost` is allowed over HTTP

**3. Whisper not configured:**
- Check `.env` has `WHISPER_MODEL_PATH`
- Verify model file exists

---

## Bun vs Node.js Compatibility

### Can I use Node.js instead of Bun?

**Short answer:** No. Gutter is built for Bun.

**Long answer:**
Bun provides:
- Native TypeScript support (no build step for dev)
- Faster dependency installs
- Built-in test runner
- SQLite bindings work better

You can try Node.js, but expect issues with:
- `better-sqlite3` bindings
- Import paths (`@/` aliases)
- Environment variable loading

**Recommendation:** Install Bun. It's fast and painless.

---

### "Bun not found" after installation

**Check PATH:**
```bash
echo $PATH | grep .bun
```

Should include `~/.bun/bin`.

**If missing, add to shell config:**
```bash
# ~/.zshrc or ~/.bashrc
export PATH="$HOME/.bun/bin:$PATH"
```

**Reload shell:**
```bash
source ~/.zshrc  # or ~/.bashrc
```

**Verify:**
```bash
bun --version
```

---

## Database Issues

### Database locked

**Symptom:**
```
error: database is locked
```

**Cause:** SQLite file is open in another process.

**Solution:**
1. Stop all Gutter instances
2. Check for orphaned processes:
   ```bash
   lsof gutter-journal.db
   ```
3. Kill any processes holding the file:
   ```bash
   kill <PID>
   ```
4. Restart Gutter:
   ```bash
   bun run dev
   ```

---

### Corrupted database

**Symptom:**
```
error: database disk image is malformed
```

**Solution:**

**1. Restore from backup:**
```bash
cp backups/gutter-journal.db-2026-03-17.backup gutter-journal.db
```

**2. If no backup, try SQLite recovery:**
```bash
sqlite3 gutter-journal.db ".recover" > recovered.sql
sqlite3 gutter-journal-new.db < recovered.sql
mv gutter-journal.db gutter-journal.db.broken
mv gutter-journal-new.db gutter-journal.db
```

**3. Last resort — start fresh:**
```bash
mv gutter-journal.db gutter-journal.db.broken
bun run dev  # Creates new DB
```

**Prevent corruption:**
- Don't kill Bun process forcefully (`kill -9`)
- Let server shut down gracefully (Ctrl+C)
- Enable WAL mode (already enabled by default)

---

### Backups not working

**Check backup directory:**
```bash
ls -la backups/
```

**If empty:**
```bash
grep JOURNAL_BACKUP_DIR .env
```

**Create directory if missing:**
```bash
mkdir -p backups
chmod 755 backups
```

**Manual backup:**
```bash
sqlite3 gutter-journal.db ".backup backups/manual-backup-$(date +%Y-%m-%d).db"
```

---

## Performance

### Slow initial load

**Cause:** Large journal database.

**Solutions:**

**1. Vacuum database:**
```bash
sqlite3 gutter-journal.db "VACUUM;"
```

**2. Rebuild indexes:**
```bash
sqlite3 gutter-journal.db "REINDEX;"
```

**3. Archive old entries:**
```bash
# Export entries older than 1 year
sqlite3 gutter-journal.db \
  ".mode csv" \
  ".output archive-2025.csv" \
  "SELECT * FROM journal_entries WHERE date < '2025-01-01';"

# Delete from DB (backup first!)
sqlite3 gutter-journal.db \
  "DELETE FROM journal_entries WHERE date < '2025-01-01';"
```

---

### High memory usage

**Ollama models consume RAM:**
- 7B model: ~8GB RAM
- Quantized models: ~4GB RAM

**Reduce memory:**

**1. Use quantized model:**
```env
OLLAMA_MODEL=qwen3:7b-q4_0
```

**2. Stop Ollama when not needed:**
```bash
pkill ollama
```

**3. Use smaller model:**
```env
OLLAMA_MODEL=qwen2.5-coder:3b
```

---

## Miscellaneous

### Port 3000 already in use

**Find process using port:**
```bash
lsof -i :3000
```

**Kill it:**
```bash
kill <PID>
```

**Or use different port:**
```env
PORT=8080
```

---

### Dark mode not working

**Gutter is always dark mode.** The `DEFAULT_THEME` setting only changes color palette (cyberpink, tokyo-night, rose-pine).

If you want light mode, fork the project and customize `globals.css`.

---

### Search not finding entries

**Full-text search requires keywords:**
```
search query: "buy milk"
```

**Semantic search (if enabled) uses embeddings:**
```
GET /api/search/semantic?q=groceries
```

**Rebuild search index:**
```bash
sqlite3 gutter-journal.db "REINDEX;"
```

---

### PWA install doesn't work

**Requirements:**
- HTTPS (or `localhost`)
- Service worker registered
- Valid manifest.json

**In dev:** PWA install is disabled. Deploy to production with HTTPS.

---

## Still Stuck?

**Check logs:**
```bash
bun run dev
# Watch for errors on startup
```

**Test API manually:**
```bash
# Health check
curl http://localhost:3000/api/journal?date=2026-03-17
```

**File an issue:**
- Include Bun version: `bun --version`
- Include OS: `uname -a`
- Include relevant `.env` variables (redact secrets)
- Include error messages from logs

---

## Related Documentation

- [INSTALLATION.md](INSTALLATION.md) — Setup guide
- [CONFIGURATION.md](CONFIGURATION.md) — All env variables
- [docs/JIRA-SETUP.md](docs/JIRA-SETUP.md) — Jira integration
- [docs/SLACK-SETUP.md](docs/SLACK-SETUP.md) — Slack integration
- [docs/OLLAMA-SETUP.md](docs/OLLAMA-SETUP.md) — Ollama setup
- [docs/CALENDAR-SETUP.md](docs/CALENDAR-SETUP.md) — Calendar integration
- [docs/WHISPER-SETUP.md](docs/WHISPER-SETUP.md) — Voice transcription

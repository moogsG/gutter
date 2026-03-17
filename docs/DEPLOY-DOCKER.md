# Docker Deployment Guide

Deploy Gutter using Docker and Docker Compose for a containerized, reproducible environment.

---

## Prerequisites

- Docker 20.10+ and Docker Compose v2+
- At least 4GB free disk space (for images + Ollama models)
- (Optional) NVIDIA GPU + nvidia-docker for GPU-accelerated Ollama

---

## Quick Start

### 1. Clone Repository

```bash
git clone <repo-url>
cd gutter
```

### 2. Set Up Environment

```bash
cp .env.example .env
```

Edit `.env` and configure:

```bash
# Auth (required)
AUTH_PASSWORD=your-secure-password
AUTH_SECRET=your-random-secret-string

# Jira (optional)
JIRA_URL=https://yourcompany.atlassian.net
JIRA_EMAIL=you@company.com
JIRA_API_TOKEN=your-jira-api-token
JIRA_PROJECTS=PROJ1,PROJ2

# Slack (optional)
SLACK_BOT_TOKEN=xoxb-your-token
SLACK_CHANNELS=C123|general,C456|dev

# Ollama models (optional, defaults to qwen3:latest)
OLLAMA_MODEL=qwen3:latest
JOURNAL_COMMAND_MODEL=qwen3:latest
```

### 3. Create Data Directories

```bash
mkdir -p data backups
```

### 4. Start Services

```bash
docker compose up -d
```

This will:
- Build the Gutter image
- Pull Ollama image
- Start both services
- Create a shared network

### 5. Pull Ollama Model

Once Ollama is running, pull your desired model:

```bash
docker exec -it gutter-ollama ollama pull qwen3
```

Or use a different model:

```bash
docker exec -it gutter-ollama ollama pull llama3.2
docker exec -it gutter-ollama ollama pull mistral
```

### 6. Access Gutter

Open [http://localhost:3000](http://localhost:3000)

Login with the password you set in `AUTH_PASSWORD`.

---

## Architecture

```
┌────────────────────────────────────────┐
│  Host Machine                          │
│                                        │
│  ┌──────────────┐   ┌──────────────┐  │
│  │   gutter     │   │    ollama    │  │
│  │  (port 3000) │──▶│ (port 11434) │  │
│  └──────┬───────┘   └──────────────┘  │
│         │                              │
│         ▼                              │
│  ./data/  (SQLite DBs)                 │
│  ./backups/  (DB backups)              │
│                                        │
└────────────────────────────────────────┘
```

---

## Volume Mounts

| Host Path    | Container Path  | Purpose                      |
|--------------|-----------------|------------------------------|
| `./data`     | `/app/data`     | SQLite databases             |
| `./backups`  | `/app/backups`  | Automatic daily backups      |
| `ollama-models` (volume) | `/root/.ollama` | Ollama model storage |

---

## GPU Support (NVIDIA)

To enable GPU acceleration for Ollama:

1. Install [nvidia-docker](https://github.com/NVIDIA/nvidia-docker)
2. Uncomment the GPU section in `docker-compose.yml`:

```yaml
services:
  ollama:
    # ... other config
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
```

3. Restart services:

```bash
docker compose down
docker compose up -d
```

4. Verify GPU is detected:

```bash
docker exec -it gutter-ollama nvidia-smi
```

---

## Common Commands

### View Logs

```bash
# All services
docker compose logs -f

# Gutter only
docker compose logs -f gutter

# Ollama only
docker compose logs -f ollama
```

### Restart Services

```bash
docker compose restart
```

### Stop Services

```bash
docker compose down
```

### Rebuild After Code Changes

```bash
docker compose build --no-cache gutter
docker compose up -d
```

### Check Service Health

```bash
docker compose ps
```

Expected output:

```
NAME            IMAGE               STATUS              PORTS
gutter          gutter:latest       Up (healthy)        0.0.0.0:3000->3000/tcp
gutter-ollama   ollama/ollama       Up                  0.0.0.0:11434->11434/tcp
```

---

## Database Backups

Gutter automatically backs up the journal database daily to `./backups/`.

### Manual Backup

```bash
docker exec gutter bun --eval "require('./lib/journal-db.ts').triggerBackup()"
```

Or use the included script:

```bash
docker exec gutter /app/scripts/backup.sh
```

### Restore from Backup

```bash
# Stop services
docker compose down

# Replace current DB with backup
cp backups/gutter-journal-YYYY-MM-DD-HHmmss.db data/gutter-journal.db

# Start services
docker compose up -d
```

---

## Environment Variables

Full list of supported env vars:

| Variable | Default | Description |
|----------|---------|-------------|
| `AUTH_PASSWORD` | - | Login password (required) |
| `AUTH_SECRET` | - | Session secret (required) |
| `OLLAMA_URL` | `http://ollama:11434` | Ollama server URL |
| `OLLAMA_MODEL` | `qwen3:latest` | Model for meeting prep |
| `JOURNAL_COMMAND_MODEL` | `qwen3:latest` | Model for NL commands |
| `JIRA_URL` | - | Jira instance URL |
| `JIRA_EMAIL` | - | Jira email |
| `JIRA_API_TOKEN` | - | Jira API token |
| `JIRA_PROJECTS` | - | Comma-separated project keys |
| `SLACK_BOT_TOKEN` | - | Slack bot token |
| `SLACK_CHANNELS` | - | Pipe-delimited `ID\|name` pairs |
| `DEFAULT_THEME` | `cyberpink` | Default theme |
| `SESSION_MAX_AGE_DAYS` | `30` | Auth session duration |
| `NODE_ENV` | `production` | Runtime environment |

---

## Troubleshooting

### Port 3000 Already in Use

Change the host port in `docker-compose.yml`:

```yaml
services:
  gutter:
    ports:
      - "3001:3000"  # Change 3001 to any available port
```

### Ollama Connection Refused

1. Check Ollama is running:

```bash
docker compose ps ollama
```

2. Check Ollama logs:

```bash
docker compose logs ollama
```

3. Test Ollama endpoint:

```bash
curl http://localhost:11434/api/tags
```

### Database Permission Errors

Ensure `./data` directory has correct permissions:

```bash
chmod -R 755 data backups
```

### Out of Disk Space

Clean up unused Docker resources:

```bash
docker system prune -a --volumes
```

### Health Check Failing

Check if the app is responding:

```bash
docker exec gutter curl -f http://localhost:3000 || echo "Health check failed"
```

View container logs for errors:

```bash
docker compose logs gutter
```

---

## Production Recommendations

### Use Reverse Proxy

Put Gutter behind nginx or Traefik with HTTPS.

Example nginx config:

```nginx
server {
    listen 443 ssl http2;
    server_name gutter.example.com;

    ssl_certificate /etc/letsencrypt/live/gutter.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/gutter.example.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Enable HTTPS Cookies

Set in `.env`:

```bash
COOKIE_SECURE=true
```

### Set Up Automated Backups

Add a cron job to backup databases:

```bash
# Edit crontab
crontab -e

# Add daily backup at 2 AM
0 2 * * * cd /path/to/gutter && docker exec gutter /app/scripts/backup.sh
```

### Monitor Logs

Use Docker logging drivers or external log aggregators (e.g., Loki, ELK stack).

### Resource Limits

Add resource limits in `docker-compose.yml`:

```yaml
services:
  gutter:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 1G
```

---

## Updating Gutter

```bash
# Pull latest code
git pull origin main

# Rebuild and restart
docker compose build --no-cache gutter
docker compose up -d
```

---

## Uninstall

```bash
# Stop and remove containers
docker compose down -v

# Remove images
docker rmi gutter ollama/ollama

# Remove data (WARNING: deletes all databases and backups)
rm -rf data backups
```

---

For more deployment options, see:
- [VPS Deployment](DEPLOY-VPS.md)
- [Self-Hosted macOS/Linux](DEPLOY-SELF-HOST.md)

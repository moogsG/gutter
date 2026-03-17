# VPS Deployment Guide

Deploy Gutter on an Ubuntu VPS with systemd, nginx, and SSL.

---

## Prerequisites

- Ubuntu 22.04 or 24.04 LTS VPS
- At least 2GB RAM, 2 CPU cores, 20GB disk
- Root or sudo access
- Domain name pointed to your VPS IP

---

## Setup Overview

1. Install dependencies (bun, git, nginx, certbot)
2. Clone repository and configure
3. Build application
4. Create systemd services for Gutter and Ollama
5. Configure nginx reverse proxy
6. Set up SSL with Let's Encrypt
7. Enable auto-start and monitoring

---

## Step 1: Install Dependencies

### Update System

```bash
sudo apt update && sudo apt upgrade -y
```

### Install Bun

```bash
curl -fsSL https://bun.sh/install | bash
echo 'export PATH="$HOME/.bun/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
bun --version
```

### Install Git

```bash
sudo apt install -y git
```

### Install Nginx

```bash
sudo apt install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

### Install Certbot (for SSL)

```bash
sudo apt install -y certbot python3-certbot-nginx
```

### Install Ollama

```bash
curl -fsSL https://ollama.com/install.sh | sh
```

Verify:

```bash
ollama --version
```

---

## Step 2: Clone and Configure

### Clone Repository

```bash
cd ~
git clone <repo-url> gutter
cd gutter
```

### Install Dependencies

```bash
bun install
```

### Configure Environment

```bash
cp .env.example .env
nano .env
```

Set required variables:

```bash
# Auth
AUTH_PASSWORD=your-secure-password
AUTH_SECRET=$(openssl rand -hex 32)

# Ollama
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=qwen3:latest
JOURNAL_COMMAND_MODEL=qwen3:latest

# Jira (optional)
JIRA_URL=https://yourcompany.atlassian.net
JIRA_EMAIL=you@company.com
JIRA_API_TOKEN=your-token
JIRA_PROJECTS=PROJ1,PROJ2

# Slack (optional)
SLACK_BOT_TOKEN=xoxb-your-token
SLACK_CHANNELS=C123|general

# Production
NODE_ENV=production
PORT=3000

# Calendar (macOS only, disable on Linux)
CALENDAR_ENABLED=false
```

### Pull Ollama Model

```bash
ollama pull qwen3
```

Or use a different model:

```bash
ollama pull llama3.2
ollama pull mistral
```

---

## Step 3: Build Application

```bash
cd ~/gutter
bun run build
```

Verify build output:

```bash
ls -la .next/
```

---

## Step 4: Create Systemd Services

### Gutter Service

Create `/etc/systemd/system/gutter.service`:

```bash
sudo nano /etc/systemd/system/gutter.service
```

Paste the following (replace `YOUR_USERNAME` with your actual username):

```ini
[Unit]
Description=Gutter - AI-native bullet journal
After=network.target ollama.service
Wants=ollama.service

[Service]
Type=simple
User=YOUR_USERNAME
WorkingDirectory=/home/YOUR_USERNAME/gutter
Environment="NODE_ENV=production"
Environment="PATH=/home/YOUR_USERNAME/.bun/bin:/usr/local/bin:/usr/bin:/bin"
ExecStart=/home/YOUR_USERNAME/.bun/bin/bun run start
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=gutter

# Security hardening
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

### Ollama Service (if not already created)

Check if Ollama service exists:

```bash
systemctl status ollama
```

If not, create `/etc/systemd/system/ollama.service`:

```bash
sudo nano /etc/systemd/system/ollama.service
```

```ini
[Unit]
Description=Ollama Service
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=YOUR_USERNAME
ExecStart=/usr/local/bin/ollama serve
Restart=always
RestartSec=10
Environment="OLLAMA_HOST=0.0.0.0:11434"

[Install]
WantedBy=multi-user.target
```

### Enable and Start Services

```bash
sudo systemctl daemon-reload
sudo systemctl enable gutter ollama
sudo systemctl start ollama
sudo systemctl start gutter
```

### Check Status

```bash
sudo systemctl status ollama
sudo systemctl status gutter
```

### View Logs

```bash
sudo journalctl -u gutter -f
sudo journalctl -u ollama -f
```

---

## Step 5: Configure Nginx Reverse Proxy

Create nginx config:

```bash
sudo nano /etc/nginx/sites-available/gutter
```

Paste (replace `gutter.example.com` with your domain):

```nginx
server {
    listen 80;
    server_name gutter.example.com;

    client_max_body_size 100M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/gutter /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## Step 6: Set Up SSL with Let's Encrypt

```bash
sudo certbot --nginx -d gutter.example.com
```

Follow the prompts. Certbot will:
1. Verify domain ownership
2. Obtain SSL certificate
3. Update nginx config for HTTPS
4. Set up auto-renewal

Test auto-renewal:

```bash
sudo certbot renew --dry-run
```

### Update .env for HTTPS

```bash
nano ~/gutter/.env
```

Add:

```bash
COOKIE_SECURE=true
```

Restart Gutter:

```bash
sudo systemctl restart gutter
```

---

## Step 7: Automatic Backups

Create backup script:

```bash
sudo nano /usr/local/bin/gutter-backup.sh
```

```bash
#!/bin/bash
cd /home/YOUR_USERNAME/gutter
./scripts/backup.sh
find backups/ -name "*.db" -mtime +7 -delete
echo "Backup completed at $(date)" >> /var/log/gutter-backup.log
```

Make executable:

```bash
sudo chmod +x /usr/local/bin/gutter-backup.sh
```

Create cron job:

```bash
sudo crontab -e
```

Add daily backup at 2 AM:

```bash
0 2 * * * /usr/local/bin/gutter-backup.sh
```

---

## Verification

### Test HTTP to HTTPS Redirect

```bash
curl -I http://gutter.example.com
```

Expected: `301` or `302` redirect to `https://`

### Test HTTPS

```bash
curl -I https://gutter.example.com
```

Expected: `200 OK`

### Access in Browser

Navigate to `https://gutter.example.com` and login.

---

## Monitoring and Maintenance

### Check Service Status

```bash
sudo systemctl status gutter ollama nginx
```

### View Logs

```bash
# Gutter logs
sudo journalctl -u gutter -n 100 --no-pager

# Ollama logs
sudo journalctl -u ollama -n 100 --no-pager

# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### Restart Services

```bash
sudo systemctl restart gutter
sudo systemctl restart ollama
sudo systemctl reload nginx
```

### Update Gutter

```bash
cd ~/gutter
git pull origin main
bun install
bun run build
sudo systemctl restart gutter
```

---

## Firewall Configuration

If using UFW:

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 22/tcp  # SSH
sudo ufw enable
sudo ufw status
```

---

## Troubleshooting

### Service Won't Start

```bash
sudo journalctl -u gutter -n 50 --no-pager
```

Common issues:
- Incorrect user in systemd service file
- Missing environment variables in `.env`
- Port 3000 already in use

### Nginx 502 Bad Gateway

Check if Gutter is running:

```bash
curl http://localhost:3000
```

If not running:

```bash
sudo systemctl restart gutter
```

### Ollama Connection Issues

Check Ollama status:

```bash
curl http://localhost:11434/api/tags
```

Restart Ollama:

```bash
sudo systemctl restart ollama
```

### Database Permission Errors

```bash
cd ~/gutter
sudo chown -R YOUR_USERNAME:YOUR_USERNAME .
chmod 755 data/ backups/
```

---

## Performance Tuning

### Increase Nginx Worker Connections

Edit `/etc/nginx/nginx.conf`:

```nginx
events {
    worker_connections 2048;
}
```

### Enable Gzip Compression

Add to nginx server block:

```nginx
gzip on;
gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
gzip_min_length 1000;
```

### Limit Systemd Logs

Edit `/etc/systemd/journald.conf`:

```ini
[Journal]
SystemMaxUse=200M
MaxRetentionSec=1week
```

Apply:

```bash
sudo systemctl restart systemd-journald
```

---

## Security Hardening

### Enable Firewall (UFW)

Already covered above. Ensure only necessary ports are open.

### Disable Root SSH Login

Edit `/etc/ssh/sshd_config`:

```bash
PermitRootLogin no
```

Restart SSH:

```bash
sudo systemctl restart sshd
```

### Keep System Updated

```bash
sudo apt update && sudo apt upgrade -y
sudo apt autoremove -y
```

### Monitor Failed Login Attempts

Install fail2ban:

```bash
sudo apt install -y fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

---

## Uninstall

```bash
# Stop services
sudo systemctl stop gutter ollama
sudo systemctl disable gutter ollama

# Remove service files
sudo rm /etc/systemd/system/gutter.service
sudo systemctl daemon-reload

# Remove nginx config
sudo rm /etc/nginx/sites-enabled/gutter
sudo rm /etc/nginx/sites-available/gutter
sudo systemctl reload nginx

# Remove SSL certificate
sudo certbot delete --cert-name gutter.example.com

# Remove application
rm -rf ~/gutter

# Optional: Remove Ollama
sudo rm /usr/local/bin/ollama
```

---

For other deployment options, see:
- [Docker Deployment](DEPLOY-DOCKER.md)
- [Self-Hosted macOS/Linux](DEPLOY-SELF-HOST.md)

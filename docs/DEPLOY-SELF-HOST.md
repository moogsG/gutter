# Self-Hosted Deployment Guide

Deploy Gutter on bare metal macOS or Linux with auto-restart and process management.

---

## Prerequisites

- macOS 11+ or Linux (Ubuntu 20.04+, Debian 11+)
- Bun installed
- Ollama installed
- (macOS only) accli for Apple Calendar integration

---

## macOS Deployment with launchd

### 1. Install Dependencies

```bash
# Install bun
curl -fsSL https://bun.sh/install | bash

# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Install accli (for Apple Calendar)
npm install -g @joargp/accli

# Verify installations
bun --version
ollama --version
accli --version
```

### 2. Clone and Build

```bash
cd ~/Projects  # or wherever you keep projects
git clone <repo-url> gutter
cd gutter
bun install
cp .env.example .env
```

Edit `.env` with your configuration.

```bash
bun run build
```

### 3. Create launchd Service

Create `~/Library/LaunchAgents/com.gutter.app.plist`:

```bash
nano ~/Library/LaunchAgents/com.gutter.app.plist
```

Paste (replace `/Users/YOUR_USERNAME/Projects/gutter` with your actual path):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.gutter.app</string>
    
    <key>ProgramArguments</key>
    <array>
        <string>/Users/YOUR_USERNAME/.bun/bin/bun</string>
        <string>run</string>
        <string>start</string>
    </array>
    
    <key>WorkingDirectory</key>
    <string>/Users/YOUR_USERNAME/Projects/gutter</string>
    
    <key>EnvironmentVariables</key>
    <dict>
        <key>NODE_ENV</key>
        <string>production</string>
        <key>PATH</key>
        <string>/Users/YOUR_USERNAME/.bun/bin:/usr/local/bin:/usr/bin:/bin</string>
    </dict>
    
    <key>RunAtLoad</key>
    <true/>
    
    <key>KeepAlive</key>
    <true/>
    
    <key>StandardOutPath</key>
    <string>/Users/YOUR_USERNAME/Projects/gutter/gutter.log</string>
    
    <key>StandardErrorPath</key>
    <string>/Users/YOUR_USERNAME/Projects/gutter/gutter-error.log</string>
    
    <key>ThrottleInterval</key>
    <integer>10</integer>
</dict>
</plist>
```

### 4. Load and Start Service

```bash
launchctl load ~/Library/LaunchAgents/com.gutter.app.plist
launchctl start com.gutter.app
```

### 5. Verify

```bash
# Check if running
launchctl list | grep gutter

# View logs
tail -f ~/Projects/gutter/gutter.log
tail -f ~/Projects/gutter/gutter-error.log

# Access app
open http://localhost:3000
```

### launchd Management Commands

```bash
# Stop service
launchctl stop com.gutter.app

# Restart service
launchctl stop com.gutter.app
launchctl start com.gutter.app

# Unload service (disable auto-start)
launchctl unload ~/Library/LaunchAgents/com.gutter.app.plist

# Reload after editing plist
launchctl unload ~/Library/LaunchAgents/com.gutter.app.plist
launchctl load ~/Library/LaunchAgents/com.gutter.app.plist
```

---

## Linux Deployment with systemd

### 1. Install Dependencies

```bash
# Install bun
curl -fsSL https://bun.sh/install | bash
echo 'export PATH="$HOME/.bun/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc

# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Verify
bun --version
ollama --version
```

### 2. Clone and Build

```bash
cd ~
git clone <repo-url> gutter
cd gutter
bun install
cp .env.example .env
```

Edit `.env`. Note: Calendar integration is macOS-only, so set:

```bash
CALENDAR_ENABLED=false
```

Build:

```bash
bun run build
```

### 3. Create systemd Service

Create `/etc/systemd/system/gutter.service`:

```bash
sudo nano /etc/systemd/system/gutter.service
```

Paste (replace `YOUR_USERNAME` with your username):

```ini
[Unit]
Description=Gutter - AI-native bullet journal
After=network.target

[Service]
Type=simple
User=YOUR_USERNAME
WorkingDirectory=/home/YOUR_USERNAME/gutter
Environment="NODE_ENV=production"
Environment="PATH=/home/YOUR_USERNAME/.bun/bin:/usr/local/bin:/usr/bin:/bin"
ExecStart=/home/YOUR_USERNAME/.bun/bin/bun run start
Restart=always
RestartSec=10
StandardOutput=append:/home/YOUR_USERNAME/gutter/gutter.log
StandardError=append:/home/YOUR_USERNAME/gutter/gutter-error.log

# Security
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

### 4. Enable and Start

```bash
sudo systemctl daemon-reload
sudo systemctl enable gutter
sudo systemctl start gutter
```

### 5. Verify

```bash
# Check status
sudo systemctl status gutter

# View logs
sudo journalctl -u gutter -f

# Or view log files
tail -f ~/gutter/gutter.log
tail -f ~/gutter/gutter-error.log

# Access app
curl http://localhost:3000
```

### systemd Management Commands

```bash
# Stop service
sudo systemctl stop gutter

# Restart service
sudo systemctl restart gutter

# Disable auto-start
sudo systemctl disable gutter

# Re-enable auto-start
sudo systemctl enable gutter

# Reload after editing service file
sudo systemctl daemon-reload
sudo systemctl restart gutter
```

---

## Log Rotation

### macOS (newsyslog)

Create `/etc/newsyslog.d/gutter.conf`:

```bash
sudo nano /etc/newsyslog.d/gutter.conf
```

```
# logfilename          [owner:group]  mode  count  size  when  flags
/Users/YOUR_USERNAME/Projects/gutter/gutter.log           644   7      10240 *     J
/Users/YOUR_USERNAME/Projects/gutter/gutter-error.log     644   7      10240 *     J
```

Test:

```bash
sudo newsyslog -v
```

### Linux (logrotate)

Create `/etc/logrotate.d/gutter`:

```bash
sudo nano /etc/logrotate.d/gutter
```

```
/home/YOUR_USERNAME/gutter/gutter.log /home/YOUR_USERNAME/gutter/gutter-error.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 0644 YOUR_USERNAME YOUR_USERNAME
}
```

Test:

```bash
sudo logrotate -d /etc/logrotate.d/gutter
```

---

## Automatic Backups

### Cron Job (macOS and Linux)

Edit crontab:

```bash
crontab -e
```

Add daily backup at 2 AM:

```bash
0 2 * * * cd /path/to/gutter && ./scripts/backup.sh >> /path/to/gutter/backup.log 2>&1
```

Example for macOS:

```bash
0 2 * * * cd /Users/YOUR_USERNAME/Projects/gutter && ./scripts/backup.sh >> backup.log 2>&1
```

Example for Linux:

```bash
0 2 * * * cd /home/YOUR_USERNAME/gutter && ./scripts/backup.sh >> backup.log 2>&1
```

Verify cron jobs:

```bash
crontab -l
```

---

## Port Configuration

By default, Gutter runs on port 3000. To change:

Edit `.env`:

```bash
PORT=8080
```

Restart service:

**macOS:**

```bash
launchctl stop com.gutter.app
launchctl start com.gutter.app
```

**Linux:**

```bash
sudo systemctl restart gutter
```

---

## Reverse Proxy (Optional)

If you want to expose Gutter on port 80/443, use a reverse proxy.

### macOS with nginx

Install nginx:

```bash
brew install nginx
```

Edit `/usr/local/etc/nginx/nginx.conf`:

```nginx
http {
    # ... existing config
    
    server {
        listen 80;
        server_name localhost;
        
        location / {
            proxy_pass http://localhost:3000;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        }
    }
}
```

Start nginx:

```bash
brew services start nginx
```

Access: `http://localhost` (port 80)

### Linux with nginx

Install nginx:

```bash
sudo apt install nginx
```

Create config:

```bash
sudo nano /etc/nginx/sites-available/gutter
```

```nginx
server {
    listen 80;
    server_name localhost;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Enable:

```bash
sudo ln -s /etc/nginx/sites-available/gutter /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## Health Monitoring

Use the health check script for monitoring.

### Manual Check

```bash
cd /path/to/gutter
./scripts/health-check.sh
```

### Automated Monitoring with Cron

Add to crontab (every 5 minutes):

```bash
crontab -e
```

```bash
*/5 * * * * /path/to/gutter/scripts/health-check.sh || echo "Gutter health check failed at $(date)" >> /path/to/gutter/health-check.log
```

### macOS: Watchdog with launchd

Create `~/Library/LaunchAgents/com.gutter.healthcheck.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.gutter.healthcheck</string>
    
    <key>ProgramArguments</key>
    <array>
        <string>/path/to/gutter/scripts/health-check.sh</string>
    </array>
    
    <key>StartInterval</key>
    <integer>300</integer>
    
    <key>StandardOutPath</key>
    <string>/path/to/gutter/health-check.log</string>
    
    <key>StandardErrorPath</key>
    <string>/path/to/gutter/health-check.log</string>
</dict>
</plist>
```

Load:

```bash
launchctl load ~/Library/LaunchAgents/com.gutter.healthcheck.plist
```

---

## Troubleshooting

### Service Won't Start

**macOS:**

```bash
# Check launchd logs
log show --predicate 'subsystem == "com.apple.launchd"' --last 1h | grep gutter
```

**Linux:**

```bash
sudo journalctl -u gutter -n 50
```

### Port Already in Use

Find process using port 3000:

```bash
# macOS
lsof -i :3000

# Linux
sudo netstat -tulpn | grep 3000
```

Kill process:

```bash
kill -9 <PID>
```

### Database Locked

Ensure only one instance is running:

```bash
# macOS
launchctl list | grep gutter

# Linux
sudo systemctl status gutter
```

Stop other instances and restart.

---

## Updating Gutter

```bash
cd /path/to/gutter
git pull origin main
bun install
bun run build

# Restart service
# macOS:
launchctl stop com.gutter.app
launchctl start com.gutter.app

# Linux:
sudo systemctl restart gutter
```

---

## Uninstall

### macOS

```bash
# Stop and unload service
launchctl stop com.gutter.app
launchctl unload ~/Library/LaunchAgents/com.gutter.app.plist

# Remove plist
rm ~/Library/LaunchAgents/com.gutter.app.plist

# Remove application
rm -rf ~/Projects/gutter
```

### Linux

```bash
# Stop and disable service
sudo systemctl stop gutter
sudo systemctl disable gutter

# Remove service file
sudo rm /etc/systemd/system/gutter.service
sudo systemctl daemon-reload

# Remove application
rm -rf ~/gutter
```

---

For other deployment options, see:
- [Docker Deployment](DEPLOY-DOCKER.md)
- [VPS Deployment](DEPLOY-VPS.md)

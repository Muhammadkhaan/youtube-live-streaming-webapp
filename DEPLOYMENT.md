# CloudCast — Production Cloud Deployment Guide

CloudCast is designed as a cloud-native 24/7 multi-stream broadcasting platform. The Node.js and FFmpeg processes run on the cloud server independently of any client browser. If a user closes their browser or shuts down their computer, the active broadcasts continue running uninterrupted.

---

## 1. System Requirements

* **Operating System**: Ubuntu 22.04 LTS or Debian 12 (recommended)
* **CPU**: 2 vCPUs minimum for Stream Copy mode (4+ vCPUs recommended for multi-channel concurrent transcoding)
* **RAM**: 2 GB minimum (4 GB+ recommended)
* **Storage**: 20+ GB SSD (sized according to your media library)
* **Software**: Node.js 20+, FFmpeg 5+, FFprobe

---

## 2. Fast Deployment via Docker (Recommended)

1. Clone or copy the CloudCast repository to your VPS:
   ```bash
   git clone <your-repo> /opt/cloudcast
   cd /opt/cloudcast
   ```

2. Start the container stack with Docker Compose:
   ```bash
   docker compose up -d --build
   ```

3. View live logs:
   ```bash
   docker compose logs -f
   ```

---

## 3. Native Linux VPS Setup (Without Docker)

### Step 1: Install System Dependencies
```bash
sudo apt-get update
sudo apt-get install -y ffmpeg curl git ca-certificates procps
```

### Step 2: Install Node.js 22 LTS
```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### Step 3: Install Project & Build
```bash
cd /opt/cloudcast
npm ci
npm run build
```

### Step 4: Configure systemd Service for Automatic Startup on Boot
Create `/etc/systemd/system/cloudcast.service`:
```ini
[Unit]
Description=CloudCast 24/7 Multi-Stream Broadcast Engine
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/cloudcast
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=ADMIN_PASSWORD=your_secure_password
Environment=YOUTUBE_CLIENT_ID=your_google_youtube_client_id
Environment=YOUTUBE_CLIENT_SECRET=your_google_youtube_client_secret
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=5
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
```

Enable and start the service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable cloudcast
sudo systemctl start cloudcast
sudo systemctl status cloudcast
```

---

## 4. Nginx Reverse Proxy with SSE Telemetry Configuration

Create `/etc/nginx/sites-available/cloudcast`:
```nginx
server {
    listen 80;
    server_name broadcast.yourdomain.com;

    client_max_body_size 4096M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Disable buffering for Server-Sent Events (SSE) real-time telemetry
        proxy_buffering off;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
```

Enable site and configure SSL with Let's Encrypt:
```bash
sudo ln -s /etc/nginx/sites-available/cloudcast /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d broadcast.yourdomain.com
```

---

## 5. Security Checklist

* [x] **Masked Secrets**: YouTube Stream Keys are never returned in cleartext to client browsers.
* [x] **SSRF Protection**: All remote URL video download endpoints strictly validate IP addresses to block access to private VPC networks, loopback, and cloud metadata (169.254.169.254).
* [x] **Safe FFmpeg Invocation**: Spawns argument arrays with `spawn()`, avoiding shell injection vulnerabilities.
* [x] **Atomic Persistence**: Database writes use `.tmp` files with atomic rename to guarantee 0 corruption during power cycles.
* [x] **Orphan Process Sweep**: Automatically kills stale background FFmpeg processes on server startup.
* [x] **Exponential Backoff**: Prevents infinite crash loops if YouTube stream keys are invalid.

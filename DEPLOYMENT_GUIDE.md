# ASTROSURVEILLANCE - Deployment & Camera Connection Guide

## 📋 Overview

This guide covers:
1. **GitHub Setup** - Push your code to GitHub
2. **Vercel Deployment** - Deploy the web preview interface
3. **Edge Server Deployment** - Run on your local network
4. **Camera Connection** - Connect ONVIF IP cameras

---

## 🔷 PART 1: GitHub Setup

### Step 1.1: Create GitHub Repository

1. Go to [github.com](https://github.com) and sign in
2. Click **"+"** → **"New repository"**
3. Repository name: `astrosurveillance`
4. Description: `Intelligent Motion-Triggered Factory Surveillance System`
5. Choose **Private** (recommended for security)
6. Click **"Create repository"**

### Step 1.2: Initialize Git in Your Project

Open PowerShell in VS Code and run:

```powershell
cd E:\ASTROSURVELANCE

# Initialize git repository
git init

# Create .gitignore file
@"
# Dependencies
node_modules/
.npm

# Logs
logs/
*.log
npm-debug.log*

# Environment
.env
.env.local
config/local.json

# OS files
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/

# Build outputs
dist/
build/

# Recordings (don't commit video files)
recordings/
*.mp4

# Mobile app builds
mobile-app/android/app/build/
mobile-app/ios/build/
"@ | Out-File -FilePath .gitignore -Encoding utf8
```

### Step 1.3: Push to GitHub

```powershell
# Add all files
git add .

# Initial commit
git commit -m "Initial commit: ASTROSURVEILLANCE surveillance system"

# Add your GitHub repository as remote (replace YOUR_USERNAME)
git remote add origin https://github.com/YOUR_USERNAME/astrosurveillance.git

# Push to GitHub
git branch -M main
git push -u origin main
```

---

## 🔷 PART 2: Vercel Deployment (Web Preview)

> ⚠️ **Important**: Vercel will host the **web preview interface only**. The edge server must run on your local network to access cameras.

### Step 2.1: Prepare Web Preview for Production

Create a production configuration file:

```powershell
cd E:\ASTROSURVELANCE\web-preview
```

Create `vercel.json`:
```json
{
  "version": 2,
  "builds": [
    {
      "src": "index.html",
      "use": "@vercel/static"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/index.html"
    }
  ]
}
```

### Step 2.2: Update Web Preview for External Access

The web preview needs to connect to your edge server. You'll need to configure the server URL.

Edit `web-preview/index.html` and change:
```javascript
const API_BASE = 'http://localhost:3080/api';
```

To use a configurable URL:
```javascript
// Get server URL from URL parameter or use default
const urlParams = new URLSearchParams(window.location.search);
const API_BASE = urlParams.get('server') || 'http://localhost:3080/api';
```

### Step 2.3: Deploy to Vercel

**Option A: Via Vercel CLI**

```powershell
# Install Vercel CLI
npm install -g vercel

# Navigate to web-preview
cd E:\ASTROSURVELANCE\web-preview

# Deploy
vercel

# Follow prompts:
# - Link to existing project? No
# - Project name: astrosurveillance
# - Directory: ./
# - Override settings? No
```

**Option B: Via Vercel Dashboard**

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub
2. Click **"Add New..."** → **"Project"**
3. Import your `astrosurveillance` repository
4. Configure:
   - **Root Directory**: `web-preview`
   - **Framework Preset**: Other
   - **Build Command**: (leave empty)
   - **Output Directory**: `.`
5. Click **"Deploy"**

### Step 2.4: Access Your Deployed App

After deployment, you'll get a URL like:
```
https://astrosurveillance.vercel.app
```

To connect to your edge server, use:
```
https://astrosurveillance.vercel.app?server=http://YOUR_SERVER_IP:3080/api
```

---

## 🔷 PART 3: Edge Server Deployment

The edge server **must run on your local network** (same network as cameras).

### Step 3.1: Choose Your Server Hardware

**Recommended options:**
- Raspberry Pi 4 (4GB+ RAM)
- Intel NUC
- Old laptop/desktop
- Any Linux/Windows PC

**Requirements:**
- Node.js 18+
- FFmpeg installed
- Network connection
- SD card or storage for recordings

### Step 3.2: Install on Server

```bash
# Clone from GitHub
git clone https://github.com/YOUR_USERNAME/astrosurveillance.git
cd astrosurveillance/edge-server

# Install dependencies
npm install

# Install FFmpeg (Ubuntu/Debian)
sudo apt update
sudo apt install ffmpeg

# Create recordings directory
mkdir -p recordings
```

### Step 3.3: Configure the Server

Create `config/local.json` to override defaults:

```json
{
  "server": {
    "port": 3080,
    "host": "0.0.0.0"
  },
  "storage": {
    "basePath": "/path/to/your/sd-card/recordings",
    "maxUsagePercent": 90
  },
  "alarm": {
    "enabled": true,
    "durationSeconds": 10,
    "gpioPin": 18
  }
}
```

### Step 3.4: Run the Server

**Development:**
```bash
npm start
```

**Production (with PM2):**
```bash
# Install PM2
npm install -g pm2

# Start with PM2
pm2 start src/index.js --name astrosurveillance

# Auto-start on boot
pm2 startup
pm2 save
```

### Step 3.5: Find Your Server IP

```bash
# Linux
ip addr show | grep inet

# Windows
ipconfig
```

Note your IP address (e.g., `192.168.1.100`)

---

## 🔷 PART 4: Camera Connection

### Step 4.1: Supported Cameras

**ONVIF-Compatible IP Cameras:**
- Hikvision
- Dahua
- Reolink
- Amcrest
- Axis
- Most modern IP cameras

**Requirements:**
- ONVIF protocol support
- RTSP streaming enabled
- Connected to same network as edge server

### Step 4.2: Prepare Your Camera

1. **Connect camera to power**
2. **Connect camera to network** (Ethernet or WiFi)
3. **Access camera's web interface:**
   - Find camera IP (check router or use camera's app)
   - Open browser: `http://CAMERA_IP`
   - Login with default credentials (check manual)

4. **Enable ONVIF:**
   - Go to Settings → Network → ONVIF
   - Enable ONVIF service
   - Create ONVIF user if required

5. **Enable RTSP:**
   - Go to Settings → Network → RTSP
   - Note the RTSP port (usually 554)
   - Enable authentication

6. **Note Camera Credentials:**
   ```
   IP Address: _______________
   ONVIF Port: _______________ (usually 80 or 8080)
   RTSP Port:  _______________ (usually 554)
   Username:   _______________
   Password:   _______________
   ```

### Step 4.3: Auto-Discover Cameras

**Method A: Via Web Interface**

1. Open your deployed app: `https://your-app.vercel.app?server=http://YOUR_SERVER_IP:3080/api`
2. Go to **Cameras** tab
3. Click **"Discover"** button
4. Wait for ONVIF discovery to find cameras
5. Cameras will appear in the list

**Method B: Via API**

```bash
# Trigger discovery
curl -X POST http://YOUR_SERVER_IP:3080/api/cameras/discover

# List discovered cameras
curl http://YOUR_SERVER_IP:3080/api/cameras
```

### Step 4.4: Manual Camera Addition

If auto-discovery doesn't find your camera:

**Via API:**
```bash
curl -X POST http://YOUR_SERVER_IP:3080/api/cameras \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Front Door Camera",
    "ip": "192.168.1.50",
    "port": 80,
    "username": "admin",
    "password": "your_password",
    "rtspUrl": "rtsp://admin:password@192.168.1.50:554/stream1"
  }'
```

### Step 4.5: Verify Camera Connection

1. Check camera status in the app
2. Verify RTSP stream works:
   ```bash
   ffplay rtsp://username:password@CAMERA_IP:554/stream1
   ```

### Step 4.6: Common RTSP URL Formats

| Brand | RTSP URL Format |
|-------|----------------|
| Hikvision | `rtsp://user:pass@IP:554/Streaming/Channels/101` |
| Dahua | `rtsp://user:pass@IP:554/cam/realmonitor?channel=1&subtype=0` |
| Reolink | `rtsp://user:pass@IP:554/h264Preview_01_main` |
| Amcrest | `rtsp://user:pass@IP:554/cam/realmonitor?channel=1&subtype=0` |
| Generic | `rtsp://user:pass@IP:554/stream1` |

---

## 🔷 PART 5: Network Configuration

### Step 5.1: Port Forwarding (For Remote Access)

If you want to access the edge server from outside your network:

1. Open your router settings (usually `192.168.1.1`)
2. Find **Port Forwarding** section
3. Add rule:
   - External Port: `3080`
   - Internal IP: Your server IP
   - Internal Port: `3080`
   - Protocol: TCP

> ⚠️ **Security Warning**: Exposing your server to the internet requires additional security measures (HTTPS, authentication, firewall).

### Step 5.2: Static IP for Server

Ensure your edge server has a static IP:

**Router Method:**
1. Find DHCP settings in router
2. Add static lease for server MAC address

**Server Method (Linux):**
```bash
sudo nano /etc/netplan/01-netcfg.yaml
```

```yaml
network:
  version: 2
  ethernets:
    eth0:
      addresses:
        - 192.168.1.100/24
      gateway4: 192.168.1.1
      nameservers:
        addresses: [8.8.8.8, 8.8.4.4]
```

---

## 🔷 PART 6: Testing the Complete System

### Step 6.1: Checklist

- [ ] Edge server running on local network
- [ ] Camera connected and ONVIF enabled
- [ ] Camera discovered/added to system
- [ ] Web preview deployed on Vercel
- [ ] Web preview connected to edge server

### Step 6.2: Test Motion Detection

1. Open web preview
2. Ensure camera shows "Online" status
3. Create motion in front of camera
4. Verify:
   - Event appears in dashboard
   - Alarm triggers (if enabled)
   - Recording starts (60 seconds)
   - Recording appears in Recordings tab

### Step 6.3: Test Alarm

1. Click "Test Alarm" in dashboard
2. Verify:
   - Sound plays in browser
   - Visual indicator shows active
   - Auto-stops after 10 seconds

### Step 6.4: Test Recording Download

1. Go to Recordings tab
2. Select a recording
3. Click Download
4. Verify file downloads to device

---

## 🔷 PART 7: Troubleshooting

### Camera Not Discovered

```bash
# Check if camera responds to ONVIF
curl http://CAMERA_IP/onvif/device_service

# Check network connectivity
ping CAMERA_IP

# Check if ONVIF port is open
nc -zv CAMERA_IP 80
nc -zv CAMERA_IP 8080
```

### Cannot Connect from Vercel App

1. **CORS Issue**: Edge server must allow cross-origin requests
2. **Mixed Content**: HTTPS app cannot connect to HTTP server
   - Solution: Use ngrok for HTTPS tunnel:
     ```bash
     ngrok http 3080
     ```
   - Use ngrok URL in app

### Recording Not Starting

```bash
# Check FFmpeg
ffmpeg -version

# Test RTSP stream
ffmpeg -i "rtsp://user:pass@IP:554/stream" -t 10 test.mp4

# Check server logs
tail -f logs/app-*.log
```

### WebSocket Connection Failed

- Check firewall allows WebSocket connections
- Verify server is running
- Check browser console for errors

---

## 🔷 Quick Reference

### URLs

| Service | URL |
|---------|-----|
| Web Preview (Local) | `http://localhost:3000` |
| Web Preview (Vercel) | `https://your-app.vercel.app` |
| Edge Server API | `http://YOUR_SERVER_IP:3080/api` |
| With Server Param | `https://your-app.vercel.app?server=http://IP:3080/api` |

### API Endpoints

| Action | Method | Endpoint |
|--------|--------|----------|
| Discover Cameras | POST | `/api/cameras/discover` |
| List Cameras | GET | `/api/cameras` |
| Add Camera | POST | `/api/cameras` |
| Trigger Alarm | POST | `/api/alarm/trigger` |
| Stop Alarm | POST | `/api/alarm/stop` |
| List Recordings | GET | `/api/recordings` |

### Commands

```bash
# Start edge server
cd edge-server && npm start

# Start with PM2
pm2 start src/index.js --name astro

# View logs
pm2 logs astro

# Restart
pm2 restart astro
```

---

## ✅ Success!

Once everything is set up:
1. **Cameras detect motion** → Triggers recording
2. **60-second video saved** → To SD card
3. **Alarm sounds** → On motion detection
4. **View in app** → From anywhere via Vercel
5. **Download recordings** → To any device

---

*ASTROSURVEILLANCE v1.0.0 - Factory Surveillance Made Simple*

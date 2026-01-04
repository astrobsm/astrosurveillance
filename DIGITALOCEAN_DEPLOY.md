# DigitalOcean Deployment Guide

## 🌊 Deploy ASTROSURVEILLANCE to DigitalOcean

DigitalOcean provides full server capabilities including WebSocket, FFmpeg, and persistent storage - everything needed for a surveillance system.

---

## Option 1: App Platform (Recommended - Easiest)

### Cost: $5-6/month

1. **Go to DigitalOcean App Platform**
   - https://cloud.digitalocean.com/apps

2. **Create New App**
   - Click "Create App"
   - Select "GitHub" as source
   - Connect your GitHub account
   - Select repository: `astrobsm/astrosurveillance`
   - Branch: `main`

3. **Configure the App**
   - DigitalOcean will detect the Dockerfile
   - Set instance size: **Basic ($5/month)** or **Basic XS ($10/month)**
   - Region: Choose closest to your location

4. **Environment Variables** (optional)
   ```
   NODE_ENV=production
   PORT=3080
   ALARM_DURATION=10
   RECORDING_DURATION=60
   ```

5. **Deploy**
   - Click "Create Resources"
   - Wait 2-5 minutes for deployment
   - Your app will be available at: `https://astrosurveillance-xxxxx.ondigitalocean.app`

---

## Option 2: Droplet (Full Control)

### Cost: $4-6/month

1. **Create a Droplet**
   - Go to https://cloud.digitalocean.com/droplets
   - Choose: **Ubuntu 22.04 LTS**
   - Plan: **Basic $4/month** (1GB RAM, 1 vCPU)
   - Or use Docker image: **Docker on Ubuntu**

2. **SSH into your Droplet**
   ```bash
   ssh root@your-droplet-ip
   ```

3. **Install Docker (if not pre-installed)**
   ```bash
   curl -fsSL https://get.docker.com -o get-docker.sh
   sudo sh get-docker.sh
   sudo usermod -aG docker $USER
   ```

4. **Clone and Deploy**
   ```bash
   git clone https://github.com/astrobsm/astrosurveillance.git
   cd astrosurveillance
   docker-compose up -d
   ```

5. **Configure Firewall**
   ```bash
   ufw allow 22    # SSH
   ufw allow 80    # HTTP
   ufw allow 443   # HTTPS
   ufw allow 3080  # App
   ufw enable
   ```

6. **Access Your App**
   - http://your-droplet-ip:3080

---

## Option 3: One-Click Docker App

1. **Create Docker Droplet**
   - Go to Marketplace: https://marketplace.digitalocean.com/apps/docker
   - Click "Create Docker Droplet"
   - Choose $6/month plan

2. **Deploy via SSH**
   ```bash
   ssh root@your-droplet-ip
   
   # Pull and run
   docker run -d \
     --name astrosurveillance \
     --restart unless-stopped \
     -p 3080:3080 \
     -v astro-recordings:/app/recordings \
     -e NODE_ENV=production \
     ghcr.io/astrobsm/astrosurveillance:latest
   ```

---

## 🔒 Adding HTTPS (SSL Certificate)

### For App Platform:
- SSL is automatic! Your app gets HTTPS by default.

### For Droplet:
```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Get certificate (replace with your domain)
sudo certbot --nginx -d surveillance.yourdomain.com
```

---

## 🔗 Connect Web Interface to Your Server

Once deployed, update your web interface:

1. Go to https://astrosurveillance.vercel.app
2. Click **Settings** → **Server Address**
3. Enter your DigitalOcean URL:
   - App Platform: `https://astrosurveillance-xxxxx.ondigitalocean.app`
   - Droplet: `http://your-droplet-ip:3080`

---

## 📊 Monitoring

### View Logs (App Platform)
- Go to App → Runtime Logs

### View Logs (Droplet)
```bash
docker logs -f astrosurveillance
```

### Check Health
```bash
curl https://your-app-url/api/system/health
```

---

## 🔄 Auto-Deploy from GitHub

App Platform automatically deploys when you push to GitHub:

```bash
git add .
git commit -m "Update"
git push origin main
# DigitalOcean will auto-deploy in ~2 minutes
```

---

## 💡 Comparison

| Feature | App Platform | Droplet |
|---------|-------------|---------|
| Cost | $5-10/month | $4-6/month |
| Setup | 5 minutes | 15-30 minutes |
| SSL | Automatic | Manual (Certbot) |
| Scaling | Easy | Manual |
| Maintenance | Managed | You manage |
| Full Control | Limited | Full |

**Recommendation**: Start with **App Platform** for ease of use. Switch to Droplet if you need more control or want to save $1-2/month.

# ASTROSURVEILLANCE

## Intelligent Motion-Triggered Factory Surveillance System

A production-grade, edge-first surveillance system designed for **Bonnesante Medicals** factory environments. The system provides motion-triggered recording, local storage, and mobile monitoring capabilities without internet dependency.

---

## 📋 Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Requirements](#requirements)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [API Reference](#api-reference)
- [Mobile App](#mobile-app)
- [Troubleshooting](#troubleshooting)

---

## ✨ Features

### Core Functionality
- **Motion-Triggered Recording**: Records ONLY when motion is detected
- **Fixed Duration**: Exactly 60 seconds per recording trigger
- **Local Storage**: All recordings stored on device SD card
- **High-Decibel Alarm**: ≥110 dB alarm on motion detection
- **Multi-Camera Support**: Monitor up to 16 cameras simultaneously
- **Offline-First**: No internet dependency, works on LAN only

### Anti-False-Trigger System
- Threshold-based motion detection
- Minimum 300ms motion duration requirement
- 5% minimum pixel change validation
- Shadow/lighting change rejection
- Consecutive frame confirmation

### Recording Safeguards
- State machine prevents recording loops
- One trigger = One video = Exactly 60 seconds
- 3-second reset delay between recordings
- Never overwrites existing files
- Auto-cleanup at 90% storage capacity

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    ASTROSURVEILLANCE SYSTEM                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │   Camera 1   │    │   Camera 2   │    │   Camera N   │      │
│  │   (ONVIF)    │    │   (ONVIF)    │    │   (ONVIF)    │      │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘      │
│         │                   │                   │               │
│         └───────────────────┼───────────────────┘               │
│                             │                                   │
│                    ┌────────▼────────┐                         │
│                    │   EDGE SERVER   │                         │
│                    │   (Node.js)     │                         │
│                    ├─────────────────┤                         │
│                    │ • Motion Detect │                         │
│                    │ • Recording Ctrl│                         │
│                    │ • Alarm Control │                         │
│                    │ • Storage Mgmt  │                         │
│                    │ • Camera Mgmt   │                         │
│                    │ • REST API      │                         │
│                    │ • WebSocket     │                         │
│                    └────────┬────────┘                         │
│                             │                                   │
│              ┌──────────────┼──────────────┐                   │
│              │              │              │                    │
│       ┌──────▼──────┐ ┌─────▼─────┐ ┌─────▼─────┐             │
│       │  SD Card    │ │   Alarm   │ │  Mobile   │             │
│       │  Storage    │ │  Hardware │ │    App    │             │
│       │  (MP4)      │ │  (GPIO)   │ │  (React   │             │
│       └─────────────┘ └───────────┘ │   Native) │             │
│                                     └───────────┘              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 💻 Requirements

### Edge Server
- Node.js v18+ (LTS recommended)
- FFmpeg installed and in PATH
- Linux (Raspberry Pi, Ubuntu) or Windows
- SD card for storage (32GB minimum recommended)
- Network connectivity (LAN)

### Cameras
- ONVIF-compatible IP cameras
- RTSP stream support
- Motion detection capability (optional, uses software detection)

### Mobile App
- Android 8.0+ (API 26+)
- iOS 13+ (optional, Android-first)
- Connected to same LAN as edge server

---

## 🚀 Installation

### Edge Server Setup

```bash
# Clone or copy the project
cd edge-server

# Install dependencies
npm install

# Install FFmpeg (Ubuntu/Debian)
sudo apt update
sudo apt install ffmpeg

# Install FFmpeg (Windows) - Download from https://ffmpeg.org/download.html

# Configure the system
cp config/default.json config/local.json
# Edit config/local.json with your settings

# Start the server
npm start

# For development with auto-reload
npm run dev
```

### Mobile App Setup

```bash
# Navigate to mobile app
cd mobile-app

# Install dependencies
npm install

# Install iOS dependencies (macOS only)
cd ios && pod install && cd ..

# Run on Android
npm run android

# Run on iOS
npm run ios
```

---

## ⚙️ Configuration

### Edge Server Configuration (`config/default.json`)

```json
{
  "server": {
    "port": 8080,
    "host": "0.0.0.0"
  },
  "recording": {
    "durationSeconds": 60,
    "resetDelayMs": 3000,
    "format": "mp4",
    "quality": "high",
    "codec": "libx264"
  },
  "motionDetection": {
    "threshold": 15,
    "minDurationMs": 300,
    "minPixelChangePercent": 5,
    "shadowRejection": true,
    "lightingChangeRejection": true,
    "consecutiveFrames": 3
  },
  "alarm": {
    "enabled": true,
    "durationSeconds": 10,
    "gpioPin": 18,
    "type": "hardware"
  },
  "storage": {
    "basePath": "/media/sdcard",
    "maxUsagePercent": 90,
    "cleanupEnabled": true,
    "minFreeSpaceMB": 1024
  }
}
```

### Key Configuration Options

| Option | Description | Default |
|--------|-------------|---------|
| `recording.durationSeconds` | Fixed recording duration per trigger | 60 |
| `recording.resetDelayMs` | Delay before next recording can start | 3000 |
| `motionDetection.threshold` | Motion sensitivity (1-100) | 15 |
| `motionDetection.minDurationMs` | Minimum motion duration | 300 |
| `alarm.durationSeconds` | How long alarm sounds | 10 |
| `storage.maxUsagePercent` | Auto-cleanup trigger threshold | 90 |

---

## 📖 Usage

### Starting the System

1. **Start Edge Server**
   ```bash
   cd edge-server
   npm start
   ```
   Server will be available at `http://<server-ip>:8080`

2. **Pair Mobile App**
   - Open the mobile app
   - Scan the QR code displayed on server, or
   - Enter server IP manually

3. **Add Cameras**
   - Cameras are auto-discovered via ONVIF
   - Or add manually via API/mobile app

### Recording State Machine

```
    ┌─────────┐
    │  IDLE   │◄───────────────────────┐
    └────┬────┘                        │
         │ Motion Detected             │
         ▼                             │
    ┌─────────┐                        │
    │RECORDING│ (60 seconds)           │
    └────┬────┘                        │
         │ Duration Complete           │
         ▼                             │
    ┌─────────┐                        │
    │ LOCKED  │ (Motion ignored)       │
    └────┬────┘                        │
         │                             │
         ▼                             │
    ┌─────────┐                        │
    │ SAVING  │ (FFmpeg finalizing)    │
    └────┬────┘                        │
         │                             │
         ▼                             │
    ┌─────────┐                        │
    │  RESET  │ (3 second delay)       │
    └────┬────┘                        │
         │                             │
         └─────────────────────────────┘
```

### File Naming Convention

```
CAM01_2026-01-04_14-32-10.mp4
│     │          │
│     │          └── Time (HH-MM-SS)
│     └────────────── Date (YYYY-MM-DD)
└──────────────────── Camera ID
```

---

## 🔌 API Reference

### System Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/system/info` | Get system information |
| GET | `/api/system/health` | Health check |
| POST | `/api/system/restart` | Restart server (admin) |
| GET | `/api/system/pairing-qr` | Get pairing QR code |

### Camera Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/cameras` | List all cameras |
| POST | `/api/cameras` | Add a camera |
| GET | `/api/cameras/:id` | Get camera details |
| DELETE | `/api/cameras/:id` | Remove camera |
| POST | `/api/cameras/discover` | Discover ONVIF cameras |

### Recording Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/recordings` | List recordings |
| GET | `/api/recordings/:filename` | Get recording details |
| GET | `/api/recordings/:filename/stream` | Stream recording |
| GET | `/api/recordings/:filename/download` | Download recording |
| DELETE | `/api/recordings/:filename` | Delete recording (admin) |

### Alarm Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/alarm/status` | Get alarm status |
| POST | `/api/alarm/trigger` | Manually trigger alarm |
| POST | `/api/alarm/stop` | Stop alarm |
| PUT | `/api/alarm/config` | Update alarm config |

### Storage Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/storage/status` | Get storage status |
| POST | `/api/storage/cleanup` | Force cleanup (admin) |

### WebSocket Events

Connect to `ws://<server-ip>:8080` for real-time updates:

```javascript
// Incoming events
{
  type: 'motion.detected',
  payload: { cameraId, timestamp, confidence }
}

{
  type: 'recording.started',
  payload: { cameraId, filename, timestamp }
}

{
  type: 'recording.completed',
  payload: { cameraId, filename, duration }
}

{
  type: 'alarm.triggered',
  payload: { cameraId, timestamp }
}

{
  type: 'alarm.stopped',
  payload: { timestamp }
}

{
  type: 'camera.status',
  payload: { cameraId, status, timestamp }
}
```

---

## 📱 Mobile App

### Features
- Real-time dashboard with camera status
- Live alarm control (trigger/stop)
- Camera list with thumbnails
- Recording playback
- Download recordings to device
- QR code pairing
- Admin PIN protection

### Screens
- **Dashboard**: Overview, alarm control, quick stats
- **Cameras**: List and manage cameras
- **Camera Detail**: View camera info, recent recordings
- **Recordings**: Browse all recordings with filters
- **Recording Player**: Video playback with controls
- **Settings**: Admin access, storage management
- **Pairing**: Connect to edge server

---

## 🔧 Troubleshooting

### Common Issues

#### Camera Not Discovered
- Ensure camera is ONVIF-compatible
- Check camera is on same network
- Verify ONVIF service is enabled on camera
- Try manual camera addition

#### Recording Not Starting
- Check camera RTSP stream URL
- Verify FFmpeg is installed: `ffmpeg -version`
- Check storage space: `/api/storage/status`
- Review logs: `logs/app-YYYY-MM-DD.log`

#### Alarm Not Sounding
- Verify GPIO pin configuration
- Check alarm hardware connection
- Test with software alarm: `POST /api/alarm/trigger`

#### Mobile App Can't Connect
- Ensure phone is on same network
- Check server is running: `http://<ip>:8080/api/system/health`
- Try manual connection with IP address
- Check firewall allows port 8080

### Log Files

Logs are stored in `edge-server/logs/`:
- `app-YYYY-MM-DD.log` - Application logs
- `error.log` - Error logs only
- `combined.log` - All logs

### Debug Mode

Enable debug logging:
```bash
DEBUG=true npm start
```

---

## 📁 Project Structure

```
ASTROSURVELANCE/
├── edge-server/
│   ├── config/
│   │   └── default.json
│   ├── src/
│   │   ├── api/
│   │   │   ├── alarms.js
│   │   │   ├── cameras.js
│   │   │   ├── recordings.js
│   │   │   ├── storage.js
│   │   │   └── system.js
│   │   ├── modules/
│   │   │   ├── AlarmController.js
│   │   │   ├── CameraDiscovery.js
│   │   │   ├── CameraManager.js
│   │   │   ├── MotionDetector.js
│   │   │   ├── RecordingController.js
│   │   │   ├── SecurityManager.js
│   │   │   └── StorageManager.js
│   │   ├── utils/
│   │   │   ├── Logger.js
│   │   │   └── Timer.js
│   │   └── index.js
│   └── package.json
├── mobile-app/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Button.js
│   │   │   ├── Card.js
│   │   │   ├── StatusBadge.js
│   │   │   └── index.js
│   │   ├── context/
│   │   │   ├── AppContext.js
│   │   │   └── ConnectionContext.js
│   │   ├── navigation/
│   │   │   └── AppNavigator.js
│   │   ├── screens/
│   │   │   ├── CameraDetailScreen.js
│   │   │   ├── CameraListScreen.js
│   │   │   ├── DashboardScreen.js
│   │   │   ├── PairingScreen.js
│   │   │   ├── QRScannerScreen.js
│   │   │   ├── RecordingPlayerScreen.js
│   │   │   ├── RecordingsScreen.js
│   │   │   ├── SettingsScreen.js
│   │   │   └── index.js
│   │   ├── services/
│   │   │   ├── api.js
│   │   │   └── download.js
│   │   └── utils/
│   │       └── theme.js
│   ├── App.js
│   └── package.json
├── shared/
│   └── types.js
└── README.md
```

---

## 🔒 Security

### Default Credentials
- **Admin PIN**: `1234` (CHANGE THIS!)

### Security Features
- PIN-based admin authentication
- Pairing token for device registration
- Session management with timeout
- Lockout after 5 failed attempts (5 minutes)
- No internet exposure required

### Recommendations
1. Change default admin PIN immediately
2. Use strong WiFi password
3. Isolate surveillance network if possible
4. Regular security updates

---

## 📄 License

Proprietary - Bonnesante Medicals

---

## 👥 Support

For technical support, contact the IT department.

---

*ASTROSURVEILLANCE v1.0.0 - Factory Surveillance Made Simple*

/**
 * ASTROSURVEILLANCE - QR Code Pairing Module
 * 
 * Enables camera pairing by displaying a QR code that cameras can see.
 * The server grabs frames from discovered cameras and looks for the pairing code.
 * When detected, the camera is automatically registered.
 */

const EventEmitter = require('events');
const crypto = require('crypto');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const Logger = require('../utils/Logger');

// Try to load jsQR for QR detection
let jsQR;
try {
  jsQR = require('jsqr');
} catch (e) {
  Logger.warn('jsQR not available, QR detection disabled');
}

class QRPairing extends EventEmitter {
  constructor(cameraManager, cameraDiscovery) {
    super();
    
    this.cameraManager = cameraManager;
    this.cameraDiscovery = cameraDiscovery;
    
    // Active pairing sessions
    this.pairingSessions = new Map();
    
    // Scanning state
    this.isScanning = false;
    this.scanInterval = null;
    
    // Temp directory for frames
    this.tempDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
    
    Logger.info('QRPairing module initialized');
  }

  /**
   * Generate a new pairing session
   * Returns the pairing token and QR code data URL
   */
  async generatePairingCode(options = {}) {
    const QRCode = require('qrcode');
    
    // Generate unique pairing token
    const token = crypto.randomBytes(16).toString('hex');
    const expiresAt = Date.now() + (options.expiresIn || 5 * 60 * 1000); // 5 minutes default
    
    // Get server info for the QR code
    const serverInfo = {
      type: 'ASTRO_PAIR',
      token: token,
      server: options.serverUrl || this.getServerUrl(),
      name: options.cameraName || 'Camera',
      location: options.location || 'Unknown',
      timestamp: Date.now()
    };
    
    // Store the pairing session
    this.pairingSessions.set(token, {
      token,
      expiresAt,
      serverInfo,
      status: 'WAITING',
      createdAt: Date.now()
    });
    
    // Generate QR code as data URL
    const qrDataUrl = await QRCode.toDataURL(JSON.stringify(serverInfo), {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 400,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
    
    // Also generate SVG for better display
    const qrSvg = await QRCode.toString(JSON.stringify(serverInfo), {
      type: 'svg',
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 400
    });
    
    Logger.info('Pairing code generated', { token: token.substring(0, 8) + '...' });
    
    // Start scanning for this code if not already scanning
    if (!this.isScanning) {
      this.startScanning();
    }
    
    return {
      token,
      expiresAt,
      qrDataUrl,
      qrSvg,
      serverInfo
    };
  }

  /**
   * Get the server URL for QR code
   */
  getServerUrl() {
    const host = process.env.HOST || '0.0.0.0';
    const port = process.env.PORT || 3080;
    
    // Try to get the actual IP address
    const os = require('os');
    const interfaces = os.networkInterfaces();
    let serverIp = 'localhost';
    
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          serverIp = iface.address;
          break;
        }
      }
    }
    
    return `http://${serverIp}:${port}`;
  }

  /**
   * Start scanning discovered cameras for the pairing QR code
   */
  startScanning() {
    if (this.isScanning) return;
    
    this.isScanning = true;
    Logger.info('Started scanning cameras for pairing code');
    
    // Scan every 2 seconds
    this.scanInterval = setInterval(() => {
      this.scanCamerasForQR();
    }, 2000);
    
    // Also scan immediately
    this.scanCamerasForQR();
    
    // Auto-stop after 5 minutes
    setTimeout(() => {
      this.stopScanning();
    }, 5 * 60 * 1000);
  }

  /**
   * Stop scanning for QR codes
   */
  stopScanning() {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
    this.isScanning = false;
    Logger.info('Stopped scanning for pairing codes');
  }

  /**
   * Scan all discovered cameras for the pairing QR code
   */
  async scanCamerasForQR() {
    // Get discovered cameras that aren't paired yet
    const discoveredCameras = this.cameraDiscovery.getDiscoveredCameras();
    
    // Also check any pending RTSP URLs
    const pendingUrls = Array.from(this.pairingSessions.values())
      .filter(s => s.pendingRtspUrl)
      .map(s => s.pendingRtspUrl);
    
    // Combine discovered cameras with test URLs
    const camerasToScan = [
      ...discoveredCameras,
      ...pendingUrls.map(url => ({ rtspUrl: url, name: 'Pending' }))
    ];
    
    if (camerasToScan.length === 0) {
      // No cameras to scan - try common RTSP URLs on local network
      return;
    }
    
    // Clean up expired sessions
    this.cleanupExpiredSessions();
    
    // Check if we have any active sessions
    if (this.pairingSessions.size === 0) {
      this.stopScanning();
      return;
    }
    
    // Scan each camera
    for (const camera of camerasToScan) {
      if (camera.rtspUrl) {
        await this.scanCameraFrame(camera);
      }
    }
  }

  /**
   * Grab a frame from a camera and scan for QR code
   */
  async scanCameraFrame(camera) {
    if (!jsQR) return;
    
    const frameFile = path.join(this.tempDir, `frame_${Date.now()}.jpg`);
    
    try {
      // Use FFmpeg to grab a single frame
      await this.grabFrame(camera.rtspUrl, frameFile);
      
      // Read the frame and scan for QR code
      const qrData = await this.scanFrameForQR(frameFile);
      
      if (qrData) {
        Logger.info('QR code detected from camera', { camera: camera.name || camera.ip });
        await this.handleDetectedQR(qrData, camera);
      }
      
    } catch (error) {
      // Frame grab failed - camera might not be accessible
      Logger.debug('Frame grab failed', { camera: camera.name, error: error.message });
    } finally {
      // Clean up frame file
      try {
        if (fs.existsSync(frameFile)) {
          fs.unlinkSync(frameFile);
        }
      } catch (e) {}
    }
  }

  /**
   * Use FFmpeg to grab a single frame from RTSP stream
   */
  grabFrame(rtspUrl, outputFile) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        ffmpeg.kill('SIGKILL');
        reject(new Error('Frame grab timeout'));
      }, 5000);
      
      const ffmpeg = spawn('ffmpeg', [
        '-rtsp_transport', 'tcp',
        '-i', rtspUrl,
        '-frames:v', '1',
        '-q:v', '2',
        '-y',
        outputFile
      ], {
        stdio: ['ignore', 'pipe', 'pipe']
      });
      
      ffmpeg.on('close', (code) => {
        clearTimeout(timeout);
        if (code === 0 && fs.existsSync(outputFile)) {
          resolve(outputFile);
        } else {
          reject(new Error(`FFmpeg exited with code ${code}`));
        }
      });
      
      ffmpeg.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  /**
   * Scan a JPEG frame for QR codes
   */
  async scanFrameForQR(frameFile) {
    try {
      // Read the image file
      const sharp = require('sharp');
      const { data, info } = await sharp(frameFile)
        .raw()
        .ensureAlpha()
        .toBuffer({ resolveWithObject: true });
      
      // Use jsQR to detect QR codes
      const code = jsQR(new Uint8ClampedArray(data), info.width, info.height);
      
      if (code) {
        return code.data;
      }
      
      return null;
    } catch (error) {
      // Sharp might not be installed, try alternative method
      return null;
    }
  }

  /**
   * Handle a detected QR code
   */
  async handleDetectedQR(qrData, camera) {
    try {
      const data = JSON.parse(qrData);
      
      // Check if this is our pairing code
      if (data.type !== 'ASTRO_PAIR') {
        return;
      }
      
      // Find the matching session
      const session = this.pairingSessions.get(data.token);
      
      if (!session) {
        Logger.warn('QR code detected but session not found', { token: data.token.substring(0, 8) });
        return;
      }
      
      if (session.status === 'PAIRED') {
        return; // Already paired
      }
      
      if (Date.now() > session.expiresAt) {
        Logger.warn('QR code detected but session expired');
        this.pairingSessions.delete(data.token);
        return;
      }
      
      // Success! Register the camera
      Logger.info('Camera paired via QR code!', { 
        camera: camera.name || camera.ip,
        token: data.token.substring(0, 8)
      });
      
      // Update session status
      session.status = 'PAIRED';
      session.pairedCamera = camera;
      session.pairedAt = Date.now();
      
      // Register the camera
      const cameraData = {
        id: `ASTRO-CAM-${Date.now().toString(36).toUpperCase()}`,
        name: session.serverInfo.name || camera.name || 'Paired Camera',
        location: session.serverInfo.location || camera.location || 'Unknown',
        ip: camera.ip,
        rtspUrl: camera.rtspUrl,
        onvifUrl: camera.onvifUrl,
        username: camera.username,
        password: camera.password
      };
      
      await this.cameraManager.addCamera(cameraData);
      
      // Emit event
      this.emit('cameraPaired', {
        session,
        camera: cameraData
      });
      
      // Clean up session after a delay
      setTimeout(() => {
        this.pairingSessions.delete(data.token);
      }, 60000);
      
    } catch (error) {
      Logger.debug('QR data parse error', { error: error.message });
    }
  }

  /**
   * Clean up expired pairing sessions
   */
  cleanupExpiredSessions() {
    const now = Date.now();
    for (const [token, session] of this.pairingSessions) {
      if (now > session.expiresAt && session.status !== 'PAIRED') {
        this.pairingSessions.delete(token);
      }
    }
  }

  /**
   * Get pairing session status
   */
  getSessionStatus(token) {
    const session = this.pairingSessions.get(token);
    if (!session) {
      return { status: 'NOT_FOUND' };
    }
    
    if (Date.now() > session.expiresAt && session.status !== 'PAIRED') {
      return { status: 'EXPIRED' };
    }
    
    return {
      status: session.status,
      pairedCamera: session.pairedCamera,
      pairedAt: session.pairedAt,
      expiresAt: session.expiresAt
    };
  }

  /**
   * Cancel a pairing session
   */
  cancelSession(token) {
    this.pairingSessions.delete(token);
    
    if (this.pairingSessions.size === 0) {
      this.stopScanning();
    }
  }

  /**
   * Set an RTSP URL to scan for pairing
   * (For testing or when camera is already known)
   */
  addPendingCamera(rtspUrl, token) {
    const session = this.pairingSessions.get(token);
    if (session) {
      session.pendingRtspUrl = rtspUrl;
    }
  }
}

module.exports = QRPairing;

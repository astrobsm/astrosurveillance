/**
 * ASTROSURVEILLANCE - Camera Discovery Module
 * 
 * Discovers cameras on the local network using ONVIF protocol.
 * Also supports manual QR code pairing as fallback.
 */

const EventEmitter = require('events');
const onvif = require('node-onvif');
const QRCode = require('qrcode');
const Logger = require('../utils/Logger');

class CameraDiscovery extends EventEmitter {
  constructor(config) {
    super();
    
    this.config = {
      discoveryTimeout: config.discoveryTimeout || 5000,
      maxCameras: config.maxCameras || 16
    };
    
    // Discovered cameras cache
    this.discoveredCameras = new Map();
    
    // Pairing tokens for manual QR pairing
    this.pairingTokens = new Map();
    
    Logger.info('CameraDiscovery initialized');
  }
  
  /**
   * Start ONVIF camera discovery
   * @returns {Promise<Array>} Discovered cameras
   */
  async startDiscovery() {
    Logger.info('Starting ONVIF camera discovery');
    this.discoveredCameras.clear();
    
    try {
      const devices = await new Promise((resolve, reject) => {
        const discovered = [];
        
        onvif.startProbe()
          .then((deviceInfoList) => {
            resolve(deviceInfoList);
          })
          .catch((err) => {
            // Discovery might fail but that's okay
            Logger.warn('ONVIF probe error', { error: err.message });
            resolve([]);
          });
        
        // Timeout fallback
        setTimeout(() => {
          resolve(discovered);
        }, this.config.discoveryTimeout);
      });
      
      // Process discovered devices
      const cameras = [];
      for (const deviceInfo of devices) {
        try {
          const camera = await this._processDiscoveredDevice(deviceInfo);
          if (camera) {
            cameras.push(camera);
            this.discoveredCameras.set(camera.id, camera);
          }
        } catch (err) {
          Logger.warn('Failed to process device', { error: err.message });
        }
      }
      
      Logger.info('Discovery complete', { count: cameras.length });
      this.emit('discoveryComplete', cameras);
      
      return cameras;
      
    } catch (err) {
      Logger.error('Camera discovery failed', { error: err.message });
      this.emit('discoveryError', err);
      return [];
    }
  }
  
  /**
   * Process a discovered ONVIF device
   * @private
   */
  async _processDiscoveredDevice(deviceInfo) {
    const { urn, name, xaddrs } = deviceInfo;
    
    // Extract IP address from xaddrs
    const urlMatch = xaddrs[0]?.match(/http:\/\/([^:/]+)/);
    if (!urlMatch) return null;
    
    const ipAddress = urlMatch[1];
    const id = `ASTRO-CAM-${ipAddress.replace(/\./g, '')}`;
    
    const camera = {
      id,
      urn,
      name: name || `Camera ${id}`,
      ipAddress,
      onvifUrl: xaddrs[0],
      rtspUrl: null, // Will be populated when connecting
      location: 'Discovered',
      discoveredAt: new Date().toISOString()
    };
    
    Logger.debug('Camera discovered', { id, ip: ipAddress });
    
    return camera;
  }
  
  /**
   * Get discovered cameras
   * @returns {Array}
   */
  getDiscoveredCameras() {
    return Array.from(this.discoveredCameras.values());
  }
  
  /**
   * Connect to a discovered camera and get stream URLs
   * @param {string} cameraId
   * @param {string} username
   * @param {string} password
   * @returns {Promise<Object>}
   */
  async connectToCamera(cameraId, username = 'admin', password = 'admin') {
    const camera = this.discoveredCameras.get(cameraId);
    if (!camera) {
      throw new Error(`Camera ${cameraId} not found in discovered devices`);
    }
    
    try {
      // Create ONVIF device connection
      const device = new onvif.OnvifDevice({
        xaddr: camera.onvifUrl,
        user: username,
        pass: password
      });
      
      // Initialize device
      await device.init();
      
      // Get device info
      const info = await device.fetchSnapshot();
      
      // Get stream URI
      const profile = device.getCurrentProfile();
      const streamUri = profile?.stream?.rtsp;
      
      camera.rtspUrl = streamUri;
      camera.connected = true;
      camera.manufacturer = info?.manufacturer;
      camera.model = info?.model;
      
      Logger.info('Camera connected via ONVIF', { cameraId, rtsp: streamUri });
      
      return camera;
      
    } catch (err) {
      Logger.error('Failed to connect to camera', { cameraId, error: err.message });
      throw err;
    }
  }
  
  /**
   * Generate QR code for manual pairing
   * @param {string} serverIp - Edge server IP address
   * @param {number} serverPort - Edge server port
   * @returns {Promise<Object>}
   */
  async generatePairingQR(serverIp, serverPort) {
    // Generate unique pairing token
    const token = this._generateToken();
    const expiresAt = new Date(Date.now() + 3600000); // 1 hour expiry
    
    // Store token
    this.pairingTokens.set(token, {
      token,
      expiresAt,
      used: false
    });
    
    // Create pairing data
    const pairingData = {
      type: 'ASTROSURVEILLANCE',
      server: `http://${serverIp}:${serverPort}`,
      token,
      expires: expiresAt.toISOString()
    };
    
    // Generate QR code
    const qrDataUrl = await QRCode.toDataURL(JSON.stringify(pairingData), {
      width: 256,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    });
    
    Logger.info('Pairing QR code generated', { token });
    
    return {
      token,
      expiresAt,
      qrCode: qrDataUrl,
      pairingData
    };
  }
  
  /**
   * Validate pairing token
   * @param {string} token
   * @returns {boolean}
   */
  validatePairingToken(token) {
    const pairingInfo = this.pairingTokens.get(token);
    
    if (!pairingInfo) {
      Logger.warn('Invalid pairing token', { token });
      return false;
    }
    
    if (pairingInfo.used) {
      Logger.warn('Pairing token already used', { token });
      return false;
    }
    
    if (new Date() > new Date(pairingInfo.expiresAt)) {
      Logger.warn('Pairing token expired', { token });
      this.pairingTokens.delete(token);
      return false;
    }
    
    // Mark as used
    pairingInfo.used = true;
    Logger.info('Pairing token validated', { token });
    
    return true;
  }
  
  /**
   * Manually add a camera by IP
   * @param {string} ipAddress
   * @param {Object} options
   * @returns {Object}
   */
  addManualCamera(ipAddress, options = {}) {
    const id = `ASTRO-CAM-${ipAddress.replace(/\./g, '')}`;
    
    const camera = {
      id,
      name: options.name || `Camera ${id}`,
      ipAddress,
      rtspUrl: options.rtspUrl || `rtsp://${ipAddress}:554/stream`,
      onvifUrl: options.onvifUrl || `http://${ipAddress}/onvif/device_service`,
      location: options.location || 'Manual',
      addedAt: new Date().toISOString(),
      isManual: true
    };
    
    this.discoveredCameras.set(id, camera);
    
    Logger.info('Manual camera added', { id, ip: ipAddress });
    this.emit('cameraAdded', camera);
    
    return camera;
  }
  
  /**
   * Generate random token
   * @private
   */
  _generateToken() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let token = '';
    for (let i = 0; i < 8; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
  }
  
  /**
   * Clear expired pairing tokens
   */
  cleanupTokens() {
    const now = new Date();
    for (const [token, info] of this.pairingTokens) {
      if (new Date(info.expiresAt) < now) {
        this.pairingTokens.delete(token);
      }
    }
  }
}

module.exports = CameraDiscovery;

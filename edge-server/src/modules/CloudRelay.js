/**
 * ASTROSURVEILLANCE - Cloud Relay Module
 * 
 * Enables remote access from any network via WebSocket relay.
 * The edge server connects to a relay server, and mobile apps
 * connect to the same relay to communicate.
 */

const WebSocket = require('ws');
const crypto = require('crypto');
const Logger = require('../utils/Logger');

class CloudRelay {
  constructor(config = {}) {
    this.relayUrl = config.relayUrl || 'wss://astro-relay.glitch.me';
    this.deviceId = config.deviceId || this.generateDeviceId();
    this.secretKey = config.secretKey || this.generateSecretKey();
    this.ws = null;
    this.reconnectInterval = 5000;
    this.isConnected = false;
    this.messageHandlers = new Map();
    this.pendingRequests = new Map();
    
    // Store reference to local modules
    this.modules = null;
  }
  
  generateDeviceId() {
    // Generate a persistent device ID
    const os = require('os');
    const hash = crypto.createHash('sha256');
    hash.update(os.hostname() + os.platform() + os.arch());
    return 'ASTRO-' + hash.digest('hex').substring(0, 12).toUpperCase();
  }
  
  generateSecretKey() {
    return crypto.randomBytes(16).toString('hex');
  }
  
  /**
   * Initialize with local modules for handling requests
   */
  initialize(modules) {
    this.modules = modules;
    Logger.info('CloudRelay initialized', { deviceId: this.deviceId });
  }
  
  /**
   * Connect to cloud relay server
   */
  async connect() {
    return new Promise((resolve, reject) => {
      try {
        Logger.info('Connecting to cloud relay...', { url: this.relayUrl });
        
        this.ws = new WebSocket(this.relayUrl);
        
        this.ws.on('open', () => {
          this.isConnected = true;
          Logger.info('Connected to cloud relay');
          
          // Register this device
          this.send({
            type: 'register',
            deviceId: this.deviceId,
            deviceType: 'edge-server',
            version: '1.0.0'
          });
          
          resolve(true);
        });
        
        this.ws.on('message', (data) => {
          this.handleMessage(data);
        });
        
        this.ws.on('close', () => {
          this.isConnected = false;
          Logger.warn('Cloud relay disconnected, reconnecting...');
          setTimeout(() => this.connect(), this.reconnectInterval);
        });
        
        this.ws.on('error', (error) => {
          Logger.error('Cloud relay error', { error: error.message });
          reject(error);
        });
        
      } catch (error) {
        Logger.error('Failed to connect to cloud relay', { error: error.message });
        reject(error);
      }
    });
  }
  
  /**
   * Handle incoming messages from relay
   */
  async handleMessage(data) {
    try {
      const message = JSON.parse(data.toString());
      
      switch (message.type) {
        case 'request':
          // Handle API request from mobile app
          await this.handleApiRequest(message);
          break;
          
        case 'ping':
          this.send({ type: 'pong', timestamp: Date.now() });
          break;
          
        case 'registered':
          Logger.info('Device registered with relay', { 
            deviceId: this.deviceId,
            accessCode: message.accessCode 
          });
          this.accessCode = message.accessCode;
          break;
          
        default:
          Logger.debug('Unknown relay message', { type: message.type });
      }
      
    } catch (error) {
      Logger.error('Error handling relay message', { error: error.message });
    }
  }
  
  /**
   * Handle API request proxied through relay
   */
  async handleApiRequest(message) {
    const { requestId, clientId, method, path, body } = message;
    
    try {
      let response;
      
      // Route the request to appropriate handler
      if (path.startsWith('/api/cameras')) {
        response = await this.handleCameraRequest(method, path, body);
      } else if (path.startsWith('/api/recordings')) {
        response = await this.handleRecordingRequest(method, path, body);
      } else if (path.startsWith('/api/alarm')) {
        response = await this.handleAlarmRequest(method, path, body);
      } else if (path.startsWith('/api/storage')) {
        response = await this.handleStorageRequest(method, path, body);
      } else if (path.startsWith('/api/system')) {
        response = await this.handleSystemRequest(method, path, body);
      } else {
        response = { error: 'Not found', status: 404 };
      }
      
      // Send response back through relay
      this.send({
        type: 'response',
        requestId,
        clientId,
        data: response
      });
      
    } catch (error) {
      this.send({
        type: 'response',
        requestId,
        clientId,
        error: error.message,
        status: 500
      });
    }
  }
  
  async handleCameraRequest(method, path, body) {
    const { cameraManager, cameraDiscovery } = this.modules;
    
    if (method === 'GET' && path === '/api/cameras') {
      return cameraManager.getAllCameras();
    }
    
    if (method === 'POST' && path === '/api/cameras') {
      return cameraManager.addCamera(body);
    }
    
    if (method === 'POST' && path === '/api/cameras/discover') {
      const cameras = await cameraDiscovery.discoverCameras();
      return { count: cameras.length, cameras };
    }
    
    if (method === 'POST' && path === '/api/cameras/scan') {
      // Add camera from scanned barcode/QR data
      return cameraManager.addCamera(body);
    }
    
    return { error: 'Not found', status: 404 };
  }
  
  async handleRecordingRequest(method, path, body) {
    const { storageManager } = this.modules;
    
    if (method === 'GET' && path === '/api/recordings') {
      return storageManager.listRecordings();
    }
    
    return { error: 'Not found', status: 404 };
  }
  
  async handleAlarmRequest(method, path, body) {
    const { alarmController } = this.modules;
    
    if (method === 'GET' && path === '/api/alarm/status') {
      return alarmController.getStatus();
    }
    
    if (method === 'POST' && path === '/api/alarm/trigger') {
      alarmController.trigger('remote');
      return { success: true };
    }
    
    if (method === 'POST' && path === '/api/alarm/stop') {
      alarmController.stop();
      return { success: true };
    }
    
    return { error: 'Not found', status: 404 };
  }
  
  async handleStorageRequest(method, path, body) {
    const { storageManager } = this.modules;
    
    if (method === 'GET' && path === '/api/storage/status') {
      return storageManager.getHealth();
    }
    
    return { error: 'Not found', status: 404 };
  }
  
  async handleSystemRequest(method, path, body) {
    if (method === 'GET' && path === '/api/system/info') {
      return {
        deviceId: this.deviceId,
        version: '1.0.0',
        uptime: process.uptime(),
        platform: process.platform,
        remoteAccess: true,
        accessCode: this.accessCode
      };
    }
    
    return { error: 'Not found', status: 404 };
  }
  
  /**
   * Send message to relay
   */
  send(message) {
    if (this.ws && this.isConnected) {
      this.ws.send(JSON.stringify(message));
    }
  }
  
  /**
   * Broadcast event to all connected clients
   */
  broadcast(event) {
    this.send({
      type: 'broadcast',
      deviceId: this.deviceId,
      event
    });
  }
  
  /**
   * Get connection info for mobile app
   */
  getConnectionInfo() {
    return {
      deviceId: this.deviceId,
      accessCode: this.accessCode,
      isConnected: this.isConnected,
      relayUrl: this.relayUrl
    };
  }
  
  /**
   * Generate QR code data for pairing
   */
  getPairingData() {
    return {
      type: 'ASTROSURVEILLANCE',
      version: '1.0.0',
      deviceId: this.deviceId,
      accessCode: this.accessCode,
      relay: this.relayUrl,
      timestamp: Date.now()
    };
  }
}

module.exports = CloudRelay;

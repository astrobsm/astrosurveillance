/**
 * ASTROSURVEILLANCE - Camera Manager Module
 * 
 * Manages registered cameras, their status, and connections.
 * Each camera has:
 * - Camera ID (ASTRO-CAM-001)
 * - Physical location
 * - Alarm state
 * - Storage path
 */

const EventEmitter = require('events');
const Logger = require('../utils/Logger');
const { CameraStatus } = require('../shared/types');

class CameraManager extends EventEmitter {
  constructor(config) {
    super();
    
    this.config = {
      maxCameras: config.maxCameras || 16,
      reconnectInterval: config.reconnectInterval || 30000
    };
    
    // Camera registry
    this.cameras = new Map();
    
    // Reconnection timers
    this.reconnectTimers = new Map();
    
    // Database reference (will be set via setDatabase)
    this.db = null;
    
    Logger.info('CameraManager initialized', { maxCameras: this.config.maxCameras });
  }
  
  /**
   * Set database reference for persistence
   * @param {Object} database - Database instance
   */
  setDatabase(database) {
    this.db = database;
    Logger.info('CameraManager database connected');
  }
  
  /**
   * Load cameras from database on startup
   */
  async loadFromDatabase() {
    if (!this.db || !this.db.isConnected) {
      Logger.warn('Database not available, skipping camera load');
      return;
    }
    
    try {
      Logger.info('Loading cameras from database...');
      const result = await this.db.query('SELECT * FROM cameras');
      const cameras = result.rows || [];
      
      Logger.info(`Found ${cameras.length} cameras in database`);
      
      for (const row of cameras) {
        // Determine type - if UID exists, it's UBOX
        const cameraType = row.camera_type || (row.uid ? 'UBOX' : 'STANDARD');
        const cameraLocation = row.location || 'Bonnesante Factory';
        const cameraName = row.name || 'GZ-SONY MAKE.BELIEVE';
        
        const camera = {
          id: row.id,
          name: cameraName,
          location: cameraLocation,
          rtspUrl: row.rtsp_url,
          onvifUrl: row.onvif_url,
          uid: row.uid,
          type: cameraType,
          status: row.status || CameraStatus.ONLINE,
          credentials: {
            username: row.username || 'admin',
            password: row.password_encrypted || 'admin'
          },
          alarmEnabled: row.alarm_enabled !== false,
          motionEnabled: row.motion_enabled !== false,
          registeredAt: row.created_at,
          lastSeen: row.last_seen
        };
        
        this.cameras.set(camera.id, camera);
        
        // Update database if type/location was missing
        if (!row.camera_type || !row.location) {
          Logger.info('Updating camera with missing fields', { cameraId: camera.id });
          this._saveToDatabase(camera);
        }
        
        Logger.info('Loaded camera from database', { cameraId: camera.id, name: camera.name, type: cameraType, uid: row.uid });
      }
      
      Logger.info(`Successfully loaded ${cameras.length} cameras from database`);
    } catch (error) {
      Logger.error('Failed to load cameras from database', { error: error.message, stack: error.stack });
    }
  }
  
  /**
   * Save camera to database
   * @private
   */
  async _saveToDatabase(camera) {
    if (!this.db || !this.db.isConnected) {
      Logger.warn('Database not connected, camera not persisted', { cameraId: camera.id });
      return;
    }
    
    try {
      // Use simpler INSERT that doesn't require all columns
      const query = `
        INSERT INTO cameras (id, name, location, rtsp_url, onvif_url, uid, camera_type, username, password_encrypted, status, alarm_enabled, motion_enabled)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (id) DO UPDATE SET
          name = $2,
          location = $3,
          rtsp_url = $4,
          onvif_url = $5,
          uid = $6,
          camera_type = $7,
          status = $10,
          updated_at = CURRENT_TIMESTAMP
      `;
      
      const values = [
        camera.id,
        camera.name || 'GZ-SONY MAKE.BELIEVE',
        camera.location || 'Bonnesante Factory',
        camera.rtspUrl || null,
        camera.onvifUrl || null,
        camera.uid || null,
        camera.type || 'UBOX',
        camera.credentials?.username || 'admin',
        camera.credentials?.password || 'admin',
        camera.status || 'ONLINE',
        camera.alarmEnabled !== false,
        camera.motionEnabled !== false
      ];
      
      Logger.info('Saving camera to database', { cameraId: camera.id, name: camera.name, uid: camera.uid });
      await this.db.query(query, values);
      Logger.info('Camera saved to database successfully', { cameraId: camera.id });
    } catch (error) {
      Logger.error('Failed to save camera to database', { error: error.message, stack: error.stack, cameraId: camera.id });
    }
  }
  
  /**
   * Register a new camera
   * @param {Object} cameraData - Camera configuration
   * @returns {Object} Registered camera
   */
  registerCamera(cameraData) {
    const { id, name, location, rtspUrl, onvifUrl, uid, type, credentials, connectionType, p2pInfo } = cameraData;
    
    if (this.cameras.size >= this.config.maxCameras) {
      throw new Error(`Maximum camera limit (${this.config.maxCameras}) reached`);
    }
    
    if (this.cameras.has(id)) {
      Logger.warn('Camera already registered, updating', { cameraId: id });
    }
    
    const camera = {
      id,
      name: name || `Camera ${id}`,
      location: location || 'Unknown',
      rtspUrl,
      onvifUrl,
      uid: uid || null,
      type: type || (uid ? 'UBOX' : 'STANDARD'),
      credentials: credentials || { username: 'admin', password: 'admin' },
      connectionType: connectionType || (uid ? 'P2P' : 'RTSP'),
      p2pInfo: p2pInfo || null,
      status: CameraStatus.INITIALIZING,
      registeredAt: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
      alarmEnabled: true,
      motionEnabled: true,
      recordingCount: 0
    };
    
    this.cameras.set(id, camera);
    
    // Save to database
    this._saveToDatabase(camera);
    
    Logger.info('Camera registered', { cameraId: id, location, uid: uid || 'N/A', type: camera.type });
    this.emit('cameraRegistered', camera);
    
    // Initialize camera connection
    this._initializeCamera(id);
    
    return camera;
  }
  
  /**
   * Initialize camera connection
   * @private
   */
  async _initializeCamera(cameraId) {
    const camera = this.cameras.get(cameraId);
    if (!camera) return;
    
    try {
      // In production, this would connect to the camera's RTSP stream
      // and verify connectivity
      
      // Simulate successful connection
      camera.status = CameraStatus.ONLINE;
      camera.lastSeen = new Date().toISOString();
      
      Logger.info('Camera connected', { cameraId });
      this.emit('cameraOnline', camera);
      
    } catch (err) {
      camera.status = CameraStatus.ERROR;
      Logger.error('Camera connection failed', { cameraId, error: err.message });
      this.emit('cameraError', camera, err);
      
      // Schedule reconnection
      this._scheduleReconnect(cameraId);
    }
  }
  
  /**
   * Schedule camera reconnection
   * @private
   */
  _scheduleReconnect(cameraId) {
    // Clear existing timer
    if (this.reconnectTimers.has(cameraId)) {
      clearTimeout(this.reconnectTimers.get(cameraId));
    }
    
    const timer = setTimeout(() => {
      Logger.info('Attempting camera reconnection', { cameraId });
      this._initializeCamera(cameraId);
    }, this.config.reconnectInterval);
    
    this.reconnectTimers.set(cameraId, timer);
  }
  
  /**
   * Unregister a camera
   * @param {string} cameraId
   */
  unregisterCamera(cameraId) {
    const camera = this.cameras.get(cameraId);
    if (!camera) {
      throw new Error(`Camera ${cameraId} not found`);
    }
    
    // Clear reconnection timer
    if (this.reconnectTimers.has(cameraId)) {
      clearTimeout(this.reconnectTimers.get(cameraId));
      this.reconnectTimers.delete(cameraId);
    }
    
    this.cameras.delete(cameraId);
    
    Logger.info('Camera unregistered', { cameraId });
    this.emit('cameraUnregistered', cameraId);
  }
  
  /**
   * Get a camera by ID
   * @param {string} cameraId
   * @returns {Object|null}
   */
  getCamera(cameraId) {
    return this.cameras.get(cameraId) || null;
  }
  
  /**
   * Get all registered cameras
   * @returns {Array}
   */
  getAllCameras() {
    return Array.from(this.cameras.values());
  }
  
  /**
   * Get cameras by status
   * @param {string} status
   * @returns {Array}
   */
  getCamerasByStatus(status) {
    return this.getAllCameras().filter(c => c.status === status);
  }
  
  /**
   * Update camera status
   * @param {string} cameraId
   * @param {string} status
   */
  updateStatus(cameraId, status) {
    const camera = this.cameras.get(cameraId);
    if (!camera) return;
    
    const previousStatus = camera.status;
    camera.status = status;
    camera.lastSeen = new Date().toISOString();
    
    if (previousStatus !== status) {
      Logger.info('Camera status changed', { cameraId, from: previousStatus, to: status });
      this.emit('cameraStatusChanged', camera, previousStatus);
    }
  }
  
  /**
   * Update camera configuration
   * @param {string} cameraId
   * @param {Object} updates
   * @returns {Object} Updated camera
   */
  updateCamera(cameraId, updates) {
    const camera = this.cameras.get(cameraId);
    if (!camera) {
      throw new Error(`Camera ${cameraId} not found`);
    }
    
    // Only allow certain fields to be updated
    const allowedUpdates = ['name', 'location', 'alarmEnabled', 'motionEnabled'];
    
    for (const key of allowedUpdates) {
      if (updates[key] !== undefined) {
        camera[key] = updates[key];
      }
    }
    
    Logger.info('Camera updated', { cameraId, updates });
    this.emit('cameraUpdated', camera);
    
    return camera;
  }
  
  /**
   * Increment recording count for a camera
   * @param {string} cameraId
   */
  incrementRecordingCount(cameraId) {
    const camera = this.cameras.get(cameraId);
    if (camera) {
      camera.recordingCount++;
    }
  }
  
  /**
   * Get camera count
   * @returns {Object}
   */
  getCameraCount() {
    const cameras = this.getAllCameras();
    return {
      total: cameras.length,
      online: cameras.filter(c => c.status === CameraStatus.ONLINE).length,
      offline: cameras.filter(c => c.status === CameraStatus.OFFLINE).length,
      recording: cameras.filter(c => c.status === CameraStatus.RECORDING).length,
      error: cameras.filter(c => c.status === CameraStatus.ERROR).length
    };
  }
  
  /**
   * Generate a new unique camera ID
   * @returns {string}
   */
  generateCameraId() {
    const count = this.cameras.size + 1;
    return `ASTRO-CAM-${String(count).padStart(3, '0')}`;
  }
  
  /**
   * Add camera from scanned barcode/QR code data
   * Barcode format: JSON with {ip, username, password, name, location}
   * or URL format: rtsp://username:password@ip:port/stream
   * @param {string|Object} scanData - Scanned barcode data
   * @returns {Object} Registered camera
   */
  addCameraFromScan(scanData) {
    let cameraData;
    
    try {
      // Try to parse as JSON first
      if (typeof scanData === 'string') {
        // Check if it's a JSON string
        if (scanData.startsWith('{')) {
          cameraData = JSON.parse(scanData);
        }
        // Check if it's an RTSP URL
        else if (scanData.startsWith('rtsp://')) {
          cameraData = this._parseRtspUrl(scanData);
        }
        // Check if it's ONVIF camera data (format: ONVIF:ip:port:user:pass)
        else if (scanData.startsWith('ONVIF:')) {
          cameraData = this._parseOnvifBarcode(scanData);
        }
        // Check if it looks like a UBOX UID (starts with letters, 14-20 alphanumeric)
        else if (/^[A-Z]{3,4}[A-Z0-9]{10,16}$/i.test(scanData)) {
          cameraData = this._parseUboxUid(scanData);
        }
        // Try parsing as colon-separated values (ip:port:user:pass:name)
        else {
          cameraData = this._parseSimpleBarcode(scanData);
        }
      } else {
        cameraData = scanData;
      }
      
      // Handle UBOX cameras (have UID instead of IP)
      if (cameraData.uid || cameraData.type === 'UBOX') {
        return this._registerUboxCamera(cameraData);
      }
      
      // Validate required fields
      if (!cameraData.ip && !cameraData.rtspUrl) {
        throw new Error('Camera IP or RTSP URL is required');
      }
      
      // Generate camera ID and construct URLs
      const cameraId = this.generateCameraId();
      const ip = cameraData.ip;
      const port = cameraData.port || 554;
      const username = cameraData.username || 'admin';
      const password = cameraData.password || 'admin';
      
      const camera = {
        id: cameraId,
        name: cameraData.name || `Camera ${ip}`,
        location: cameraData.location || 'Scanned Camera',
        rtspUrl: cameraData.rtspUrl || `rtsp://${username}:${password}@${ip}:${port}/stream1`,
        onvifUrl: cameraData.onvifUrl || `http://${ip}:${cameraData.onvifPort || 80}/onvif/device_service`,
        credentials: {
          username,
          password
        }
      };
      
      Logger.info('Camera added from barcode scan', { cameraId, ip });
      
      return this.registerCamera(camera);
      
    } catch (error) {
      Logger.error('Failed to parse camera barcode', { error: error.message, scanData });
      throw new Error(`Invalid barcode format: ${error.message}`);
    }
  }
  
  /**
   * Parse RTSP URL to camera data
   * @private
   */
  _parseRtspUrl(url) {
    const urlPattern = /rtsp:\/\/([^:]+):([^@]+)@([^:\/]+):?(\d+)?\/?(.*)/;
    const match = url.match(urlPattern);
    
    if (!match) {
      throw new Error('Invalid RTSP URL format');
    }
    
    return {
      username: match[1],
      password: match[2],
      ip: match[3],
      port: match[4] || 554,
      rtspUrl: url
    };
  }
  
  /**
   * Parse ONVIF barcode format
   * Format: ONVIF:ip:port:username:password:name
   * @private
   */
  _parseOnvifBarcode(barcode) {
    const parts = barcode.split(':');
    
    if (parts.length < 5) {
      throw new Error('Invalid ONVIF barcode format');
    }
    
    return {
      ip: parts[1],
      onvifPort: parseInt(parts[2]) || 80,
      username: parts[3],
      password: parts[4],
      name: parts[5] || `ONVIF Camera ${parts[1]}`
    };
  }
  
  /**
   * Parse simple barcode format
   * Format: ip:port:username:password:name:location
   * @private
   */
  _parseSimpleBarcode(barcode) {
    const parts = barcode.split(':');
    
    if (parts.length < 1) {
      throw new Error('Invalid barcode format');
    }
    
    return {
      ip: parts[0],
      port: parts[1] ? parseInt(parts[1]) : 554,
      username: parts[2] || 'admin',
      password: parts[3] || 'admin',
      name: parts[4] || `Camera ${parts[0]}`,
      location: parts[5] || 'Unknown'
    };
  }
  
  /**
   * Parse UBOX UID format
   * @private
   */
  _parseUboxUid(uid) {
    return {
      uid: uid.toUpperCase(),
      type: 'UBOX',
      name: 'GZ-SONY MAKE.BELIEVE',
      password: 'admin'
    };
  }
  
  /**
   * Register a UBOX P2P camera
   * UBOX cameras use P2P connection via UID instead of direct IP
   * @private
   */
  _registerUboxCamera(cameraData) {
    const cameraId = this.generateCameraId();
    const uid = cameraData.uid;
    const password = cameraData.password || 'admin';
    
    const camera = {
      id: cameraId,
      name: cameraData.name || 'GZ-SONY MAKE.BELIEVE',
      location: cameraData.location || 'Bonnesante Factory',
      type: 'UBOX',
      uid: uid,
      // UBOX cameras typically use P2P, but may also support local RTSP
      // Try common UBOX RTSP paths
      rtspUrl: `rtsp://admin:${password}@${uid}/stream1`,
      onvifUrl: null, // UBOX cameras typically don't support ONVIF
      credentials: {
        username: 'admin',
        password: password
      },
      connectionType: 'P2P',
      p2pInfo: {
        uid: uid,
        password: password,
        server: 'p2p.cloudlinks.cn' // Common UBOX P2P server
      }
    };
    
    Logger.info('UBOX camera registered', { cameraId, uid: uid.substring(0, 4) + '***' });
    
    return this.registerCamera(camera);
  }
  
  /**
   * Export cameras configuration
   * @returns {Object}
   */
  exportConfig() {
    return {
      cameras: this.getAllCameras().map(c => ({
        id: c.id,
        name: c.name,
        location: c.location,
        rtspUrl: c.rtspUrl,
        onvifUrl: c.onvifUrl,
        alarmEnabled: c.alarmEnabled,
        motionEnabled: c.motionEnabled
      }))
    };
  }
  
  /**
   * Import cameras configuration
   * @param {Object} config
   */
  importConfig(config) {
    if (!config.cameras || !Array.isArray(config.cameras)) {
      throw new Error('Invalid configuration format');
    }
    
    for (const cameraData of config.cameras) {
      this.registerCamera(cameraData);
    }
    
    Logger.info('Camera configuration imported', { count: config.cameras.length });
  }
}

module.exports = CameraManager;

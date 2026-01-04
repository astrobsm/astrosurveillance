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
const { CameraStatus } = require('../../../shared/types');

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
    
    Logger.info('CameraManager initialized', { maxCameras: this.config.maxCameras });
  }
  
  /**
   * Register a new camera
   * @param {Object} cameraData - Camera configuration
   * @returns {Object} Registered camera
   */
  registerCamera(cameraData) {
    const { id, name, location, rtspUrl, onvifUrl } = cameraData;
    
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
      status: CameraStatus.INITIALIZING,
      registeredAt: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
      alarmEnabled: true,
      motionEnabled: true,
      recordingCount: 0
    };
    
    this.cameras.set(id, camera);
    
    Logger.info('Camera registered', { cameraId: id, location });
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

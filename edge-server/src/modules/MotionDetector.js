/**
 * ASTROSURVEILLANCE - Motion Detector Module
 * 
 * Detects meaningful movement from camera streams.
 * Implements anti-false-trigger rules to prevent spurious recordings.
 * 
 * Logic:
 * - Motion level must exceed predefined threshold
 * - Motion must persist for at least 300ms
 * - Pixel change must exceed 5% of frame
 * - Ignores shadows and lighting changes
 */

const EventEmitter = require('events');
const Logger = require('../utils/Logger');
const { MotionEventType } = require('../shared/types');

class MotionDetector extends EventEmitter {
  constructor(config) {
    super();
    
    this.config = {
      threshold: config.threshold || 15,
      minDurationMs: config.minDurationMs || 300,
      minPixelChangePercent: config.minPixelChangePercent || 5,
      ignoreShadows: config.ignoreShadows !== false,
      ignoreLightingChanges: config.ignoreLightingChanges !== false,
      sensitivityLevel: config.sensitivityLevel || 'medium'
    };
    
    // Active camera streams
    this.cameras = new Map();
    
    // Motion state per camera
    this.motionState = new Map();
    
    // Sensitivity multipliers
    this.sensitivityMap = {
      low: 1.5,
      medium: 1.0,
      high: 0.6
    };
    
    Logger.info('MotionDetector initialized', this.config);
  }
  
  /**
   * Attach a camera for motion detection
   * @param {Object} camera - Camera object with id and streamUrl
   */
  attachCamera(camera) {
    const { id, rtspUrl } = camera;
    
    if (this.cameras.has(id)) {
      Logger.warn('Camera already attached', { cameraId: id });
      return;
    }
    
    this.cameras.set(id, {
      id,
      rtspUrl,
      enabled: true,
      lastFrameTime: null
    });
    
    this.motionState.set(id, {
      isMotionActive: false,
      motionStartTime: null,
      lastMotionLevel: 0,
      consecutiveFrames: 0
    });
    
    Logger.info('Camera attached for motion detection', { cameraId: id });
    
    // In production, this would connect to RTSP stream
    // For now, we'll simulate with camera API callbacks
    this._startMonitoring(id);
  }
  
  /**
   * Detach a camera from motion detection
   * @param {string} cameraId
   */
  detachCamera(cameraId) {
    this.cameras.delete(cameraId);
    this.motionState.delete(cameraId);
    Logger.info('Camera detached from motion detection', { cameraId });
  }
  
  /**
   * Start monitoring a camera (simulation/placeholder for real implementation)
   * @private
   */
  _startMonitoring(cameraId) {
    // In production, this would:
    // 1. Connect to camera RTSP stream
    // 2. Use OpenCV or similar for frame analysis
    // 3. Compare consecutive frames for motion
    
    // For cameras with built-in motion detection API (ONVIF),
    // we would subscribe to their motion events instead
    Logger.debug('Started monitoring camera', { cameraId });
  }
  
  /**
   * Process motion event from camera API (ONVIF or similar)
   * Called when camera sends motion alert
   * @param {string} cameraId
   * @param {Object} eventData - Motion event data from camera
   */
  onCameraMotionEvent(cameraId, eventData) {
    if (!this.cameras.has(cameraId)) {
      Logger.warn('Motion event from unknown camera', { cameraId });
      return;
    }
    
    const camera = this.cameras.get(cameraId);
    if (!camera.enabled) {
      Logger.debug('Motion event ignored - camera disabled', { cameraId });
      return;
    }
    
    // Process the motion event
    this._processMotion(cameraId, eventData);
  }
  
  /**
   * Process motion data from frame analysis
   * @param {string} cameraId
   * @param {Object} frameData - Frame analysis data
   */
  processFrame(cameraId, frameData) {
    if (!this.cameras.has(cameraId)) return;
    
    const camera = this.cameras.get(cameraId);
    if (!camera.enabled) return;
    
    const {
      pixelChangePercent = 0,
      motionLevel = 0,
      hasShadow = false,
      hasLightingChange = false
    } = frameData;
    
    // Apply anti-false-trigger rules
    const isValid = this._validateMotion({
      pixelChangePercent,
      motionLevel,
      hasShadow,
      hasLightingChange
    });
    
    if (isValid) {
      this._processMotion(cameraId, { motionLevel, pixelChangePercent });
    } else {
      this._processNoMotion(cameraId);
    }
  }
  
  /**
   * Validate motion against anti-false-trigger rules
   * @private
   */
  _validateMotion(data) {
    const { pixelChangePercent, motionLevel, hasShadow, hasLightingChange } = data;
    const sensitivity = this.sensitivityMap[this.config.sensitivityLevel];
    const adjustedThreshold = this.config.threshold * sensitivity;
    
    // Rule 1: Motion level must exceed threshold
    if (motionLevel < adjustedThreshold) {
      return false;
    }
    
    // Rule 2: Pixel change must exceed minimum percentage
    if (pixelChangePercent < this.config.minPixelChangePercent) {
      return false;
    }
    
    // Rule 3: Ignore shadows if configured
    if (this.config.ignoreShadows && hasShadow) {
      Logger.debug('Motion rejected - shadow detected');
      return false;
    }
    
    // Rule 4: Ignore lighting changes if configured
    if (this.config.ignoreLightingChanges && hasLightingChange) {
      Logger.debug('Motion rejected - lighting change detected');
      return false;
    }
    
    return true;
  }
  
  /**
   * Process valid motion detection
   * @private
   */
  _processMotion(cameraId, data) {
    const state = this.motionState.get(cameraId);
    const now = Date.now();
    
    state.lastMotionLevel = data.motionLevel;
    state.consecutiveFrames++;
    
    if (!state.isMotionActive) {
      // Start tracking potential motion
      state.motionStartTime = now;
      state.isMotionActive = true;
    }
    
    // Check if motion duration exceeds minimum
    const duration = now - state.motionStartTime;
    
    if (duration >= this.config.minDurationMs && state.consecutiveFrames >= 3) {
      // Valid motion event - emit trigger
      Logger.info('Motion detected', {
        cameraId,
        duration,
        level: data.motionLevel
      });
      
      this.emit('motion', cameraId, {
        type: MotionEventType.MOTION_START,
        timestamp: new Date().toISOString(),
        duration,
        level: data.motionLevel
      });
      
      // Reset to prevent duplicate triggers
      state.motionStartTime = now;
      state.consecutiveFrames = 0;
    }
  }
  
  /**
   * Process frame with no motion
   * @private
   */
  _processNoMotion(cameraId) {
    const state = this.motionState.get(cameraId);
    
    if (state.isMotionActive) {
      // Motion ended
      state.isMotionActive = false;
      state.consecutiveFrames = 0;
      
      this.emit('motion', cameraId, {
        type: MotionEventType.MOTION_END,
        timestamp: new Date().toISOString()
      });
    }
  }
  
  /**
   * Simulate motion event (for testing)
   * @param {string} cameraId
   * @param {number} level - Motion level (0-100)
   */
  simulateMotion(cameraId, level = 50) {
    this.processFrame(cameraId, {
      pixelChangePercent: 10,
      motionLevel: level,
      hasShadow: false,
      hasLightingChange: false
    });
  }
  
  /**
   * Enable/disable motion detection for a camera
   * @param {string} cameraId
   * @param {boolean} enabled
   */
  setEnabled(cameraId, enabled) {
    const camera = this.cameras.get(cameraId);
    if (camera) {
      camera.enabled = enabled;
      Logger.info('Motion detection toggled', { cameraId, enabled });
    }
  }
  
  /**
   * Update sensitivity level
   * @param {string} level - 'low', 'medium', or 'high'
   */
  setSensitivity(level) {
    if (this.sensitivityMap[level]) {
      this.config.sensitivityLevel = level;
      Logger.info('Sensitivity updated', { level });
    }
  }
  
  /**
   * Get motion detection status
   * @param {string} cameraId
   * @returns {Object}
   */
  getStatus(cameraId) {
    const camera = this.cameras.get(cameraId);
    const state = this.motionState.get(cameraId);
    
    if (!camera) return null;
    
    return {
      enabled: camera.enabled,
      isMotionActive: state.isMotionActive,
      lastMotionLevel: state.lastMotionLevel,
      sensitivity: this.config.sensitivityLevel
    };
  }
  
  /**
   * Get all cameras status
   * @returns {Object}
   */
  getAllStatus() {
    const status = {};
    for (const [cameraId] of this.cameras) {
      status[cameraId] = this.getStatus(cameraId);
    }
    return status;
  }
}

module.exports = MotionDetector;

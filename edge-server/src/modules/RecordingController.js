/**
 * ASTROSURVEILLANCE - Recording Controller
 * 
 * THE MOST CRITICAL MODULE
 * 
 * Implements a strict state machine for recording control.
 * Golden Rule: One trigger = One video = Exactly 60 seconds
 * 
 * State Machine:
 * - IDLE: Waiting for motion
 * - RECORDING: 60-sec timer running
 * - LOCKED: Prevents retrigger during recording
 * - SAVING: Writing file to SD
 * - RESET: Returns to IDLE after cooldown
 */

const EventEmitter = require('events');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const Timer = require('../utils/Timer');
const Logger = require('../utils/Logger');
const { RecordingState, generateVideoFilename } = require('../shared/types');

class RecordingController extends EventEmitter {
  constructor(config, storageManager) {
    super();
    
    this.config = config;
    this.storageManager = storageManager;
    
    // State per camera (each camera has independent state)
    this.cameraStates = new Map();
    
    // Active FFmpeg processes
    this.activeProcesses = new Map();
    
    // Recording duration in milliseconds
    this.recordingDurationMs = (config.durationSeconds || 60) * 1000;
    
    // Reset delay in milliseconds
    this.resetDelayMs = (config.resetDelaySeconds || 3) * 1000;
    
    Logger.info('RecordingController initialized', {
      duration: this.recordingDurationMs,
      resetDelay: this.resetDelayMs
    });
  }
  
  /**
   * Get or initialize camera state
   * @param {string} cameraId
   * @returns {Object} Camera recording state
   */
  getCameraState(cameraId) {
    if (!this.cameraStates.has(cameraId)) {
      this.cameraStates.set(cameraId, {
        state: RecordingState.IDLE,
        currentFile: null,
        startTime: null,
        rtspUrl: null
      });
    }
    return this.cameraStates.get(cameraId);
  }
  
  /**
   * Start recording for a camera
   * @param {string} cameraId - Camera identifier
   * @param {string} rtspUrl - RTSP stream URL (optional, uses stored)
   * @returns {boolean} True if recording started
   */
  startRecording(cameraId, rtspUrl = null) {
    const cameraState = this.getCameraState(cameraId);
    
    // CRITICAL: Only start if in IDLE state
    if (cameraState.state !== RecordingState.IDLE) {
      Logger.warn('Recording blocked - camera not IDLE', {
        cameraId,
        currentState: cameraState.state
      });
      return false;
    }
    
    // Transition to RECORDING state
    cameraState.state = RecordingState.RECORDING;
    cameraState.startTime = new Date();
    cameraState.currentFile = generateVideoFilename(cameraId, cameraState.startTime);
    cameraState.rtspUrl = rtspUrl || cameraState.rtspUrl;
    
    const outputPath = path.join(
      this.storageManager.getBasePath(),
      cameraState.currentFile
    );
    
    Logger.info('Starting recording', {
      cameraId,
      filename: cameraState.currentFile,
      duration: this.recordingDurationMs / 1000
    });
    
    // Start FFmpeg recording
    this._startFFmpegRecording(cameraId, cameraState.rtspUrl, outputPath);
    
    // Start precise timer for exactly 60 seconds
    Timer.start(
      `recording_${cameraId}`,
      this.recordingDurationMs,
      () => this._onTimerEnd(cameraId)
    );
    
    this.emit('recordingStarted', cameraId, cameraState.currentFile);
    return true;
  }
  
  /**
   * Start FFmpeg recording process
   * @private
   */
  _startFFmpegRecording(cameraId, rtspUrl, outputPath) {
    // If no RTSP URL, simulate recording (for testing)
    if (!rtspUrl) {
      Logger.warn('No RTSP URL, using test pattern', { cameraId });
      this.activeProcesses.set(cameraId, { simulated: true });
      return;
    }
    
    const ffmpegProcess = ffmpeg(rtspUrl)
      .inputOptions([
        '-rtsp_transport tcp',
        '-stimeout 5000000'
      ])
      .outputOptions([
        '-c:v libx264',
        '-preset ultrafast',
        '-crf 23',
        '-c:a aac',
        '-b:a 128k',
        '-movflags +faststart',
        `-t ${this.config.durationSeconds}`
      ])
      .output(outputPath)
      .on('start', (cmd) => {
        Logger.debug('FFmpeg started', { cameraId, command: cmd });
      })
      .on('error', (err) => {
        Logger.error('FFmpeg error', { cameraId, error: err.message });
        this._handleRecordingError(cameraId, err);
      })
      .on('end', () => {
        Logger.debug('FFmpeg finished', { cameraId });
      });
    
    ffmpegProcess.run();
    this.activeProcesses.set(cameraId, ffmpegProcess);
  }
  
  /**
   * Handle timer end - stop recording
   * @private
   */
  _onTimerEnd(cameraId) {
    const cameraState = this.getCameraState(cameraId);
    
    if (cameraState.state !== RecordingState.RECORDING) {
      Logger.warn('Timer ended but not in RECORDING state', {
        cameraId,
        state: cameraState.state
      });
      return;
    }
    
    Logger.info('Recording timer ended', { cameraId });
    
    // Stop FFmpeg
    this._stopFFmpegRecording(cameraId);
    
    // Transition to SAVING state
    cameraState.state = RecordingState.SAVING;
    
    // Save to storage index
    this._saveRecording(cameraId);
  }
  
  /**
   * Stop FFmpeg recording process
   * @private
   */
  _stopFFmpegRecording(cameraId) {
    const process = this.activeProcesses.get(cameraId);
    if (process && !process.simulated) {
      try {
        process.kill('SIGTERM');
      } catch (err) {
        Logger.warn('Error stopping FFmpeg', { cameraId, error: err.message });
      }
    }
    this.activeProcesses.delete(cameraId);
  }
  
  /**
   * Save recording metadata and transition to RESET
   * @private
   */
  async _saveRecording(cameraId) {
    const cameraState = this.getCameraState(cameraId);
    
    try {
      // Add to storage index
      await this.storageManager.addRecording({
        cameraId,
        filename: cameraState.currentFile,
        timestamp: cameraState.startTime.toISOString(),
        duration: this.config.durationSeconds
      });
      
      Logger.info('Recording saved', {
        cameraId,
        filename: cameraState.currentFile
      });
      
      this.emit('recordingComplete', cameraId, cameraState.currentFile);
      
    } catch (err) {
      Logger.error('Failed to save recording', {
        cameraId,
        error: err.message
      });
    }
    
    // Transition to RESET state
    cameraState.state = RecordingState.RESET;
    this._onReset(cameraId);
  }
  
  /**
   * Handle RESET state - wait then return to IDLE
   * @private
   */
  _onReset(cameraId) {
    const cameraState = this.getCameraState(cameraId);
    
    Logger.debug('Entering RESET state', { cameraId, delay: this.resetDelayMs });
    
    // Wait for reset delay before returning to IDLE
    Timer.start(
      `reset_${cameraId}`,
      this.resetDelayMs,
      () => {
        cameraState.state = RecordingState.IDLE;
        cameraState.currentFile = null;
        cameraState.startTime = null;
        
        Logger.info('Camera returned to IDLE', { cameraId });
        this.emit('recordingReady', cameraId);
      }
    );
  }
  
  /**
   * Handle recording errors
   * @private
   */
  _handleRecordingError(cameraId, error) {
    const cameraState = this.getCameraState(cameraId);
    
    // Stop timer
    Timer.stop(`recording_${cameraId}`);
    
    // Clean up
    this.activeProcesses.delete(cameraId);
    
    // Force reset
    cameraState.state = RecordingState.RESET;
    this._onReset(cameraId);
    
    this.emit('recordingError', cameraId, error);
  }
  
  /**
   * Force stop recording for a camera
   * @param {string} cameraId
   */
  forceStop(cameraId) {
    const cameraState = this.getCameraState(cameraId);
    
    Timer.stop(`recording_${cameraId}`);
    Timer.stop(`reset_${cameraId}`);
    this._stopFFmpegRecording(cameraId);
    
    cameraState.state = RecordingState.IDLE;
    cameraState.currentFile = null;
    cameraState.startTime = null;
    
    Logger.info('Recording force stopped', { cameraId });
  }
  
  /**
   * Stop all recordings
   */
  async stopAll() {
    const promises = [];
    
    for (const [cameraId] of this.cameraStates) {
      this.forceStop(cameraId);
    }
    
    Timer.stopAll();
    Logger.info('All recordings stopped');
  }
  
  /**
   * Get recording state for a camera
   * @param {string} cameraId
   * @returns {Object}
   */
  getState(cameraId) {
    const cameraState = this.getCameraState(cameraId);
    return {
      state: cameraState.state,
      currentFile: cameraState.currentFile,
      startTime: cameraState.startTime,
      remainingMs: Timer.getRemaining(`recording_${cameraId}`)
    };
  }
  
  /**
   * Get all camera recording states
   * @returns {Object}
   */
  getAllStates() {
    const states = {};
    for (const [cameraId] of this.cameraStates) {
      states[cameraId] = this.getState(cameraId);
    }
    return states;
  }
  
  /**
   * Register a camera with its RTSP URL
   * @param {string} cameraId
   * @param {string} rtspUrl
   */
  registerCamera(cameraId, rtspUrl) {
    const cameraState = this.getCameraState(cameraId);
    cameraState.rtspUrl = rtspUrl;
    Logger.info('Camera registered for recording', { cameraId });
  }
}

module.exports = RecordingController;

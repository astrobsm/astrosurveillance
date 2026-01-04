/**
 * ASTROSURVEILLANCE - Alarm Controller Module
 * 
 * Independent alarm system that triggers IMMEDIATELY upon motion detection.
 * Designed for HIGH-DECIBEL (≥110 dB) industrial alarms.
 * 
 * The alarm is INDEPENDENT from recording - it triggers first,
 * before recording completes.
 */

const EventEmitter = require('events');
const Timer = require('../utils/Timer');
const Logger = require('../utils/Logger');
const { AlarmState } = require('../shared/types');

class AlarmController extends EventEmitter {
  constructor(config) {
    super();
    
    this.config = {
      durationSeconds: config.durationSeconds || 10,
      enabled: config.enabled !== false,
      volumeLevel: config.volumeLevel || 100
    };
    
    // Global alarm state
    this.state = AlarmState.ARMED;
    
    // Per-camera alarm tracking
    this.cameraAlarms = new Map();
    
    // GPIO/Hardware interface (to be implemented per hardware)
    this.hardwareInterface = null;
    
    Logger.info('AlarmController initialized', this.config);
  }
  
  /**
   * Set hardware interface for physical alarm control
   * @param {Object} hwInterface - Hardware interface with activate/deactivate methods
   */
  setHardwareInterface(hwInterface) {
    this.hardwareInterface = hwInterface;
    Logger.info('Hardware alarm interface set');
  }
  
  /**
   * Trigger alarm for a camera
   * @param {string} cameraId - Camera that detected motion
   * @returns {boolean} True if alarm was triggered
   */
  trigger(cameraId) {
    // Check if alarm is armed
    if (this.state === AlarmState.DISARMED) {
      Logger.debug('Alarm not triggered - system disarmed', { cameraId });
      return false;
    }
    
    // Check if alarm is in cooldown
    if (this.state === AlarmState.COOLDOWN) {
      Logger.debug('Alarm not triggered - in cooldown', { cameraId });
      return false;
    }
    
    // Check if this camera already triggered alarm recently
    const cameraAlarm = this.cameraAlarms.get(cameraId);
    if (cameraAlarm && cameraAlarm.isActive) {
      Logger.debug('Alarm already active for camera', { cameraId });
      return false;
    }
    
    Logger.info('ALARM TRIGGERED', { cameraId });
    
    // Update state
    this.state = AlarmState.TRIGGERED;
    
    // Track this camera's alarm
    this.cameraAlarms.set(cameraId, {
      isActive: true,
      triggeredAt: new Date()
    });
    
    // Activate physical alarm
    this._activateHardwareAlarm();
    
    // Emit event for WebSocket broadcast
    this.emit('alarmTriggered', cameraId);
    
    // Start auto-stop timer
    Timer.start(
      `alarm_${cameraId}`,
      this.config.durationSeconds * 1000,
      () => this._onAlarmTimeout(cameraId)
    );
    
    return true;
  }
  
  /**
   * Activate physical hardware alarm
   * @private
   */
  _activateHardwareAlarm() {
    if (this.hardwareInterface && this.hardwareInterface.activate) {
      try {
        this.hardwareInterface.activate(this.config.volumeLevel);
        Logger.debug('Hardware alarm activated');
      } catch (err) {
        Logger.error('Failed to activate hardware alarm', { error: err.message });
      }
    } else {
      // Simulation mode - log the alarm
      Logger.info('ALARM SOUND SIMULATION - 110dB SIREN ACTIVE');
    }
  }
  
  /**
   * Deactivate physical hardware alarm
   * @private
   */
  _deactivateHardwareAlarm() {
    if (this.hardwareInterface && this.hardwareInterface.deactivate) {
      try {
        this.hardwareInterface.deactivate();
        Logger.debug('Hardware alarm deactivated');
      } catch (err) {
        Logger.error('Failed to deactivate hardware alarm', { error: err.message });
      }
    } else {
      Logger.info('ALARM SOUND SIMULATION - SIREN STOPPED');
    }
  }
  
  /**
   * Handle alarm timeout
   * @private
   */
  _onAlarmTimeout(cameraId) {
    Logger.info('Alarm auto-stopped after timeout', { cameraId });
    
    // Update camera alarm state
    const cameraAlarm = this.cameraAlarms.get(cameraId);
    if (cameraAlarm) {
      cameraAlarm.isActive = false;
    }
    
    // Check if any other alarms are active
    let anyActive = false;
    for (const [id, alarm] of this.cameraAlarms) {
      if (alarm.isActive) {
        anyActive = true;
        break;
      }
    }
    
    // If no alarms active, stop hardware and enter cooldown
    if (!anyActive) {
      this._deactivateHardwareAlarm();
      this._enterCooldown();
    }
    
    this.emit('alarmStopped', cameraId);
  }
  
  /**
   * Enter cooldown period
   * @private
   */
  _enterCooldown() {
    this.state = AlarmState.COOLDOWN;
    
    // Cooldown for 5 seconds before returning to ARMED
    Timer.start('alarm_cooldown', 5000, () => {
      this.state = AlarmState.ARMED;
      Logger.debug('Alarm system returned to ARMED state');
    });
  }
  
  /**
   * Manually stop alarm
   * @param {string} cameraId - Optional: stop specific camera alarm
   */
  stop(cameraId = null) {
    if (cameraId) {
      Timer.stop(`alarm_${cameraId}`);
      const cameraAlarm = this.cameraAlarms.get(cameraId);
      if (cameraAlarm) {
        cameraAlarm.isActive = false;
      }
      Logger.info('Alarm manually stopped', { cameraId });
    } else {
      // Stop all alarms
      for (const [id] of this.cameraAlarms) {
        Timer.stop(`alarm_${id}`);
        this.cameraAlarms.get(id).isActive = false;
      }
      Logger.info('All alarms stopped');
    }
    
    this._deactivateHardwareAlarm();
    this.state = AlarmState.ARMED;
    this.emit('alarmStopped', cameraId);
  }
  
  /**
   * Arm the alarm system
   */
  arm() {
    this.state = AlarmState.ARMED;
    Logger.info('Alarm system ARMED');
    this.emit('alarmArmed');
  }
  
  /**
   * Disarm the alarm system
   */
  disarm() {
    // Stop any active alarms first
    this.stop();
    
    this.state = AlarmState.DISARMED;
    Logger.info('Alarm system DISARMED');
    this.emit('alarmDisarmed');
  }
  
  /**
   * Toggle alarm system armed state
   * @returns {string} New state
   */
  toggle() {
    if (this.state === AlarmState.DISARMED) {
      this.arm();
    } else {
      this.disarm();
    }
    return this.state;
  }
  
  /**
   * Get current alarm state
   * @returns {Object}
   */
  getState() {
    const activeAlarms = [];
    for (const [cameraId, alarm] of this.cameraAlarms) {
      if (alarm.isActive) {
        activeAlarms.push({
          cameraId,
          triggeredAt: alarm.triggeredAt
        });
      }
    }
    
    return {
      state: this.state,
      enabled: this.config.enabled,
      durationSeconds: this.config.durationSeconds,
      volumeLevel: this.config.volumeLevel,
      activeAlarms
    };
  }
  
  /**
   * Update alarm configuration
   * @param {Object} updates
   */
  updateConfig(updates) {
    if (updates.durationSeconds !== undefined) {
      this.config.durationSeconds = updates.durationSeconds;
    }
    if (updates.enabled !== undefined) {
      this.config.enabled = updates.enabled;
      if (!updates.enabled) {
        this.disarm();
      } else {
        this.arm();
      }
    }
    if (updates.volumeLevel !== undefined) {
      this.config.volumeLevel = Math.min(100, Math.max(0, updates.volumeLevel));
    }
    
    Logger.info('Alarm config updated', this.config);
    return this.config;
  }
}

module.exports = AlarmController;

/**
 * ASTROSURVEILLANCE - Shared Type Definitions
 * 
 * These enums and constants ensure consistency between
 * edge server and mobile app.
 */

// Recording State Machine States
const RecordingState = {
  IDLE: 'IDLE',           // Waiting for motion
  RECORDING: 'RECORDING', // 60-sec timer running
  LOCKED: 'LOCKED',       // Prevents retrigger
  SAVING: 'SAVING',       // Writing file to SD
  RESET: 'RESET'          // Returns to IDLE
};

// Camera Status
const CameraStatus = {
  ONLINE: 'ONLINE',
  OFFLINE: 'OFFLINE',
  RECORDING: 'RECORDING',
  ERROR: 'ERROR',
  INITIALIZING: 'INITIALIZING'
};

// Alarm State
const AlarmState = {
  ARMED: 'ARMED',
  DISARMED: 'DISARMED',
  TRIGGERED: 'TRIGGERED',
  COOLDOWN: 'COOLDOWN'
};

// Motion Event Types
const MotionEventType = {
  MOTION_START: 'MOTION_START',
  MOTION_END: 'MOTION_END',
  FALSE_POSITIVE: 'FALSE_POSITIVE'
};

// Storage Health Status
const StorageHealth = {
  HEALTHY: 'HEALTHY',       // < 70% full
  WARNING: 'WARNING',       // 70-90% full
  CRITICAL: 'CRITICAL',     // > 90% full
  ERROR: 'ERROR'            // Read/write error
};

// API Response Codes
const ResponseCode = {
  SUCCESS: 'SUCCESS',
  ERROR: 'ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  NOT_FOUND: 'NOT_FOUND',
  BUSY: 'BUSY'
};

// Video file naming pattern: CAM01_2026-01-04_14-32-10.mp4
const generateVideoFilename = (cameraId, timestamp = new Date()) => {
  const pad = (n) => String(n).padStart(2, '0');
  const date = `${timestamp.getFullYear()}-${pad(timestamp.getMonth() + 1)}-${pad(timestamp.getDate())}`;
  const time = `${pad(timestamp.getHours())}-${pad(timestamp.getMinutes())}-${pad(timestamp.getSeconds())}`;
  return `${cameraId}_${date}_${time}.mp4`;
};

// Parse video filename to extract metadata
const parseVideoFilename = (filename) => {
  const match = filename.match(/^(.+)_(\d{4}-\d{2}-\d{2})_(\d{2}-\d{2}-\d{2})\.mp4$/);
  if (!match) return null;
  
  const [, cameraId, datePart, timePart] = match;
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute, second] = timePart.split('-').map(Number);
  
  return {
    cameraId,
    timestamp: new Date(year, month - 1, day, hour, minute, second),
    filename
  };
};

module.exports = {
  RecordingState,
  CameraStatus,
  AlarmState,
  MotionEventType,
  StorageHealth,
  ResponseCode,
  generateVideoFilename,
  parseVideoFilename
};

/**
 * ASTROSURVEILLANCE - Alarm API Routes
 * 
 * Endpoints for alarm control.
 */

const express = require('express');
const router = express.Router();

/**
 * GET /api/alarms
 * Get alarm system status
 */
router.get('/', (req, res) => {
  const { alarmController } = req.app.locals.modules;
  
  const state = alarmController.getState();
  
  res.json({
    code: 'SUCCESS',
    data: state
  });
});

/**
 * POST /api/alarms/arm
 * Arm the alarm system
 */
router.post('/arm', (req, res) => {
  const { alarmController } = req.app.locals.modules;
  
  alarmController.arm();
  
  res.json({
    code: 'SUCCESS',
    message: 'Alarm system armed',
    data: alarmController.getState()
  });
});

/**
 * POST /api/alarms/disarm
 * Disarm the alarm system
 */
router.post('/disarm', (req, res) => {
  const { alarmController } = req.app.locals.modules;
  
  alarmController.disarm();
  
  res.json({
    code: 'SUCCESS',
    message: 'Alarm system disarmed',
    data: alarmController.getState()
  });
});

/**
 * POST /api/alarms/toggle
 * Toggle alarm arm/disarm state
 */
router.post('/toggle', (req, res) => {
  const { alarmController } = req.app.locals.modules;
  
  const newState = alarmController.toggle();
  
  res.json({
    code: 'SUCCESS',
    message: `Alarm system ${newState.toLowerCase()}`,
    data: alarmController.getState()
  });
});

/**
 * POST /api/alarms/stop
 * Stop currently active alarm
 */
router.post('/stop', (req, res) => {
  const { alarmController } = req.app.locals.modules;
  const { cameraId } = req.body;
  
  alarmController.stop(cameraId);
  
  res.json({
    code: 'SUCCESS',
    message: cameraId ? `Alarm stopped for camera ${cameraId}` : 'All alarms stopped',
    data: alarmController.getState()
  });
});

/**
 * POST /api/alarms/trigger
 * Manually trigger alarm (for testing)
 */
router.post('/trigger', (req, res) => {
  const { alarmController } = req.app.locals.modules;
  const { cameraId } = req.body;
  
  // Use 'manual' as default cameraId for manual triggers
  const triggerSource = cameraId || 'manual';
  
  const triggered = alarmController.trigger(triggerSource);
  
  if (triggered) {
    res.json({
      code: 'SUCCESS',
      message: 'Alarm triggered',
      data: alarmController.getState()
    });
  } else {
    res.status(409).json({
      code: 'BUSY',
      message: 'Alarm could not be triggered (may be disarmed or in cooldown)',
      data: alarmController.getState()
    });
  }
});

/**
 * PUT /api/alarms/config
 * Update alarm configuration
 */
router.put('/config', (req, res) => {
  const { alarmController } = req.app.locals.modules;
  const { durationSeconds, enabled, volumeLevel } = req.body;
  
  const updatedConfig = alarmController.updateConfig({
    durationSeconds,
    enabled,
    volumeLevel
  });
  
  res.json({
    code: 'SUCCESS',
    message: 'Alarm configuration updated',
    data: {
      config: updatedConfig,
      state: alarmController.getState()
    }
  });
});

/**
 * GET /api/alarm/status
 * Get alarm status (note: singular 'alarm' for compatibility)
 */
router.get('/status', (req, res) => {
  const { alarmController } = req.app.locals.modules;
  
  const state = alarmController.getState();
  
  res.json({
    code: 'SUCCESS',
    data: state
  });
});

module.exports = router;

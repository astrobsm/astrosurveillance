/**
 * ASTROSURVEILLANCE - Camera API Routes
 * 
 * Endpoints for camera management and discovery.
 */

const express = require('express');
const router = express.Router();

/**
 * GET /api/cameras
 * Get all registered cameras
 */
router.get('/', (req, res) => {
  const { cameraManager } = req.app.locals.modules;
  
  const cameras = cameraManager.getAllCameras();
  const counts = cameraManager.getCameraCount();
  
  res.json({
    code: 'SUCCESS',
    data: {
      cameras,
      counts
    }
  });
});

/**
 * GET /api/cameras/discover
 * Trigger ONVIF camera discovery
 */
router.get('/discover', async (req, res) => {
  const { cameraDiscovery } = req.app.locals.modules;
  
  try {
    const cameras = await cameraDiscovery.startDiscovery();
    
    res.json({
      code: 'SUCCESS',
      data: {
        discovered: cameras
      }
    });
  } catch (err) {
    res.status(500).json({
      code: 'ERROR',
      message: 'Discovery failed: ' + err.message
    });
  }
});

/**
 * GET /api/cameras/:id
 * Get a specific camera
 */
router.get('/:id', (req, res) => {
  const { cameraManager, recordingController, motionDetector } = req.app.locals.modules;
  const { id } = req.params;
  
  const camera = cameraManager.getCamera(id);
  
  if (!camera) {
    return res.status(404).json({
      code: 'NOT_FOUND',
      message: 'Camera not found'
    });
  }
  
  // Add recording and motion status
  const recordingState = recordingController.getState(id);
  const motionStatus = motionDetector.getStatus(id);
  
  res.json({
    code: 'SUCCESS',
    data: {
      ...camera,
      recording: recordingState,
      motion: motionStatus
    }
  });
});

/**
 * POST /api/cameras
 * Register a new camera
 */
router.post('/', (req, res) => {
  const { cameraManager, motionDetector, recordingController } = req.app.locals.modules;
  const { name, location, rtspUrl, onvifUrl, ipAddress } = req.body;
  
  if (!rtspUrl && !ipAddress) {
    return res.status(400).json({
      code: 'ERROR',
      message: 'Either rtspUrl or ipAddress is required'
    });
  }
  
  try {
    const id = cameraManager.generateCameraId();
    
    const camera = cameraManager.registerCamera({
      id,
      name,
      location,
      rtspUrl: rtspUrl || `rtsp://${ipAddress}:554/stream`,
      onvifUrl: onvifUrl || (ipAddress ? `http://${ipAddress}/onvif/device_service` : null)
    });
    
    // Attach to motion detector and recording controller
    motionDetector.attachCamera(camera);
    recordingController.registerCamera(id, camera.rtspUrl);
    
    res.status(201).json({
      code: 'SUCCESS',
      data: camera
    });
  } catch (err) {
    res.status(400).json({
      code: 'ERROR',
      message: err.message
    });
  }
});

/**
 * PUT /api/cameras/:id
 * Update camera configuration
 */
router.put('/:id', (req, res) => {
  const { cameraManager } = req.app.locals.modules;
  const { id } = req.params;
  const updates = req.body;
  
  try {
    const camera = cameraManager.updateCamera(id, updates);
    
    res.json({
      code: 'SUCCESS',
      data: camera
    });
  } catch (err) {
    res.status(err.message.includes('not found') ? 404 : 400).json({
      code: 'ERROR',
      message: err.message
    });
  }
});

/**
 * DELETE /api/cameras/:id
 * Unregister a camera
 */
router.delete('/:id', (req, res) => {
  const { cameraManager, motionDetector, recordingController } = req.app.locals.modules;
  const { id } = req.params;
  
  try {
    // Stop any active recording
    recordingController.forceStop(id);
    
    // Detach from motion detector
    motionDetector.detachCamera(id);
    
    // Unregister camera
    cameraManager.unregisterCamera(id);
    
    res.json({
      code: 'SUCCESS',
      message: 'Camera unregistered'
    });
  } catch (err) {
    res.status(err.message.includes('not found') ? 404 : 400).json({
      code: 'ERROR',
      message: err.message
    });
  }
});

/**
 * POST /api/cameras/:id/connect
 * Connect to a discovered camera via ONVIF
 */
router.post('/:id/connect', async (req, res) => {
  const { cameraDiscovery, cameraManager, motionDetector, recordingController } = req.app.locals.modules;
  const { id } = req.params;
  const { username, password } = req.body;
  
  try {
    const discoveredCamera = await cameraDiscovery.connectToCamera(id, username, password);
    
    // Register the connected camera
    const camera = cameraManager.registerCamera(discoveredCamera);
    
    // Attach to motion detector
    motionDetector.attachCamera(camera);
    recordingController.registerCamera(id, camera.rtspUrl);
    
    res.json({
      code: 'SUCCESS',
      data: camera
    });
  } catch (err) {
    res.status(400).json({
      code: 'ERROR',
      message: err.message
    });
  }
});

/**
 * POST /api/cameras/manual
 * Manually add a camera by IP address
 */
router.post('/manual', (req, res) => {
  const { cameraDiscovery, cameraManager, motionDetector, recordingController } = req.app.locals.modules;
  const { ipAddress, name, location, rtspUrl } = req.body;
  
  if (!ipAddress) {
    return res.status(400).json({
      code: 'ERROR',
      message: 'IP address is required'
    });
  }
  
  try {
    // Add to discovery cache
    const discoveredCamera = cameraDiscovery.addManualCamera(ipAddress, {
      name,
      location,
      rtspUrl
    });
    
    // Register the camera
    const camera = cameraManager.registerCamera(discoveredCamera);
    
    // Attach to motion detector
    motionDetector.attachCamera(camera);
    recordingController.registerCamera(camera.id, camera.rtspUrl);
    
    res.status(201).json({
      code: 'SUCCESS',
      data: camera
    });
  } catch (err) {
    res.status(400).json({
      code: 'ERROR',
      message: err.message
    });
  }
});

/**
 * POST /api/cameras/:id/test-motion
 * Simulate motion detection for testing
 */
router.post('/:id/test-motion', (req, res) => {
  const { motionDetector } = req.app.locals.modules;
  const { id } = req.params;
  const { level } = req.body;
  
  motionDetector.simulateMotion(id, level || 50);
  
  res.json({
    code: 'SUCCESS',
    message: 'Motion simulation triggered'
  });
});

module.exports = router;

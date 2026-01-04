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

/**
 * POST /api/cameras/scan
 * Add a camera by scanning barcode/QR code
 * 
 * Supported barcode formats:
 * 1. JSON: {"ip":"192.168.1.100","username":"admin","password":"pass123","name":"Factory Cam 1"}
 * 2. RTSP URL: rtsp://admin:pass123@192.168.1.100:554/stream1
 * 3. ONVIF format: ONVIF:192.168.1.100:80:admin:pass123:Camera Name
 * 4. Simple format: 192.168.1.100:554:admin:pass123:Camera Name:Factory Floor
 */
router.post('/scan', (req, res) => {
  const { cameraManager, motionDetector, recordingController } = req.app.locals.modules;
  const { scanData, barcodeData, rawData } = req.body;
  
  // Accept different field names for the scanned data
  const data = scanData || barcodeData || rawData;
  
  if (!data) {
    return res.status(400).json({
      code: 'ERROR',
      message: 'Scanned data is required. Provide scanData, barcodeData, or rawData field.'
    });
  }
  
  try {
    // Use the addCameraFromScan method
    const camera = cameraManager.addCameraFromScan(data);
    
    // Attach to motion detector and recording controller
    motionDetector.attachCamera(camera);
    recordingController.registerCamera(camera.id, camera.rtspUrl);
    
    res.status(201).json({
      code: 'SUCCESS',
      message: 'Camera added successfully from barcode scan',
      data: {
        camera,
        instructions: 'Camera registered and monitoring started'
      }
    });
  } catch (err) {
    res.status(400).json({
      code: 'ERROR',
      message: err.message,
      supportedFormats: [
        'JSON: {"ip":"...","username":"...","password":"..."}',
        'RTSP: rtsp://user:pass@ip:port/stream',
        'ONVIF: ONVIF:ip:port:user:pass:name',
        'Simple: ip:port:user:pass:name:location'
      ]
    });
  }
});

/**
 * GET /api/cameras/scan/formats
 * Get supported barcode formats documentation
 */
router.get('/scan/formats', (req, res) => {
  res.json({
    code: 'SUCCESS',
    data: {
      description: 'Supported barcode/QR code formats for camera registration',
      formats: [
        {
          name: 'JSON Format',
          example: '{"ip":"192.168.1.100","username":"admin","password":"admin123","name":"Factory Entrance","location":"Building A"}',
          required: ['ip'],
          optional: ['username', 'password', 'name', 'location', 'port', 'rtspUrl', 'onvifUrl']
        },
        {
          name: 'RTSP URL Format',
          example: 'rtsp://admin:pass123@192.168.1.100:554/stream1',
          description: 'Standard RTSP URL format with embedded credentials'
        },
        {
          name: 'ONVIF Barcode Format',
          example: 'ONVIF:192.168.1.100:80:admin:pass123:Production Line Camera',
          format: 'ONVIF:ip:onvif_port:username:password:camera_name',
          description: 'Colon-separated format starting with ONVIF prefix'
        },
        {
          name: 'Simple Barcode Format',
          example: '192.168.1.100:554:admin:pass123:Warehouse Cam:Loading Dock',
          format: 'ip:rtsp_port:username:password:name:location',
          description: 'Simple colon-separated format (missing values use defaults)'
        }
      ],
      qrCodeGenerator: 'Use any QR code generator to create stickers for your cameras'
    }
  });
});

/**
 * POST /api/cameras/pair/generate
 * Generate a QR code for camera pairing
 * The camera sees this code and automatically connects
 */
router.post('/pair/generate', async (req, res) => {
  const { qrPairing } = req.app.locals.modules;
  const { cameraName, location, expiresIn } = req.body;
  
  if (!qrPairing) {
    return res.status(501).json({
      code: 'ERROR',
      message: 'QR pairing module not available'
    });
  }
  
  try {
    const result = await qrPairing.generatePairingCode({
      cameraName: cameraName || 'New Camera',
      location: location || 'Unknown',
      expiresIn: expiresIn || 5 * 60 * 1000 // 5 minutes default
    });
    
    res.json({
      code: 'SUCCESS',
      data: {
        token: result.token,
        expiresAt: result.expiresAt,
        qrCode: result.qrDataUrl,
        qrSvg: result.qrSvg,
        instructions: [
          '1. Display this QR code on your screen',
          '2. Point your camera at the QR code',
          '3. The camera will be automatically detected and paired',
          '4. This code expires in 5 minutes'
        ]
      }
    });
  } catch (err) {
    res.status(500).json({
      code: 'ERROR',
      message: 'Failed to generate pairing code: ' + err.message
    });
  }
});

/**
 * GET /api/cameras/pair/status/:token
 * Check the status of a pairing session
 */
router.get('/pair/status/:token', (req, res) => {
  const { qrPairing } = req.app.locals.modules;
  const { token } = req.params;
  
  if (!qrPairing) {
    return res.status(501).json({
      code: 'ERROR',
      message: 'QR pairing module not available'
    });
  }
  
  const status = qrPairing.getSessionStatus(token);
  
  res.json({
    code: 'SUCCESS',
    data: status
  });
});

/**
 * DELETE /api/cameras/pair/:token
 * Cancel a pairing session
 */
router.delete('/pair/:token', (req, res) => {
  const { qrPairing } = req.app.locals.modules;
  const { token } = req.params;
  
  if (!qrPairing) {
    return res.status(501).json({
      code: 'ERROR',
      message: 'QR pairing module not available'
    });
  }
  
  qrPairing.cancelSession(token);
  
  res.json({
    code: 'SUCCESS',
    message: 'Pairing session cancelled'
  });
});

/**
 * POST /api/cameras/pair/test
 * Add an RTSP URL to scan for the pairing code (for testing)
 */
router.post('/pair/test', (req, res) => {
  const { qrPairing } = req.app.locals.modules;
  const { token, rtspUrl } = req.body;
  
  if (!qrPairing) {
    return res.status(501).json({
      code: 'ERROR',
      message: 'QR pairing module not available'
    });
  }
  
  if (!token || !rtspUrl) {
    return res.status(400).json({
      code: 'ERROR',
      message: 'token and rtspUrl are required'
    });
  }
  
  qrPairing.addPendingCamera(rtspUrl, token);
  
  res.json({
    code: 'SUCCESS',
    message: 'Camera added to scanning queue'
  });
});

module.exports = router;

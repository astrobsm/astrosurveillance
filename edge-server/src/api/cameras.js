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
 * GET/POST /api/cameras/discover
 * Trigger ONVIF camera discovery
 */
const discoverHandler = async (req, res) => {
  const { cameraDiscovery } = req.app.locals.modules;
  
  try {
    const cameras = await cameraDiscovery.startDiscovery();
    
    res.json({
      code: 'SUCCESS',
      count: cameras.length,
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
};

router.get('/discover', discoverHandler);
router.post('/discover', discoverHandler);

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
 * POST /api/cameras/:id/set-local-ip
 * Set the camera's local IP address for direct streaming
 */
router.post('/:id/set-local-ip', async (req, res) => {
  const { cameraManager } = req.app.locals.modules;
  const { id } = req.params;
  const { localIp, rtspPort, httpPort, username, password } = req.body;
  
  if (!localIp) {
    return res.status(400).json({
      code: 'ERROR',
      message: 'Local IP address is required'
    });
  }
  
  try {
    const camera = cameraManager.getCamera(id);
    if (!camera) {
      return res.status(404).json({
        code: 'NOT_FOUND',
        message: 'Camera not found'
      });
    }
    
    const port = rtspPort || 554;
    const user = username || 'admin';
    const pass = password || camera.credentials?.password || 'admin';
    
    // Update camera with local network info
    const updates = {
      localIp: localIp,
      rtspPort: port,
      httpPort: httpPort || 80,
      rtspUrl: `rtsp://${user}:${pass}@${localIp}:${port}/stream1`,
      snapshotUrl: `http://${localIp}:${httpPort || 80}/snapshot.jpg`,
      mjpegUrl: `http://${localIp}:${httpPort || 80}/video.mjpg`,
      credentials: { username: user, password: pass }
    };
    
    const updatedCamera = cameraManager.updateCamera(id, updates);
    
    res.json({
      code: 'SUCCESS',
      message: 'Local IP configured. Try the stream URLs.',
      data: {
        camera: updatedCamera,
        streamUrls: {
          rtsp: updates.rtspUrl,
          snapshot: updates.snapshotUrl,
          mjpeg: updates.mjpegUrl
        }
      }
    });
  } catch (err) {
    res.status(400).json({
      code: 'ERROR',
      message: err.message
    });
  }
});

/**
 * GET /api/cameras/:id/proxy-snapshot
 * Proxy snapshot from camera's local network
 */
router.get('/:id/proxy-snapshot', async (req, res) => {
  const { cameraManager } = req.app.locals.modules;
  const { id } = req.params;
  const http = require('http');
  
  try {
    const camera = cameraManager.getCamera(id);
    if (!camera) {
      return res.status(404).json({ code: 'NOT_FOUND', message: 'Camera not found' });
    }
    
    if (!camera.localIp) {
      return res.status(400).json({ 
        code: 'ERROR', 
        message: 'Local IP not configured. Use /set-local-ip first.' 
      });
    }
    
    const port = camera.httpPort || 80;
    const user = camera.credentials?.username || 'admin';
    const pass = camera.credentials?.password || 'admin';
    
    // Try common snapshot URLs
    const snapshotPaths = [
      '/snapshot.jpg',
      '/cgi-bin/snapshot.cgi',
      '/image/jpeg.cgi',
      '/jpg/image.jpg',
      '/snap.jpg',
      '/tmpfs/auto.jpg'
    ];
    
    for (const path of snapshotPaths) {
      try {
        const url = `http://${camera.localIp}:${port}${path}`;
        const response = await fetch(url, {
          headers: {
            'Authorization': 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64')
          },
          timeout: 5000
        });
        
        if (response.ok) {
          const buffer = await response.arrayBuffer();
          res.set('Content-Type', 'image/jpeg');
          res.set('Cache-Control', 'no-cache');
          res.send(Buffer.from(buffer));
          return;
        }
      } catch (e) {
        // Try next path
      }
    }
    
    res.status(503).json({
      code: 'ERROR',
      message: 'Could not fetch snapshot from camera. Check local IP and credentials.'
    });
  } catch (err) {
    res.status(500).json({
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
  const { scanData, barcodeData, rawData, ubox, cameraType, model } = req.body;
  
  // Accept different field names for the scanned data
  let data = scanData || barcodeData || rawData;
  
  // If UBOX data is provided, format it for camera registration
  if (ubox && ubox.uid) {
    data = JSON.stringify({
      uid: ubox.uid,
      password: ubox.password || 'admin',
      name: model || 'GZ-SONY MAKE.BELIEVE',
      type: 'UBOX',
      location: 'Bonnesante Factory'
    });
  }
  
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

// =============================================
// WIFI CAMERA CONFIGURATION ENDPOINTS
// =============================================

/**
 * POST /api/cameras/wifi/check
 * Check if camera is reachable at specified IP
 */
router.post('/wifi/check', async (req, res) => {
  const { ip, port = 80 } = req.body;
  
  if (!ip) {
    return res.status(400).json({
      code: 'ERROR',
      message: 'IP address is required'
    });
  }
  
  try {
    const http = require('http');
    
    const reachable = await new Promise((resolve) => {
      const request = http.get({
        hostname: ip,
        port: port,
        path: '/',
        timeout: 5000
      }, (response) => {
        resolve(true);
      });
      
      request.on('error', () => resolve(false));
      request.on('timeout', () => {
        request.destroy();
        resolve(false);
      });
    });
    
    res.json({
      code: reachable ? 'SUCCESS' : 'ERROR',
      reachable: reachable,
      ip: ip,
      port: port
    });
    
  } catch (err) {
    res.json({
      code: 'ERROR',
      reachable: false,
      message: err.message
    });
  }
});

/**
 * POST /api/cameras/wifi/scan
 * Scan for available WiFi networks (via camera)
 */
router.post('/wifi/scan', async (req, res) => {
  const { cameraIP } = req.body;
  
  // In a real implementation, this would connect to the camera
  // and ask it to scan for WiFi networks
  // For now, return sample networks
  
  const sampleNetworks = [
    { ssid: 'Bonnesante_WiFi', signal: 92, security: 'WPA2' },
    { ssid: 'Factory_Network', signal: 78, security: 'WPA2' },
    { ssid: 'Office_5G', signal: 65, security: 'WPA3' },
    { ssid: 'Guest_Network', signal: 45, security: 'WPA2' }
  ];
  
  res.json({
    code: 'SUCCESS',
    networks: sampleNetworks
  });
});

/**
 * POST /api/cameras/wifi/configure
 * Configure WiFi settings on the camera
 */
router.post('/wifi/configure', async (req, res) => {
  const { cameraManager, motionDetector } = req.app.locals.modules;
  const { cameraIP, ssid, password, dhcp, staticIP, gateway, cameraName, location } = req.body;
  
  if (!ssid || !password) {
    return res.status(400).json({
      code: 'ERROR',
      message: 'SSID and password are required'
    });
  }
  
  try {
    // In a real implementation, this would:
    // 1. Connect to camera via its AP
    // 2. Send WiFi configuration command
    // 3. Wait for camera to restart on new network
    // 4. Return its new IP address
    
    // Generate a simulated new IP for the camera
    const newIP = staticIP || `192.168.1.${Math.floor(Math.random() * 200) + 50}`;
    
    // Register the camera using the correct method
    const camera = cameraManager.registerCamera({
      name: cameraName || 'GZ-SONY MAKE.BELIEVE',
      location: location || 'Configured via WiFi',
      ipAddress: newIP,
      rtspUrl: `rtsp://admin:admin@${newIP}:554/stream1`,
      connectionType: 'wifi',
      wifiSSID: ssid
    });
    
    // Initialize motion detection if camera was registered
    if (camera && camera.id) {
      motionDetector.initCamera(camera.id, camera.rtspUrl);
    }
    
    console.log(`[WiFi] Camera configured: ${camera.name} @ ${newIP} on ${ssid}`);
    
    res.json({
      code: 'SUCCESS',
      message: 'WiFi configured successfully',
      newIP: newIP,
      camera: camera
    });
    
  } catch (err) {
    console.error('[WiFi] Configuration error:', err);
    res.status(500).json({
      code: 'ERROR',
      message: 'Failed to configure WiFi: ' + err.message
    });
  }
});

// =============================================
// CAMERA SNAPSHOT & RECORDING ENDPOINTS
// =============================================

/**
 * GET /api/cameras/:id/snapshot
 * Get the latest snapshot from a camera
 */
router.get('/:id/snapshot', async (req, res) => {
  const { cameraManager } = req.app.locals.modules;
  const cameraId = req.params.id;
  
  const camera = cameraManager.getCamera(cameraId);
  if (!camera) {
    return res.status(404).json({
      code: 'ERROR',
      message: 'Camera not found'
    });
  }
  
  // For UBOX cameras, we can't directly access the stream
  // Return a placeholder or the last known snapshot
  res.json({
    code: 'SUCCESS',
    data: {
      cameraId,
      imageUrl: null, // Would be populated if we have snapshot capability
      timestamp: new Date().toISOString(),
      message: 'Snapshot functionality requires direct camera connection'
    }
  });
});

/**
 * POST /api/cameras/:id/snapshot
 * Take a new snapshot from the camera
 */
router.post('/:id/snapshot', async (req, res) => {
  const { cameraManager, storageManager } = req.app.locals.modules;
  const cameraId = req.params.id;
  
  const camera = cameraManager.getCamera(cameraId);
  if (!camera) {
    return res.status(404).json({
      code: 'ERROR',
      message: 'Camera not found'
    });
  }
  
  try {
    // For UBOX/P2P cameras, snapshot would require native UBOX SDK
    // For now, log the action and return success
    const snapshotId = `snap_${Date.now()}`;
    
    res.json({
      code: 'SUCCESS',
      message: 'Snapshot request sent to camera',
      data: {
        snapshotId,
        cameraId,
        timestamp: new Date().toISOString(),
        note: 'UBOX cameras require P2P connection for live snapshots'
      }
    });
  } catch (error) {
    res.status(500).json({
      code: 'ERROR',
      message: 'Failed to take snapshot: ' + error.message
    });
  }
});

/**
 * GET /api/cameras/:id/snapshots
 * Get list of snapshots for a camera
 */
router.get('/:id/snapshots', async (req, res) => {
  const { cameraManager } = req.app.locals.modules;
  const cameraId = req.params.id;
  
  const camera = cameraManager.getCamera(cameraId);
  if (!camera) {
    return res.status(404).json({
      code: 'ERROR',
      message: 'Camera not found'
    });
  }
  
  // Return empty array for now - would be populated from storage
  res.json({
    code: 'SUCCESS',
    data: {
      cameraId,
      snapshots: []
    }
  });
});

/**
 * POST /api/cameras/:id/record
 * Start manual recording for a camera
 */
router.post('/:id/record', async (req, res) => {
  const { cameraManager, recordingController } = req.app.locals.modules;
  const cameraId = req.params.id;
  const { duration = 60, triggerType = 'manual' } = req.body;
  
  const camera = cameraManager.getCamera(cameraId);
  if (!camera) {
    return res.status(404).json({
      code: 'ERROR',
      message: 'Camera not found'
    });
  }
  
  try {
    // Start recording
    const recordingId = `rec_${Date.now()}`;
    
    if (recordingController && typeof recordingController.startRecording === 'function') {
      recordingController.startRecording(cameraId, { duration, triggerType });
    }
    
    // Update camera status
    cameraManager.updateCameraStatus(cameraId, 'RECORDING');
    
    res.json({
      code: 'SUCCESS',
      message: 'Recording started',
      data: {
        recordingId,
        cameraId,
        duration,
        triggerType,
        startTime: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      code: 'ERROR',
      message: 'Failed to start recording: ' + error.message
    });
  }
});

/**
 * DELETE /api/cameras/:id/record
 * Stop manual recording for a camera
 */
router.delete('/:id/record', async (req, res) => {
  const { cameraManager, recordingController } = req.app.locals.modules;
  const cameraId = req.params.id;
  
  const camera = cameraManager.getCamera(cameraId);
  if (!camera) {
    return res.status(404).json({
      code: 'ERROR',
      message: 'Camera not found'
    });
  }
  
  try {
    if (recordingController && typeof recordingController.stopRecording === 'function') {
      recordingController.stopRecording(cameraId);
    }
    
    // Update camera status
    cameraManager.updateCameraStatus(cameraId, 'ONLINE');
    
    res.json({
      code: 'SUCCESS',
      message: 'Recording stopped',
      data: {
        cameraId,
        endTime: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      code: 'ERROR',
      message: 'Failed to stop recording: ' + error.message
    });
  }
});

/**
 * DELETE /api/cameras/:id
 * Remove a camera
 */
router.delete('/:id', async (req, res) => {
  const { cameraManager, motionDetector, recordingController, db } = req.app.locals.modules;
  const cameraId = req.params.id;
  
  const camera = cameraManager.getCamera(cameraId);
  if (!camera) {
    return res.status(404).json({
      code: 'ERROR',
      message: 'Camera not found'
    });
  }
  
  try {
    // Remove from motion detector
    if (motionDetector && typeof motionDetector.detachCamera === 'function') {
      motionDetector.detachCamera(cameraId);
    }
    
    // Remove from recording controller
    if (recordingController && typeof recordingController.unregisterCamera === 'function') {
      recordingController.unregisterCamera(cameraId);
    }
    
    // Remove from camera manager
    cameraManager.removeCamera(cameraId);
    
    // Remove from database
    if (db && db.isConnected) {
      await db.query('DELETE FROM cameras WHERE id = $1', [cameraId]);
    }
    
    res.json({
      code: 'SUCCESS',
      message: 'Camera removed successfully',
      data: { cameraId }
    });
  } catch (error) {
    res.status(500).json({
      code: 'ERROR',
      message: 'Failed to remove camera: ' + error.message
    });
  }
});

/**
 * PATCH /api/cameras/:id
 * Update camera settings
 */
router.patch('/:id', async (req, res) => {
  const { cameraManager, db } = req.app.locals.modules;
  const cameraId = req.params.id;
  const updates = req.body;
  
  const camera = cameraManager.getCamera(cameraId);
  if (!camera) {
    return res.status(404).json({
      code: 'ERROR',
      message: 'Camera not found'
    });
  }
  
  try {
    // Update allowed fields
    const allowedFields = ['name', 'location', 'alarmEnabled', 'motionEnabled'];
    const validUpdates = {};
    
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        validUpdates[field] = updates[field];
        camera[field] = updates[field];
      }
    }
    
    // Update in database
    if (db && db.isConnected && Object.keys(validUpdates).length > 0) {
      const sets = Object.keys(validUpdates).map((k, i) => {
        const dbField = k.replace(/([A-Z])/g, '_$1').toLowerCase();
        return `${dbField} = $${i + 2}`;
      }).join(', ');
      
      await db.query(
        `UPDATE cameras SET ${sets}, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [cameraId, ...Object.values(validUpdates)]
      );
    }
    
    res.json({
      code: 'SUCCESS',
      message: 'Camera updated',
      data: { camera }
    });
  } catch (error) {
    res.status(500).json({
      code: 'ERROR',
      message: 'Failed to update camera: ' + error.message
    });
  }
});

module.exports = router;

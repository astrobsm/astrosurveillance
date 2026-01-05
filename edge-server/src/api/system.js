/**
 * ASTROSURVEILLANCE - System API Routes
 * 
 * Endpoints for system management, security, and pairing.
 */

const express = require('express');
const router = express.Router();
const os = require('os');
const db = require('../database');

/**
 * GET /api/system/info
 * Get system information
 */
router.get('/info', async (req, res) => {
  const { config } = req.app.locals.modules;
  
  // Get network interfaces for discovering server IP
  const networkInterfaces = os.networkInterfaces();
  const addresses = [];
  
  for (const [name, interfaces] of Object.entries(networkInterfaces)) {
    for (const iface of interfaces) {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push({
          interface: name,
          address: iface.address
        });
      }
    }
  }
  
  // Check database status
  let dbStatus = { connected: false };
  if (db.isConnected) {
    try {
      dbStatus = await db.healthCheck();
      dbStatus.connected = true;
    } catch (e) {
      dbStatus = { connected: false, error: e.message };
    }
  }
  
  res.json({
    code: 'SUCCESS',
    data: {
      name: 'ASTROSURVEILLANCE',
      version: '1.0.0',
      platform: os.platform(),
      hostname: os.hostname(),
      uptime: process.uptime(),
      serverPort: config.server.port,
      networkAddresses: addresses,
      database: dbStatus,
      timestamp: new Date().toISOString()
    }
  });
});

/**
 * GET /api/system/status
 * Get complete system status
 */
router.get('/status', (req, res) => {
  const { cameraManager, alarmController, storageManager, recordingController } = req.app.locals.modules;
  
  res.json({
    code: 'SUCCESS',
    data: {
      cameras: cameraManager.getCameraCount(),
      alarm: alarmController.getState(),
      storage: storageManager.getHealth(),
      recordings: recordingController.getAllStates(),
      uptime: process.uptime(),
      memory: {
        used: process.memoryUsage().heapUsed,
        total: process.memoryUsage().heapTotal
      }
    }
  });
});

/**
 * GET /api/system/diagnostic
 * Get diagnostic info for debugging
 */
router.get('/diagnostic', async (req, res) => {
  const { cameraManager } = req.app.locals.modules;
  
  let dbStatus = { connected: false };
  let dbCameras = [];
  
  if (db.isConnected) {
    try {
      dbStatus = await db.healthCheck();
      dbStatus.connected = true;
      
      // Get cameras directly from database
      const result = await db.query('SELECT id, name, uid, camera_type, location FROM cameras');
      dbCameras = result.rows || [];
    } catch (e) {
      dbStatus.error = e.message;
    }
  }
  
  res.json({
    code: 'SUCCESS',
    data: {
      database: dbStatus,
      camerasInDatabase: dbCameras,
      camerasInMemory: cameraManager.getAllCameras().map(c => ({
        id: c.id,
        name: c.name,
        uid: c.uid,
        type: c.type,
        location: c.location
      })),
      dbHasConnection: !!db,
      dbIsConnected: db?.isConnected || false,
      cameraManagerHasDb: !!cameraManager.db,
      timestamp: new Date().toISOString()
    }
  });
});

/**
 * POST /api/system/pair
 * Generate pairing QR code for mobile app
 */
router.post('/pair', async (req, res) => {
  const { cameraDiscovery, config } = req.app.locals.modules;
  
  // Get server IP
  const networkInterfaces = os.networkInterfaces();
  let serverIp = '127.0.0.1';
  
  for (const interfaces of Object.values(networkInterfaces)) {
    for (const iface of interfaces) {
      if (iface.family === 'IPv4' && !iface.internal) {
        serverIp = iface.address;
        break;
      }
    }
  }
  
  try {
    const pairing = await cameraDiscovery.generatePairingQR(serverIp, config.server.port);
    
    res.json({
      code: 'SUCCESS',
      data: pairing
    });
  } catch (err) {
    res.status(500).json({
      code: 'ERROR',
      message: 'Failed to generate pairing QR: ' + err.message
    });
  }
});

/**
 * POST /api/system/validate-pairing
 * Validate a pairing token
 */
router.post('/validate-pairing', (req, res) => {
  const { cameraDiscovery, securityManager } = req.app.locals.modules;
  const { token, deviceId } = req.body;
  
  if (!token) {
    return res.status(400).json({
      code: 'ERROR',
      message: 'Token is required'
    });
  }
  
  if (cameraDiscovery.validatePairingToken(token)) {
    // Generate session for the paired device
    const pairingToken = securityManager.generatePairingToken(deviceId);
    const session = securityManager.createSession(pairingToken.token, false);
    
    res.json({
      code: 'SUCCESS',
      message: 'Pairing successful',
      data: {
        pairingToken: pairingToken.token,
        session
      }
    });
  } else {
    res.status(401).json({
      code: 'UNAUTHORIZED',
      message: 'Invalid or expired pairing token'
    });
  }
});

/**
 * POST /api/system/admin-login
 * Authenticate as admin with PIN
 */
router.post('/admin-login', (req, res) => {
  const { securityManager } = req.app.locals.modules;
  const { pin, pairingToken } = req.body;
  const clientIp = req.ip;
  
  if (!pin) {
    return res.status(400).json({
      code: 'ERROR',
      message: 'PIN is required'
    });
  }
  
  if (securityManager.authenticateAdmin(pin, clientIp)) {
    // Create admin session
    const session = securityManager.createSession(pairingToken, true);
    
    res.json({
      code: 'SUCCESS',
      message: 'Admin login successful',
      data: session
    });
  } else {
    res.status(401).json({
      code: 'UNAUTHORIZED',
      message: 'Invalid PIN or account locked'
    });
  }
});

/**
 * POST /api/system/logout
 * Logout and revoke session
 */
router.post('/logout', (req, res) => {
  const { securityManager } = req.app.locals.modules;
  const sessionId = req.headers['x-session-id'];
  
  if (sessionId) {
    securityManager.revokeSession(sessionId);
  }
  
  res.json({
    code: 'SUCCESS',
    message: 'Logged out'
  });
});

/**
 * PUT /api/system/admin-pin
 * Update admin PIN (requires admin session)
 */
router.put('/admin-pin', (req, res) => {
  const { securityManager } = req.app.locals.modules;
  const { currentPin, newPin } = req.body;
  
  if (!currentPin || !newPin) {
    return res.status(400).json({
      code: 'ERROR',
      message: 'Current PIN and new PIN are required'
    });
  }
  
  if (securityManager.updateAdminPin(currentPin, newPin)) {
    res.json({
      code: 'SUCCESS',
      message: 'PIN updated successfully'
    });
  } else {
    res.status(400).json({
      code: 'ERROR',
      message: 'Failed to update PIN - check current PIN'
    });
  }
});

/**
 * GET /api/system/devices
 * Get list of paired devices
 */
router.get('/devices', (req, res) => {
  const { securityManager } = req.app.locals.modules;
  
  res.json({
    code: 'SUCCESS',
    data: {
      devices: securityManager.getPairedDevices()
    }
  });
});

/**
 * POST /api/system/restart
 * Restart the edge server (admin only)
 */
router.post('/restart', (req, res) => {
  res.json({
    code: 'SUCCESS',
    message: 'Restart initiated'
  });
  
  // Schedule restart
  setTimeout(() => {
    process.exit(0);
  }, 1000);
});

module.exports = router;

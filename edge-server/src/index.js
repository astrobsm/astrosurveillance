/**
 * ASTROSURVEILLANCE - Edge Server Entry Point
 * 
 * This is the main server that orchestrates all surveillance modules.
 * Runs on the edge device (Raspberry Pi / Industrial PC) connected to cameras.
 */

// Load environment variables first
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');

// Load configuration
const config = require('../config/default.json');

// Import database
const db = require('./database');

// Import core modules
const CameraManager = require('./modules/CameraManager');
const RecordingController = require('./modules/RecordingController');
const MotionDetector = require('./modules/MotionDetector');
const AlarmController = require('./modules/AlarmController');
const StorageManager = require('./modules/StorageManager');
const CameraDiscovery = require('./modules/CameraDiscovery');
const SecurityManager = require('./modules/SecurityManager');
const QRPairing = require('./modules/QRPairing');
const Logger = require('./utils/Logger');

// Import API routes
const cameraRoutes = require('./api/cameras');
const recordingRoutes = require('./api/recordings');
const alarmRoutes = require('./api/alarms');
const storageRoutes = require('./api/storage');
const systemRoutes = require('./api/system');

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Initialize WebSocket for real-time updates
const wss = new WebSocket.Server({ server, path: '/ws' });

// Middleware
app.use(cors({
  origin: '*', // Allow all origins for LAN access
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Pairing-Token']
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Favicon fallback
app.get('/favicon.ico', (req, res) => {
  res.redirect('/favicon.svg');
});

// Request logging middleware
app.use((req, res, next) => {
  Logger.info(`${req.method} ${req.path}`, { ip: req.ip });
  next();
});

// Initialize core modules
const storageManager = new StorageManager(config.storage);
const alarmController = new AlarmController(config.alarm);
const securityManager = new SecurityManager(config.security);
const cameraDiscovery = new CameraDiscovery(config.cameras);
const cameraManager = new CameraManager(config.cameras);
const motionDetector = new MotionDetector(config.motionDetection);
const recordingController = new RecordingController(config.recording, storageManager);
const qrPairing = new QRPairing(cameraManager, cameraDiscovery);

// Connect database to CameraManager for persistence
cameraManager.setDatabase(db);

// Load cameras from database on startup
(async () => {
  try {
    await cameraManager.loadFromDatabase();
    Logger.info('Cameras loaded from database');
  } catch (error) {
    Logger.warn('Failed to load cameras from database', { error: error.message });
  }
})();

// Make modules available to routes
app.locals.modules = {
  storageManager,
  alarmController,
  securityManager,
  cameraDiscovery,
  cameraManager,
  motionDetector,
  recordingController,
  qrPairing,
  config,
  wss,
  db
};

// WebSocket connection handler
wss.on('connection', (ws, req) => {
  Logger.info('New WebSocket connection', { ip: req.socket.remoteAddress });
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      handleWebSocketMessage(ws, data);
    } catch (error) {
      Logger.error('WebSocket message parse error', { error: error.message });
    }
  });
  
  ws.on('close', () => {
    Logger.info('WebSocket connection closed');
  });
  
  // Send initial state
  ws.send(JSON.stringify({
    type: 'INITIAL_STATE',
    data: {
      cameras: cameraManager.getAllCameras(),
      storageHealth: storageManager.getHealth(),
      alarmState: alarmController.getState()
    }
  }));
});

// Broadcast to all WebSocket clients
function broadcast(type, data) {
  const message = JSON.stringify({ type, data, timestamp: new Date().toISOString() });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// Handle WebSocket messages
function handleWebSocketMessage(ws, data) {
  switch (data.type) {
    case 'PING':
      ws.send(JSON.stringify({ type: 'PONG', timestamp: new Date().toISOString() }));
      break;
    case 'GET_CAMERAS':
      ws.send(JSON.stringify({ type: 'CAMERAS', data: cameraManager.getAllCameras() }));
      break;
    case 'GET_ALARM_STATE':
      ws.send(JSON.stringify({ type: 'ALARM_STATE', data: alarmController.getState() }));
      break;
    default:
      Logger.warn('Unknown WebSocket message type', { type: data.type });
  }
}

// Event listeners for real-time broadcasts
motionDetector.on('motion', (cameraId, event) => {
  Logger.info('Motion detected', { cameraId, event });
  broadcast('MOTION_DETECTED', { cameraId, event });
  
  // Trigger alarm
  alarmController.trigger(cameraId);
  
  // Start recording
  recordingController.startRecording(cameraId);
});

recordingController.on('recordingStarted', (cameraId) => {
  broadcast('RECORDING_STARTED', { cameraId });
});

recordingController.on('recordingComplete', (cameraId, filename) => {
  broadcast('RECORDING_COMPLETE', { cameraId, filename });
});

alarmController.on('alarmTriggered', (cameraId) => {
  broadcast('ALARM_TRIGGERED', { cameraId });
});

alarmController.on('alarmStopped', () => {
  broadcast('ALARM_STOPPED', {});
});

// Camera events - broadcast to all clients for cross-device sync
cameraManager.on('cameraRegistered', (camera) => {
  broadcast('CAMERA_ADDED', { camera });
});

cameraManager.on('cameraRemoved', (cameraId) => {
  broadcast('CAMERA_REMOVED', { cameraId });
});

cameraManager.on('cameraStatusChange', (cameraId, status) => {
  broadcast('CAMERA_STATUS', { cameraId, status });
});

storageManager.on('storageWarning', (usage) => {
  broadcast('STORAGE_WARNING', { usagePercent: usage });
});

// API Routes
app.use('/api/cameras', cameraRoutes);
app.use('/api/recordings', recordingRoutes);
app.use('/api/alarms', alarmRoutes);
app.use('/api/alarm', alarmRoutes);  // Also mount at /api/alarm for client compatibility
app.use('/api/storage', storageRoutes);
app.use('/api/system', systemRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    version: '1.0.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Serve the main web interface for root and non-API routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  Logger.error('API Error', { error: err.message, stack: err.stack });
  res.status(err.status || 500).json({
    code: 'ERROR',
    message: err.message || 'Internal server error'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    code: 'NOT_FOUND',
    message: 'Endpoint not found'
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  Logger.info('SIGTERM received, shutting down gracefully');
  
  // Stop all recordings
  await recordingController.stopAll();
  
  // Close database connections
  await db.close();
  
  // Close WebSocket connections
  wss.clients.forEach((client) => {
    client.close();
  });
  
  // Close HTTP server
  server.close(() => {
    Logger.info('Server closed');
    process.exit(0);
  });
});

// Start server
const PORT = config.server.port || 8080;
const HOST = config.server.host || '0.0.0.0';

// Initialize database and storage, then start server
async function startServer() {
  try {
    // Initialize database (optional - continues if DB not available)
    if (process.env.DB_HOST || config.database?.host) {
      try {
        await db.initialize(config.database || {});
        Logger.info('Database connected');
      } catch (dbError) {
        Logger.warn('Database connection failed, running without persistence', { error: dbError.message });
      }
    } else {
      Logger.info('No database configured, running in-memory only');
    }
    
    // Initialize storage
    await storageManager.initialize();
    
    // Start HTTP server
    server.listen(PORT, HOST, () => {
      Logger.info(`ASTROSURVEILLANCE Edge Server running`, { host: HOST, port: PORT });
      Logger.info('System ready for surveillance operations');
      
      // Start camera discovery
      cameraDiscovery.startDiscovery().then((cameras) => {
        cameras.forEach((camera) => {
          cameraManager.registerCamera(camera);
          motionDetector.attachCamera(camera);
        });
        Logger.info(`Discovered ${cameras.length} cameras`);
      }).catch((err) => {
        Logger.warn('Camera discovery failed', { error: err.message });
      });
    });
    
  } catch (err) {
    Logger.error('Failed to start server', { error: err.message });
    process.exit(1);
  }
}

startServer();

module.exports = { app, server, broadcast };

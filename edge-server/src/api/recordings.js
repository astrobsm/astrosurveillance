/**
 * ASTROSURVEILLANCE - Recordings API Routes
 * 
 * Endpoints for managing and downloading recordings.
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

/**
 * GET /api/recordings
 * Get all recordings with optional filters
 */
router.get('/', (req, res) => {
  const { storageManager } = req.app.locals.modules;
  const { cameraId, startDate, endDate, limit, offset } = req.query;
  
  const recordings = storageManager.getRecordings({
    cameraId,
    startDate,
    endDate,
    limit: limit ? parseInt(limit) : undefined,
    offset: offset ? parseInt(offset) : undefined
  });
  
  res.json({
    code: 'SUCCESS',
    data: {
      recordings,
      total: recordings.length
    }
  });
});

/**
 * GET /api/recordings/:filename
 * Get a specific recording metadata
 */
router.get('/:filename', (req, res) => {
  const { storageManager } = req.app.locals.modules;
  const { filename } = req.params;
  
  const recording = storageManager.getRecording(filename);
  
  if (!recording) {
    return res.status(404).json({
      code: 'NOT_FOUND',
      message: 'Recording not found'
    });
  }
  
  res.json({
    code: 'SUCCESS',
    data: recording
  });
});

/**
 * GET /api/recordings/:filename/download
 * Download a recording file
 */
router.get('/:filename/download', async (req, res) => {
  const { storageManager } = req.app.locals.modules;
  const { filename } = req.params;
  
  const recording = storageManager.getRecording(filename);
  
  if (!recording) {
    return res.status(404).json({
      code: 'NOT_FOUND',
      message: 'Recording not found'
    });
  }
  
  const filePath = storageManager.getFilePath(filename);
  
  if (!storageManager.fileExists(filename)) {
    return res.status(404).json({
      code: 'NOT_FOUND',
      message: 'Recording file not found on disk'
    });
  }
  
  // Mark as downloaded
  await storageManager.markDownloaded(filename);
  
  // Set headers for download
  res.setHeader('Content-Type', 'video/mp4');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  
  // Stream the file
  const fileStream = fs.createReadStream(filePath);
  fileStream.pipe(res);
  
  fileStream.on('error', (err) => {
    res.status(500).json({
      code: 'ERROR',
      message: 'Failed to stream file'
    });
  });
});

/**
 * GET /api/recordings/:filename/stream
 * Stream a recording for preview (supports range requests)
 */
router.get('/:filename/stream', (req, res) => {
  const { storageManager } = req.app.locals.modules;
  const { filename } = req.params;
  
  const recording = storageManager.getRecording(filename);
  
  if (!recording) {
    return res.status(404).json({
      code: 'NOT_FOUND',
      message: 'Recording not found'
    });
  }
  
  const filePath = storageManager.getFilePath(filename);
  
  if (!storageManager.fileExists(filename)) {
    return res.status(404).json({
      code: 'NOT_FOUND',
      message: 'Recording file not found on disk'
    });
  }
  
  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;
  
  if (range) {
    // Handle range request for video seeking
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunkSize = (end - start) + 1;
    
    const fileStream = fs.createReadStream(filePath, { start, end });
    
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': 'video/mp4'
    });
    
    fileStream.pipe(res);
  } else {
    // No range, send entire file
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type': 'video/mp4'
    });
    
    fs.createReadStream(filePath).pipe(res);
  }
});

/**
 * DELETE /api/recordings/:filename
 * Delete a recording
 */
router.delete('/:filename', async (req, res) => {
  const { storageManager } = req.app.locals.modules;
  const { filename } = req.params;
  
  try {
    await storageManager.deleteRecording(filename);
    
    res.json({
      code: 'SUCCESS',
      message: 'Recording deleted'
    });
  } catch (err) {
    res.status(err.message.includes('not found') ? 404 : 500).json({
      code: 'ERROR',
      message: err.message
    });
  }
});

/**
 * GET /api/recordings/camera/:cameraId
 * Get recordings for a specific camera
 */
router.get('/camera/:cameraId', (req, res) => {
  const { storageManager } = req.app.locals.modules;
  const { cameraId } = req.params;
  const { limit, offset } = req.query;
  
  const recordings = storageManager.getRecordings({
    cameraId,
    limit: limit ? parseInt(limit) : 50,
    offset: offset ? parseInt(offset) : 0
  });
  
  res.json({
    code: 'SUCCESS',
    data: {
      cameraId,
      recordings,
      total: recordings.length
    }
  });
});

/**
 * GET /api/recordings/status
 * Get current recording status for all cameras
 */
router.get('/status/all', (req, res) => {
  const { recordingController } = req.app.locals.modules;
  
  const states = recordingController.getAllStates();
  
  res.json({
    code: 'SUCCESS',
    data: states
  });
});

/**
 * POST /api/recordings/:cameraId/start
 * Manually start recording (for testing)
 */
router.post('/:cameraId/start', (req, res) => {
  const { recordingController } = req.app.locals.modules;
  const { cameraId } = req.params;
  
  const started = recordingController.startRecording(cameraId);
  
  if (started) {
    res.json({
      code: 'SUCCESS',
      message: 'Recording started',
      data: recordingController.getState(cameraId)
    });
  } else {
    res.status(409).json({
      code: 'BUSY',
      message: 'Camera is not in IDLE state',
      data: recordingController.getState(cameraId)
    });
  }
});

/**
 * POST /api/recordings/:cameraId/stop
 * Force stop recording
 */
router.post('/:cameraId/stop', (req, res) => {
  const { recordingController } = req.app.locals.modules;
  const { cameraId } = req.params;
  
  recordingController.forceStop(cameraId);
  
  res.json({
    code: 'SUCCESS',
    message: 'Recording stopped',
    data: recordingController.getState(cameraId)
  });
});

module.exports = router;

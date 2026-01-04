/**
 * ASTROSURVEILLANCE - Storage API Routes
 * 
 * Endpoints for storage management and health monitoring.
 */

const express = require('express');
const router = express.Router();

/**
 * GET /api/storage
 * Get storage health and statistics
 */
router.get('/', (req, res) => {
  const { storageManager } = req.app.locals.modules;
  
  const health = storageManager.getHealth();
  
  res.json({
    code: 'SUCCESS',
    data: health
  });
});

/**
 * GET /api/storage/refresh
 * Force refresh storage statistics
 */
router.get('/refresh', async (req, res) => {
  const { storageManager } = req.app.locals.modules;
  
  try {
    const health = await storageManager.refresh();
    
    res.json({
      code: 'SUCCESS',
      data: health
    });
  } catch (err) {
    res.status(500).json({
      code: 'ERROR',
      message: 'Failed to refresh storage stats'
    });
  }
});

/**
 * POST /api/storage/cleanup
 * Manually trigger storage cleanup
 */
router.post('/cleanup', async (req, res) => {
  const { storageManager } = req.app.locals.modules;
  
  try {
    await storageManager._performCleanup();
    
    res.json({
      code: 'SUCCESS',
      message: 'Cleanup completed',
      data: storageManager.getHealth()
    });
  } catch (err) {
    res.status(500).json({
      code: 'ERROR',
      message: 'Cleanup failed: ' + err.message
    });
  }
});

/**
 * GET /api/storage/index
 * Get raw recording index
 */
router.get('/index', (req, res) => {
  const { storageManager } = req.app.locals.modules;
  
  res.json({
    code: 'SUCCESS',
    data: {
      path: storageManager.indexPath,
      recordings: storageManager.recordings
    }
  });
});

/**
 * GET /api/storage/status
 * Get storage status (alias for /)
 */
router.get('/status', (req, res) => {
  const { storageManager } = req.app.locals.modules;
  
  const health = storageManager.getHealth();
  
  res.json({
    code: 'SUCCESS',
    data: health
  });
});

module.exports = router;

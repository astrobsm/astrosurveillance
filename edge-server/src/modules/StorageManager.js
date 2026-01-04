/**
 * ASTROSURVEILLANCE - Storage Manager Module
 * 
 * Manages SD card storage for video recordings.
 * Implements auto-cleanup when storage reaches 90% capacity.
 * 
 * Storage Safety Rules:
 * - Never overwrite files
 * - Auto-delete oldest files only when SD is 90% full
 * - Maintain index.json for mobile browsing
 */

const EventEmitter = require('events');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const Logger = require('../utils/Logger');
const { StorageHealth, parseVideoFilename } = require('../shared/types');

class StorageManager extends EventEmitter {
  constructor(config) {
    super();
    
    this.config = {
      basePath: config.basePath || './recordings',
      maxUsagePercent: config.maxUsagePercent || 90,
      autoCleanup: config.autoCleanup !== false,
      indexFile: config.indexFile || 'index.json'
    };
    
    this.basePath = path.resolve(this.config.basePath);
    this.indexPath = path.join(this.basePath, this.config.indexFile);
    
    // In-memory recording index
    this.recordings = [];
    
    // Storage stats
    this.stats = {
      totalBytes: 0,
      usedBytes: 0,
      freeBytes: 0,
      usagePercent: 0,
      health: StorageHealth.HEALTHY
    };
    
    Logger.info('StorageManager initialized', { basePath: this.basePath });
  }
  
  /**
   * Initialize storage - create directories and load index
   */
  async initialize() {
    try {
      // Create base directory if it doesn't exist
      await fs.mkdir(this.basePath, { recursive: true });
      
      // Load existing index or create new one
      await this._loadIndex();
      
      // Check storage health
      await this._updateStorageStats();
      
      Logger.info('Storage initialized', {
        recordings: this.recordings.length,
        health: this.stats.health
      });
      
    } catch (err) {
      Logger.error('Failed to initialize storage', { error: err.message });
      throw err;
    }
  }
  
  /**
   * Get base storage path
   * @returns {string}
   */
  getBasePath() {
    return this.basePath;
  }
  
  /**
   * Load recording index from file
   * @private
   */
  async _loadIndex() {
    try {
      const data = await fs.readFile(this.indexPath, 'utf8');
      const index = JSON.parse(data);
      this.recordings = index.recordings || [];
      Logger.debug('Index loaded', { count: this.recordings.length });
    } catch (err) {
      if (err.code === 'ENOENT') {
        // Index doesn't exist, start fresh
        this.recordings = [];
        await this._saveIndex();
        Logger.debug('New index created');
      } else {
        throw err;
      }
    }
  }
  
  /**
   * Save recording index to file
   * @private
   */
  async _saveIndex() {
    const index = {
      version: '1.0',
      lastUpdated: new Date().toISOString(),
      recordings: this.recordings
    };
    
    await fs.writeFile(this.indexPath, JSON.stringify(index, null, 2), 'utf8');
    Logger.debug('Index saved', { count: this.recordings.length });
  }
  
  /**
   * Update storage statistics
   * @private
   */
  async _updateStorageStats() {
    try {
      // Get disk space info (cross-platform approach)
      const { exec } = require('child_process');
      
      // Calculate used space from our recordings
      let usedBytes = 0;
      for (const recording of this.recordings) {
        try {
          const filePath = path.join(this.basePath, recording.filename);
          const stat = await fs.stat(filePath);
          usedBytes += stat.size;
        } catch (err) {
          // File might be missing
        }
      }
      
      // Estimate total space (simplified - in production use proper disk space API)
      // For now, assume 32GB SD card
      const totalBytes = 32 * 1024 * 1024 * 1024; // 32GB
      const freeBytes = totalBytes - usedBytes;
      const usagePercent = (usedBytes / totalBytes) * 100;
      
      this.stats = {
        totalBytes,
        usedBytes,
        freeBytes,
        usagePercent,
        health: this._calculateHealth(usagePercent)
      };
      
      // Check if cleanup needed
      if (this.config.autoCleanup && usagePercent >= this.config.maxUsagePercent) {
        await this._performCleanup();
      }
      
      // Emit warning if needed
      if (this.stats.health === StorageHealth.WARNING) {
        this.emit('storageWarning', usagePercent);
      } else if (this.stats.health === StorageHealth.CRITICAL) {
        this.emit('storageCritical', usagePercent);
      }
      
    } catch (err) {
      Logger.error('Failed to update storage stats', { error: err.message });
      this.stats.health = StorageHealth.ERROR;
    }
  }
  
  /**
   * Calculate storage health based on usage
   * @private
   */
  _calculateHealth(usagePercent) {
    if (usagePercent >= 90) return StorageHealth.CRITICAL;
    if (usagePercent >= 70) return StorageHealth.WARNING;
    return StorageHealth.HEALTHY;
  }
  
  /**
   * Perform cleanup - delete oldest recordings
   * @private
   */
  async _performCleanup() {
    Logger.info('Starting storage cleanup');
    
    // Sort recordings by timestamp (oldest first)
    const sorted = [...this.recordings].sort((a, b) => 
      new Date(a.timestamp) - new Date(b.timestamp)
    );
    
    // Delete oldest recordings until we're under threshold
    let deletedCount = 0;
    const targetUsage = this.config.maxUsagePercent - 10; // Delete until 80%
    
    while (this.stats.usagePercent > targetUsage && sorted.length > 0) {
      const oldest = sorted.shift();
      
      try {
        await this.deleteRecording(oldest.filename, false);
        deletedCount++;
        await this._updateStorageStats();
      } catch (err) {
        Logger.warn('Failed to delete recording during cleanup', {
          filename: oldest.filename,
          error: err.message
        });
      }
    }
    
    Logger.info('Storage cleanup complete', { deletedCount });
    this.emit('cleanupComplete', deletedCount);
  }
  
  /**
   * Add a new recording to the index
   * @param {Object} recording - Recording metadata
   */
  async addRecording(recording) {
    const entry = {
      id: `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      cameraId: recording.cameraId,
      filename: recording.filename,
      timestamp: recording.timestamp,
      duration: recording.duration,
      size: 0, // Will be updated when file is available
      downloaded: false
    };
    
    // Try to get file size
    try {
      const filePath = path.join(this.basePath, recording.filename);
      const stat = await fs.stat(filePath);
      entry.size = stat.size;
    } catch (err) {
      // File might not exist yet
    }
    
    this.recordings.push(entry);
    await this._saveIndex();
    
    // Update storage stats
    await this._updateStorageStats();
    
    Logger.info('Recording added to index', { filename: recording.filename });
    this.emit('recordingAdded', entry);
    
    return entry;
  }
  
  /**
   * Get all recordings
   * @param {Object} filters - Optional filters
   * @returns {Array}
   */
  getRecordings(filters = {}) {
    let result = [...this.recordings];
    
    // Filter by camera
    if (filters.cameraId) {
      result = result.filter(r => r.cameraId === filters.cameraId);
    }
    
    // Filter by date range
    if (filters.startDate) {
      const start = new Date(filters.startDate);
      result = result.filter(r => new Date(r.timestamp) >= start);
    }
    
    if (filters.endDate) {
      const end = new Date(filters.endDate);
      result = result.filter(r => new Date(r.timestamp) <= end);
    }
    
    // Sort by timestamp (newest first by default)
    result.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    // Pagination
    if (filters.limit) {
      const offset = filters.offset || 0;
      result = result.slice(offset, offset + filters.limit);
    }
    
    return result;
  }
  
  /**
   * Get a single recording by ID or filename
   * @param {string} identifier - Recording ID or filename
   * @returns {Object|null}
   */
  getRecording(identifier) {
    return this.recordings.find(r => 
      r.id === identifier || r.filename === identifier
    );
  }
  
  /**
   * Delete a recording
   * @param {string} filename - Recording filename
   * @param {boolean} updateIndex - Whether to save index
   */
  async deleteRecording(filename, updateIndex = true) {
    const filePath = path.join(this.basePath, filename);
    
    try {
      await fs.unlink(filePath);
    } catch (err) {
      if (err.code !== 'ENOENT') {
        throw err;
      }
    }
    
    // Remove from index
    const index = this.recordings.findIndex(r => r.filename === filename);
    if (index !== -1) {
      this.recordings.splice(index, 1);
    }
    
    if (updateIndex) {
      await this._saveIndex();
      await this._updateStorageStats();
    }
    
    Logger.info('Recording deleted', { filename });
    this.emit('recordingDeleted', filename);
  }
  
  /**
   * Get file path for streaming/download
   * @param {string} filename
   * @returns {string}
   */
  getFilePath(filename) {
    return path.join(this.basePath, filename);
  }
  
  /**
   * Check if file exists
   * @param {string} filename
   * @returns {boolean}
   */
  fileExists(filename) {
    const filePath = path.join(this.basePath, filename);
    return fsSync.existsSync(filePath);
  }
  
  /**
   * Mark recording as downloaded
   * @param {string} filename
   */
  async markDownloaded(filename) {
    const recording = this.getRecording(filename);
    if (recording) {
      recording.downloaded = true;
      recording.downloadedAt = new Date().toISOString();
      await this._saveIndex();
    }
  }
  
  /**
   * Get storage health status
   * @returns {Object}
   */
  getHealth() {
    return {
      ...this.stats,
      recordingCount: this.recordings.length,
      autoCleanup: this.config.autoCleanup,
      maxUsagePercent: this.config.maxUsagePercent
    };
  }
  
  /**
   * Force storage stats refresh
   */
  async refresh() {
    await this._updateStorageStats();
    return this.getHealth();
  }
}

module.exports = StorageManager;

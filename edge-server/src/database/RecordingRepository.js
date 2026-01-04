/**
 * ASTROSURVEILLANCE - Recording Repository
 * 
 * Database operations for recordings.
 */

const db = require('./index');

const RecordingRepository = {
  /**
   * Create a new recording
   */
  async create(recording) {
    const query = `
      INSERT INTO recordings (camera_id, filename, filepath, duration_seconds, trigger_type, motion_level, status, started_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    const values = [
      recording.cameraId,
      recording.filename,
      recording.filepath,
      recording.duration || 60,
      recording.triggerType || 'motion',
      recording.motionLevel,
      recording.status || 'recording',
      recording.startedAt || new Date()
    ];
    
    const result = await db.query(query, values);
    return this._mapRow(result.rows[0]);
  },

  /**
   * Mark recording as completed
   */
  async complete(id, fileSize) {
    const result = await db.query(
      `UPDATE recordings 
       SET status = 'completed', completed_at = CURRENT_TIMESTAMP, file_size_bytes = $1 
       WHERE id = $2 RETURNING *`,
      [fileSize, id]
    );
    return result.rows[0] ? this._mapRow(result.rows[0]) : null;
  },

  /**
   * Get recording by ID
   */
  async findById(id) {
    const result = await db.query('SELECT * FROM recordings WHERE id = $1', [id]);
    return result.rows[0] ? this._mapRow(result.rows[0]) : null;
  },

  /**
   * Get all recordings with pagination
   */
  async findAll(options = {}) {
    const limit = options.limit || 50;
    const offset = options.offset || 0;
    const cameraId = options.cameraId;

    let query = 'SELECT * FROM recordings';
    const values = [];

    if (cameraId) {
      query += ' WHERE camera_id = $1';
      values.push(cameraId);
    }

    query += ' ORDER BY created_at DESC LIMIT $' + (values.length + 1) + ' OFFSET $' + (values.length + 2);
    values.push(limit, offset);

    const result = await db.query(query, values);
    return result.rows.map(row => this._mapRow(row));
  },

  /**
   * Get recordings by camera ID
   */
  async findByCameraId(cameraId, limit = 20) {
    const result = await db.query(
      'SELECT * FROM recordings WHERE camera_id = $1 ORDER BY created_at DESC LIMIT $2',
      [cameraId, limit]
    );
    return result.rows.map(row => this._mapRow(row));
  },

  /**
   * Get recordings by date range
   */
  async findByDateRange(startDate, endDate, cameraId = null) {
    let query = 'SELECT * FROM recordings WHERE created_at BETWEEN $1 AND $2';
    const values = [startDate, endDate];

    if (cameraId) {
      query += ' AND camera_id = $3';
      values.push(cameraId);
    }

    query += ' ORDER BY created_at DESC';
    const result = await db.query(query, values);
    return result.rows.map(row => this._mapRow(row));
  },

  /**
   * Get total recording count
   */
  async count(cameraId = null) {
    let query = 'SELECT COUNT(*) as count FROM recordings';
    const values = [];

    if (cameraId) {
      query += ' WHERE camera_id = $1';
      values.push(cameraId);
    }

    const result = await db.query(query, values);
    return parseInt(result.rows[0].count);
  },

  /**
   * Get total storage used
   */
  async getTotalSize() {
    const result = await db.query('SELECT COALESCE(SUM(file_size_bytes), 0) as total FROM recordings');
    return parseInt(result.rows[0].total);
  },

  /**
   * Delete recording
   */
  async delete(id) {
    const result = await db.query('DELETE FROM recordings WHERE id = $1 RETURNING filepath', [id]);
    return result.rows[0]?.filepath;
  },

  /**
   * Delete old recordings (for cleanup)
   */
  async deleteOlderThan(days) {
    const result = await db.query(
      `DELETE FROM recordings 
       WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '${days} days' 
       RETURNING filepath`
    );
    return result.rows.map(row => row.filepath);
  },

  /**
   * Get recording statistics
   */
  async getStats() {
    const result = await db.query(`
      SELECT 
        COUNT(*) as total_count,
        COALESCE(SUM(file_size_bytes), 0) as total_size,
        COALESCE(AVG(duration_seconds), 60) as avg_duration,
        COUNT(*) FILTER (WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '24 hours') as last_24h,
        COUNT(*) FILTER (WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '7 days') as last_7d
      FROM recordings
    `);
    return {
      totalCount: parseInt(result.rows[0].total_count),
      totalSizeBytes: parseInt(result.rows[0].total_size),
      avgDuration: parseFloat(result.rows[0].avg_duration),
      last24Hours: parseInt(result.rows[0].last_24h),
      last7Days: parseInt(result.rows[0].last_7d)
    };
  },

  /**
   * Map database row to recording object
   */
  _mapRow(row) {
    return {
      id: row.id,
      cameraId: row.camera_id,
      filename: row.filename,
      filepath: row.filepath,
      duration: row.duration_seconds,
      fileSize: row.file_size_bytes,
      triggerType: row.trigger_type,
      motionLevel: row.motion_level,
      status: row.status,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      createdAt: row.created_at
    };
  }
};

module.exports = RecordingRepository;

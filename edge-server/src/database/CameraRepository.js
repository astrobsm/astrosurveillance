/**
 * ASTROSURVEILLANCE - Camera Repository
 * 
 * Database operations for cameras.
 */

const db = require('./index');
const Logger = require('../utils/Logger');

const CameraRepository = {
  /**
   * Create a new camera
   */
  async create(camera) {
    const query = `
      INSERT INTO cameras (id, name, location, rtsp_url, onvif_url, username, password_encrypted, status, alarm_enabled, motion_enabled)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;
    const values = [
      camera.id,
      camera.name,
      camera.location,
      camera.rtspUrl,
      camera.onvifUrl,
      camera.credentials?.username,
      camera.credentials?.password, // TODO: encrypt this
      camera.status || 'INITIALIZING',
      camera.alarmEnabled !== false,
      camera.motionEnabled !== false
    ];
    
    const result = await db.query(query, values);
    return this._mapRow(result.rows[0]);
  },

  /**
   * Get camera by ID
   */
  async findById(id) {
    const result = await db.query('SELECT * FROM cameras WHERE id = $1', [id]);
    return result.rows[0] ? this._mapRow(result.rows[0]) : null;
  },

  /**
   * Get all cameras
   */
  async findAll() {
    const result = await db.query('SELECT * FROM cameras ORDER BY created_at DESC');
    return result.rows.map(row => this._mapRow(row));
  },

  /**
   * Get cameras by status
   */
  async findByStatus(status) {
    const result = await db.query('SELECT * FROM cameras WHERE status = $1', [status]);
    return result.rows.map(row => this._mapRow(row));
  },

  /**
   * Update camera
   */
  async update(id, updates) {
    const allowedFields = ['name', 'location', 'status', 'alarm_enabled', 'motion_enabled', 'last_seen'];
    const setClauses = [];
    const values = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      const dbField = this._toSnakeCase(key);
      if (allowedFields.includes(dbField)) {
        setClauses.push(`${dbField} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }

    if (setClauses.length === 0) return null;

    values.push(id);
    const query = `UPDATE cameras SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
    
    const result = await db.query(query, values);
    return result.rows[0] ? this._mapRow(result.rows[0]) : null;
  },

  /**
   * Update camera status
   */
  async updateStatus(id, status) {
    const result = await db.query(
      'UPDATE cameras SET status = $1, last_seen = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [status, id]
    );
    return result.rows[0] ? this._mapRow(result.rows[0]) : null;
  },

  /**
   * Increment recording count
   */
  async incrementRecordingCount(id) {
    await db.query('UPDATE cameras SET recording_count = recording_count + 1 WHERE id = $1', [id]);
  },

  /**
   * Delete camera
   */
  async delete(id) {
    const result = await db.query('DELETE FROM cameras WHERE id = $1 RETURNING id', [id]);
    return result.rowCount > 0;
  },

  /**
   * Get camera statistics
   */
  async getStats() {
    const result = await db.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'ONLINE') as online,
        COUNT(*) FILTER (WHERE status = 'OFFLINE') as offline,
        COUNT(*) FILTER (WHERE status = 'RECORDING') as recording,
        COUNT(*) FILTER (WHERE status = 'ERROR') as error
      FROM cameras
    `);
    return result.rows[0];
  },

  /**
   * Map database row to camera object
   */
  _mapRow(row) {
    return {
      id: row.id,
      name: row.name,
      location: row.location,
      rtspUrl: row.rtsp_url,
      onvifUrl: row.onvif_url,
      status: row.status,
      alarmEnabled: row.alarm_enabled,
      motionEnabled: row.motion_enabled,
      recordingCount: row.recording_count,
      lastSeen: row.last_seen,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  },

  /**
   * Convert camelCase to snake_case
   */
  _toSnakeCase(str) {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }
};

module.exports = CameraRepository;

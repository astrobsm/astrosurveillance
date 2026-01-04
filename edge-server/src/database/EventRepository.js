/**
 * ASTROSURVEILLANCE - Event Repository
 * 
 * Database operations for motion events, alarm events, and system logs.
 */

const db = require('./index');

const EventRepository = {
  // ==================== MOTION EVENTS ====================

  /**
   * Log a motion event
   */
  async createMotionEvent(event) {
    const query = `
      INSERT INTO motion_events (camera_id, motion_level, threshold, triggered_recording, recording_id)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const result = await db.query(query, [
      event.cameraId,
      event.motionLevel,
      event.threshold,
      event.triggeredRecording || false,
      event.recordingId
    ]);
    return result.rows[0];
  },

  /**
   * Get recent motion events
   */
  async getMotionEvents(options = {}) {
    const limit = options.limit || 50;
    const cameraId = options.cameraId;
    
    let query = 'SELECT * FROM motion_events';
    const values = [];
    
    if (cameraId) {
      query += ' WHERE camera_id = $1';
      values.push(cameraId);
    }
    
    query += ' ORDER BY detected_at DESC LIMIT $' + (values.length + 1);
    values.push(limit);
    
    const result = await db.query(query, values);
    return result.rows;
  },

  /**
   * Get motion event count by hour (for analytics)
   */
  async getMotionEventsByHour(hours = 24) {
    const result = await db.query(`
      SELECT 
        date_trunc('hour', detected_at) as hour,
        COUNT(*) as count
      FROM motion_events
      WHERE detected_at > CURRENT_TIMESTAMP - INTERVAL '${hours} hours'
      GROUP BY date_trunc('hour', detected_at)
      ORDER BY hour DESC
    `);
    return result.rows;
  },

  // ==================== ALARM EVENTS ====================

  /**
   * Log an alarm event
   */
  async createAlarmEvent(event) {
    const query = `
      INSERT INTO alarm_events (camera_id, trigger_source, duration_seconds, volume_level)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    const result = await db.query(query, [
      event.cameraId,
      event.triggerSource,
      event.duration,
      event.volumeLevel
    ]);
    return result.rows[0];
  },

  /**
   * Mark alarm as stopped
   */
  async stopAlarmEvent(id, stoppedBy) {
    const result = await db.query(
      'UPDATE alarm_events SET stopped_at = CURRENT_TIMESTAMP, stopped_by = $1 WHERE id = $2 RETURNING *',
      [stoppedBy, id]
    );
    return result.rows[0];
  },

  /**
   * Get recent alarm events
   */
  async getAlarmEvents(limit = 50) {
    const result = await db.query(
      'SELECT * FROM alarm_events ORDER BY started_at DESC LIMIT $1',
      [limit]
    );
    return result.rows;
  },

  /**
   * Get last active alarm
   */
  async getLastActiveAlarm() {
    const result = await db.query(
      'SELECT * FROM alarm_events WHERE stopped_at IS NULL ORDER BY started_at DESC LIMIT 1'
    );
    return result.rows[0];
  },

  // ==================== SYSTEM EVENTS ====================

  /**
   * Log a system event
   */
  async createSystemEvent(event) {
    const query = `
      INSERT INTO system_events (event_type, severity, message, metadata)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    const result = await db.query(query, [
      event.type,
      event.severity || 'info',
      event.message,
      JSON.stringify(event.metadata || {})
    ]);
    return result.rows[0];
  },

  /**
   * Get system events
   */
  async getSystemEvents(options = {}) {
    const limit = options.limit || 100;
    const type = options.type;
    const severity = options.severity;
    
    let query = 'SELECT * FROM system_events WHERE 1=1';
    const values = [];
    let paramIndex = 1;
    
    if (type) {
      query += ` AND event_type = $${paramIndex}`;
      values.push(type);
      paramIndex++;
    }
    
    if (severity) {
      query += ` AND severity = $${paramIndex}`;
      values.push(severity);
      paramIndex++;
    }
    
    query += ` ORDER BY created_at DESC LIMIT $${paramIndex}`;
    values.push(limit);
    
    const result = await db.query(query, values);
    return result.rows;
  },

  // ==================== ANALYTICS ====================

  /**
   * Get event summary for dashboard
   */
  async getEventSummary(hours = 24) {
    const result = await db.query(`
      SELECT
        (SELECT COUNT(*) FROM motion_events WHERE detected_at > CURRENT_TIMESTAMP - INTERVAL '${hours} hours') as motion_count,
        (SELECT COUNT(*) FROM alarm_events WHERE started_at > CURRENT_TIMESTAMP - INTERVAL '${hours} hours') as alarm_count,
        (SELECT COUNT(*) FROM recordings WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '${hours} hours') as recording_count,
        (SELECT COUNT(*) FROM system_events WHERE severity = 'error' AND created_at > CURRENT_TIMESTAMP - INTERVAL '${hours} hours') as error_count
    `);
    return {
      motionEvents: parseInt(result.rows[0].motion_count),
      alarmEvents: parseInt(result.rows[0].alarm_count),
      recordings: parseInt(result.rows[0].recording_count),
      errors: parseInt(result.rows[0].error_count),
      period: `${hours}h`
    };
  },

  /**
   * Get recent events for dashboard (combined feed)
   */
  async getRecentEvents(limit = 20) {
    const result = await db.query(`
      (
        SELECT 'motion' as type, camera_id, motion_level as details, detected_at as timestamp
        FROM motion_events
        ORDER BY detected_at DESC
        LIMIT $1
      )
      UNION ALL
      (
        SELECT 'alarm' as type, camera_id, trigger_source as details, started_at as timestamp
        FROM alarm_events
        ORDER BY started_at DESC
        LIMIT $1
      )
      UNION ALL
      (
        SELECT 'recording' as type, camera_id, filename as details, created_at as timestamp
        FROM recordings
        ORDER BY created_at DESC
        LIMIT $1
      )
      ORDER BY timestamp DESC
      LIMIT $1
    `, [limit]);
    
    return result.rows;
  }
};

module.exports = EventRepository;

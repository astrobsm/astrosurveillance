/**
 * ASTROSURVEILLANCE - Database Module
 * 
 * PostgreSQL database connection and query management.
 * Handles connection pooling, schema initialization, and common queries.
 */

const { Pool } = require('pg');
const Logger = require('../utils/Logger');

class Database {
  constructor() {
    this.pool = null;
    this.isConnected = false;
  }

  /**
   * Initialize database connection
   * @param {Object} config - Database configuration
   */
  async initialize(config = {}) {
    let dbConfig;
    
    // PRIORITIZE individual DB_* variables over DATABASE_URL
    // (DATABASE_URL might be auto-injected incorrectly by DigitalOcean)
    if (process.env.DB_HOST && process.env.DB_HOST.includes('ondigitalocean.com')) {
      // Use individual environment variables (preferred)
      const useSSL = config.ssl !== undefined ? config.ssl : (process.env.DB_SSL === 'true' || true);
      const sslConfig = useSSL ? { rejectUnauthorized: false } : false;

      dbConfig = {
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT || 25060, 10),
        database: process.env.DB_NAME || 'defaultdb',
        user: process.env.DB_USER || 'doadmin',
        password: process.env.DB_PASSWORD || '',
        ssl: sslConfig,
        max: config.maxConnections || 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 15000,
      };
      
      Logger.info('Using individual DB_* environment variables', { 
        host: dbConfig.host, 
        port: dbConfig.port,
        database: dbConfig.database,
        ssl: !!dbConfig.ssl,
        hasPassword: !!dbConfig.password
      });
    } else if (process.env.DATABASE_URL) {
      // Fallback to DATABASE_URL if individual vars not set
      Logger.info('Using DATABASE_URL for connection');
      dbConfig = {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 15000,
      };
    } else {
      // Use config or defaults
      const useSSL = config.ssl !== undefined ? config.ssl : (process.env.DB_SSL === 'true');
      const sslConfig = useSSL ? { rejectUnauthorized: false } : false;

      dbConfig = {
        host: config.host || process.env.DB_HOST || 'localhost',
        port: parseInt(config.port || process.env.DB_PORT || 5432, 10),
        database: config.database || process.env.DB_NAME || 'defaultdb',
        user: config.user || process.env.DB_USER || 'doadmin',
        password: config.password || process.env.DB_PASSWORD || '',
        ssl: sslConfig,
        max: config.maxConnections || 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 15000,
      };
      
      Logger.info('Attempting database connection', { 
        host: dbConfig.host, 
        port: dbConfig.port,
        database: dbConfig.database,
        ssl: !!dbConfig.ssl,
        hasPassword: !!dbConfig.password
      });
    }

    try {
      this.pool = new Pool(dbConfig);

      // Test connection
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();

      this.isConnected = true;
      Logger.info('Database connected', { host: dbConfig.host, database: dbConfig.database });

      // Initialize schema
      await this.initializeSchema();

      return true;
    } catch (error) {
      Logger.error('Database connection failed', { error: error.message });
      this.isConnected = false;
      throw error;
    }
  }

  /**
   * Initialize database schema (create tables if not exist)
   */
  async initializeSchema() {
    // First, try to add missing columns to existing table
    try {
      await this.pool.query(`
        ALTER TABLE cameras ADD COLUMN IF NOT EXISTS uid VARCHAR(100);
      `);
    } catch (e) { /* Column might already exist or table doesn't exist yet */ }
    
    try {
      await this.pool.query(`
        ALTER TABLE cameras ADD COLUMN IF NOT EXISTS camera_type VARCHAR(50) DEFAULT 'STANDARD';
      `);
    } catch (e) { /* Column might already exist or table doesn't exist yet */ }

    const schema = `
      -- Cameras table
      CREATE TABLE IF NOT EXISTS cameras (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        location VARCHAR(255),
        rtsp_url TEXT,
        onvif_url TEXT,
        uid VARCHAR(100),
        camera_type VARCHAR(50) DEFAULT 'STANDARD',
        username VARCHAR(100),
        password_encrypted TEXT,
        status VARCHAR(50) DEFAULT 'OFFLINE',
        alarm_enabled BOOLEAN DEFAULT true,
        motion_enabled BOOLEAN DEFAULT true,
        recording_count INTEGER DEFAULT 0,
        last_seen TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Recordings table
      CREATE TABLE IF NOT EXISTS recordings (
        id SERIAL PRIMARY KEY,
        camera_id VARCHAR(50),
        filename VARCHAR(255) NOT NULL,
        filepath TEXT NOT NULL,
        duration_seconds INTEGER DEFAULT 60,
        file_size_bytes BIGINT,
        trigger_type VARCHAR(50) DEFAULT 'motion',
        motion_level INTEGER,
        status VARCHAR(50) DEFAULT 'completed',
        started_at TIMESTAMP WITH TIME ZONE,
        completed_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Motion events table
      CREATE TABLE IF NOT EXISTS motion_events (
        id SERIAL PRIMARY KEY,
        camera_id VARCHAR(50) REFERENCES cameras(id) ON DELETE CASCADE,
        motion_level INTEGER NOT NULL,
        threshold INTEGER,
        triggered_recording BOOLEAN DEFAULT false,
        recording_id INTEGER REFERENCES recordings(id) ON DELETE SET NULL,
        detected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Alarm events table
      CREATE TABLE IF NOT EXISTS alarm_events (
        id SERIAL PRIMARY KEY,
        camera_id VARCHAR(50),
        trigger_source VARCHAR(100),
        duration_seconds INTEGER,
        volume_level INTEGER,
        stopped_by VARCHAR(100),
        started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        stopped_at TIMESTAMP WITH TIME ZONE
      );

      -- System events/logs table
      CREATE TABLE IF NOT EXISTS system_events (
        id SERIAL PRIMARY KEY,
        event_type VARCHAR(100) NOT NULL,
        severity VARCHAR(20) DEFAULT 'info',
        message TEXT,
        metadata JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Paired devices table (for mobile app authentication)
      CREATE TABLE IF NOT EXISTS paired_devices (
        id SERIAL PRIMARY KEY,
        device_id VARCHAR(100) UNIQUE NOT NULL,
        device_name VARCHAR(255),
        device_type VARCHAR(50),
        token_hash VARCHAR(255),
        last_connected TIMESTAMP WITH TIME ZONE,
        is_active BOOLEAN DEFAULT true,
        permissions JSONB DEFAULT '{"view": true, "control": true, "admin": false}',
        paired_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Create indexes for better performance
      CREATE INDEX IF NOT EXISTS idx_recordings_camera_id ON recordings(camera_id);
      CREATE INDEX IF NOT EXISTS idx_recordings_created_at ON recordings(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_motion_events_camera_id ON motion_events(camera_id);
      CREATE INDEX IF NOT EXISTS idx_motion_events_detected_at ON motion_events(detected_at DESC);
      CREATE INDEX IF NOT EXISTS idx_alarm_events_started_at ON alarm_events(started_at DESC);
      CREATE INDEX IF NOT EXISTS idx_system_events_type ON system_events(event_type);
      CREATE INDEX IF NOT EXISTS idx_system_events_created_at ON system_events(created_at DESC);

      -- Update trigger for updated_at column
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql';

      -- Apply trigger to cameras table
      DROP TRIGGER IF EXISTS update_cameras_updated_at ON cameras;
      CREATE TRIGGER update_cameras_updated_at
        BEFORE UPDATE ON cameras
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `;

    try {
      await this.pool.query(schema);
      Logger.info('Database schema initialized');
    } catch (error) {
      Logger.error('Schema initialization failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Execute a query
   * @param {string} text - SQL query
   * @param {Array} params - Query parameters
   */
  async query(text, params = []) {
    const start = Date.now();
    try {
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;
      
      if (duration > 1000) {
        Logger.warn('Slow query', { duration, text: text.substring(0, 100) });
      }
      
      return result;
    } catch (error) {
      Logger.error('Query failed', { error: error.message, query: text.substring(0, 100) });
      throw error;
    }
  }

  /**
   * Get a client from the pool for transactions
   */
  async getClient() {
    return await this.pool.connect();
  }

  /**
   * Check database health
   */
  async healthCheck() {
    try {
      const result = await this.query('SELECT NOW() as time, current_database() as db');
      return {
        healthy: true,
        database: result.rows[0].db,
        timestamp: result.rows[0].time
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message
      };
    }
  }

  /**
   * Close all connections
   */
  async close() {
    if (this.pool) {
      await this.pool.end();
      this.isConnected = false;
      Logger.info('Database connections closed');
    }
  }
}

// Export singleton instance
module.exports = new Database();

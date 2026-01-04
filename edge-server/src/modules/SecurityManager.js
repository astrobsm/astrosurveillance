/**
 * ASTROSURVEILLANCE - Security Manager Module
 * 
 * Factory-grade security for local-only access:
 * - Device pairing tokens
 * - Admin PIN authentication
 * - Read-only mobile access by default
 */

const crypto = require('crypto');
const Logger = require('../utils/Logger');

class SecurityManager {
  constructor(config) {
    this.config = {
      adminPin: config.adminPin || '1234',
      pairingTokenExpiry: config.pairingTokenExpiry || 3600, // seconds
      readOnlyByDefault: config.readOnlyByDefault !== false,
      maxLoginAttempts: 5,
      lockoutDuration: 300000 // 5 minutes
    };
    
    // Active sessions
    this.sessions = new Map();
    
    // Paired devices
    this.pairedDevices = new Map();
    
    // Login attempt tracking
    this.loginAttempts = new Map();
    
    Logger.info('SecurityManager initialized');
  }
  
  /**
   * Generate a new pairing token for a device
   * @param {string} deviceId - Mobile device identifier
   * @returns {Object}
   */
  generatePairingToken(deviceId) {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + this.config.pairingTokenExpiry * 1000);
    
    const pairing = {
      token,
      deviceId,
      expiresAt,
      createdAt: new Date().toISOString(),
      validated: false
    };
    
    this.pairedDevices.set(token, pairing);
    
    Logger.info('Pairing token generated', { deviceId });
    
    return {
      token,
      expiresAt
    };
  }
  
  /**
   * Validate a pairing token
   * @param {string} token
   * @returns {boolean}
   */
  validatePairingToken(token) {
    const pairing = this.pairedDevices.get(token);
    
    if (!pairing) {
      return false;
    }
    
    if (new Date() > new Date(pairing.expiresAt)) {
      this.pairedDevices.delete(token);
      return false;
    }
    
    pairing.validated = true;
    pairing.validatedAt = new Date().toISOString();
    
    Logger.info('Device paired', { deviceId: pairing.deviceId });
    
    return true;
  }
  
  /**
   * Check if a device is paired
   * @param {string} token
   * @returns {boolean}
   */
  isDevicePaired(token) {
    const pairing = this.pairedDevices.get(token);
    return pairing && pairing.validated && new Date() < new Date(pairing.expiresAt);
  }
  
  /**
   * Create a new session
   * @param {string} pairingToken
   * @param {boolean} isAdmin
   * @returns {Object}
   */
  createSession(pairingToken, isAdmin = false) {
    const sessionId = crypto.randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    
    const session = {
      sessionId,
      pairingToken,
      isAdmin,
      permissions: isAdmin ? ['read', 'write', 'delete', 'admin'] : ['read'],
      createdAt: new Date().toISOString(),
      expiresAt,
      lastActivity: new Date().toISOString()
    };
    
    this.sessions.set(sessionId, session);
    
    Logger.debug('Session created', { sessionId, isAdmin });
    
    return {
      sessionId,
      expiresAt,
      permissions: session.permissions
    };
  }
  
  /**
   * Validate a session
   * @param {string} sessionId
   * @returns {Object|null}
   */
  validateSession(sessionId) {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      return null;
    }
    
    if (new Date() > new Date(session.expiresAt)) {
      this.sessions.delete(sessionId);
      return null;
    }
    
    // Update last activity
    session.lastActivity = new Date().toISOString();
    
    return session;
  }
  
  /**
   * Authenticate with admin PIN
   * @param {string} pin
   * @param {string} clientIp
   * @returns {boolean}
   */
  authenticateAdmin(pin, clientIp) {
    // Check for lockout
    const attempts = this.loginAttempts.get(clientIp);
    if (attempts && attempts.count >= this.config.maxLoginAttempts) {
      const lockoutEnd = new Date(attempts.lastAttempt.getTime() + this.config.lockoutDuration);
      if (new Date() < lockoutEnd) {
        Logger.warn('Login attempt during lockout', { clientIp });
        return false;
      } else {
        // Reset after lockout period
        this.loginAttempts.delete(clientIp);
      }
    }
    
    if (pin === this.config.adminPin) {
      // Clear attempts on successful login
      this.loginAttempts.delete(clientIp);
      Logger.info('Admin authentication successful', { clientIp });
      return true;
    }
    
    // Track failed attempt
    const currentAttempts = this.loginAttempts.get(clientIp) || { count: 0 };
    currentAttempts.count++;
    currentAttempts.lastAttempt = new Date();
    this.loginAttempts.set(clientIp, currentAttempts);
    
    Logger.warn('Admin authentication failed', { 
      clientIp, 
      attempts: currentAttempts.count 
    });
    
    return false;
  }
  
  /**
   * Check if user has permission
   * @param {string} sessionId
   * @param {string} permission
   * @returns {boolean}
   */
  hasPermission(sessionId, permission) {
    const session = this.validateSession(sessionId);
    if (!session) return false;
    
    return session.permissions.includes(permission);
  }
  
  /**
   * Revoke a session
   * @param {string} sessionId
   */
  revokeSession(sessionId) {
    this.sessions.delete(sessionId);
    Logger.info('Session revoked', { sessionId });
  }
  
  /**
   * Revoke all sessions
   */
  revokeAllSessions() {
    this.sessions.clear();
    Logger.info('All sessions revoked');
  }
  
  /**
   * Update admin PIN
   * @param {string} currentPin
   * @param {string} newPin
   * @returns {boolean}
   */
  updateAdminPin(currentPin, newPin) {
    if (currentPin !== this.config.adminPin) {
      Logger.warn('Failed to update PIN - incorrect current PIN');
      return false;
    }
    
    if (newPin.length < 4 || newPin.length > 8) {
      Logger.warn('Failed to update PIN - invalid length');
      return false;
    }
    
    this.config.adminPin = newPin;
    this.revokeAllSessions(); // Force re-authentication
    
    Logger.info('Admin PIN updated');
    return true;
  }
  
  /**
   * Get paired devices list
   * @returns {Array}
   */
  getPairedDevices() {
    const devices = [];
    for (const [token, pairing] of this.pairedDevices) {
      if (pairing.validated) {
        devices.push({
          deviceId: pairing.deviceId,
          pairedAt: pairing.validatedAt,
          expiresAt: pairing.expiresAt
        });
      }
    }
    return devices;
  }
  
  /**
   * Revoke a paired device
   * @param {string} token
   */
  revokeDevice(token) {
    this.pairedDevices.delete(token);
    
    // Also revoke any sessions using this token
    for (const [sessionId, session] of this.sessions) {
      if (session.pairingToken === token) {
        this.sessions.delete(sessionId);
      }
    }
    
    Logger.info('Device revoked', { token });
  }
  
  /**
   * Express middleware for authentication
   */
  authMiddleware(requireAdmin = false) {
    return (req, res, next) => {
      const sessionId = req.headers['x-session-id'];
      const pairingToken = req.headers['x-pairing-token'];
      
      // Check session
      if (sessionId) {
        const session = this.validateSession(sessionId);
        if (session) {
          if (requireAdmin && !session.isAdmin) {
            return res.status(403).json({
              code: 'FORBIDDEN',
              message: 'Admin access required'
            });
          }
          req.session = session;
          return next();
        }
      }
      
      // Check pairing token
      if (pairingToken && this.isDevicePaired(pairingToken)) {
        if (requireAdmin) {
          return res.status(403).json({
            code: 'FORBIDDEN',
            message: 'Admin access required'
          });
        }
        req.isPaired = true;
        return next();
      }
      
      return res.status(401).json({
        code: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
    };
  }
}

module.exports = SecurityManager;

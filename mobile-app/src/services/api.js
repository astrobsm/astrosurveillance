/**
 * ASTROSURVEILLANCE - API Service
 * 
 * Handles all communication with the edge server over LAN.
 * Implements offline-first patterns with retry logic.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEYS = {
  SERVER_URL: 'astro_server_url',
  SESSION_ID: 'astro_session_id',
  PAIRING_TOKEN: 'astro_pairing_token',
};

class ApiService {
  constructor() {
    this.baseUrl = null;
    this.sessionId = null;
    this.pairingToken = null;
    this.isConnected = false;
  }
  
  /**
   * Initialize API service with stored credentials
   */
  async initialize() {
    try {
      this.baseUrl = await AsyncStorage.getItem(STORAGE_KEYS.SERVER_URL);
      this.sessionId = await AsyncStorage.getItem(STORAGE_KEYS.SESSION_ID);
      this.pairingToken = await AsyncStorage.getItem(STORAGE_KEYS.PAIRING_TOKEN);
      
      if (this.baseUrl) {
        await this.checkConnection();
      }
      
      return this.isConnected;
    } catch (error) {
      console.error('Failed to initialize API service:', error);
      return false;
    }
  }
  
  /**
   * Set server URL after pairing
   */
  async setServerUrl(url) {
    this.baseUrl = url;
    await AsyncStorage.setItem(STORAGE_KEYS.SERVER_URL, url);
  }
  
  /**
   * Set session credentials
   */
  async setSession(sessionId, pairingToken) {
    this.sessionId = sessionId;
    this.pairingToken = pairingToken;
    
    if (sessionId) {
      await AsyncStorage.setItem(STORAGE_KEYS.SESSION_ID, sessionId);
    }
    if (pairingToken) {
      await AsyncStorage.setItem(STORAGE_KEYS.PAIRING_TOKEN, pairingToken);
    }
  }
  
  /**
   * Clear stored credentials
   */
  async clearCredentials() {
    this.baseUrl = null;
    this.sessionId = null;
    this.pairingToken = null;
    this.isConnected = false;
    
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.SERVER_URL,
      STORAGE_KEYS.SESSION_ID,
      STORAGE_KEYS.PAIRING_TOKEN,
    ]);
  }
  
  /**
   * Check connection to server
   */
  async checkConnection() {
    try {
      const response = await this.get('/api/health');
      this.isConnected = response && response.status === 'OK';
      return this.isConnected;
    } catch (error) {
      this.isConnected = false;
      return false;
    }
  }
  
  /**
   * Make HTTP request
   */
  async request(method, endpoint, body = null, options = {}) {
    if (!this.baseUrl) {
      throw new Error('Server URL not configured');
    }
    
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
    };
    
    if (this.sessionId) {
      headers['X-Session-Id'] = this.sessionId;
    }
    if (this.pairingToken) {
      headers['X-Pairing-Token'] = this.pairingToken;
    }
    
    const config = {
      method,
      headers,
      timeout: options.timeout || 10000,
    };
    
    if (body) {
      config.body = JSON.stringify(body);
    }
    
    try {
      const response = await fetch(url, config);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Request failed');
      }
      
      return data.data || data;
    } catch (error) {
      console.error(`API Error [${method} ${endpoint}]:`, error);
      throw error;
    }
  }
  
  // Convenience methods
  get(endpoint, options) {
    return this.request('GET', endpoint, null, options);
  }
  
  post(endpoint, body, options) {
    return this.request('POST', endpoint, body, options);
  }
  
  put(endpoint, body, options) {
    return this.request('PUT', endpoint, body, options);
  }
  
  delete(endpoint, options) {
    return this.request('DELETE', endpoint, null, options);
  }
  
  // ============ CAMERA ENDPOINTS ============
  
  async getCameras() {
    const response = await this.get('/api/cameras');
    return response.cameras || [];
  }
  
  async getCamera(cameraId) {
    return this.get(`/api/cameras/${cameraId}`);
  }
  
  async discoverCameras() {
    const response = await this.get('/api/cameras/discover');
    return response.discovered || [];
  }
  
  async addCamera(cameraData) {
    return this.post('/api/cameras', cameraData);
  }
  
  async updateCamera(cameraId, updates) {
    return this.put(`/api/cameras/${cameraId}`, updates);
  }
  
  async deleteCamera(cameraId) {
    return this.delete(`/api/cameras/${cameraId}`);
  }
  
  // ============ RECORDING ENDPOINTS ============
  
  async getRecordings(filters = {}) {
    const params = new URLSearchParams(filters).toString();
    const endpoint = `/api/recordings${params ? `?${params}` : ''}`;
    const response = await this.get(endpoint);
    return response.recordings || [];
  }
  
  async getRecordingsForCamera(cameraId) {
    const response = await this.get(`/api/recordings/camera/${cameraId}`);
    return response.recordings || [];
  }
  
  async deleteRecording(filename) {
    return this.delete(`/api/recordings/${filename}`);
  }
  
  getRecordingDownloadUrl(filename) {
    return `${this.baseUrl}/api/recordings/${filename}/download`;
  }
  
  getRecordingStreamUrl(filename) {
    return `${this.baseUrl}/api/recordings/${filename}/stream`;
  }
  
  async getRecordingStatus() {
    return this.get('/api/recordings/status/all');
  }
  
  // ============ ALARM ENDPOINTS ============
  
  async getAlarmStatus() {
    return this.get('/api/alarms');
  }
  
  async armAlarm() {
    return this.post('/api/alarms/arm');
  }
  
  async disarmAlarm() {
    return this.post('/api/alarms/disarm');
  }
  
  async toggleAlarm() {
    return this.post('/api/alarms/toggle');
  }
  
  async stopAlarm(cameraId = null) {
    return this.post('/api/alarms/stop', { cameraId });
  }
  
  async updateAlarmConfig(config) {
    return this.put('/api/alarms/config', config);
  }
  
  // ============ STORAGE ENDPOINTS ============
  
  async getStorageHealth() {
    return this.get('/api/storage');
  }
  
  async refreshStorage() {
    return this.get('/api/storage/refresh');
  }
  
  async cleanupStorage() {
    return this.post('/api/storage/cleanup');
  }
  
  // ============ SYSTEM ENDPOINTS ============
  
  async getSystemInfo() {
    return this.get('/api/system/info');
  }
  
  async getSystemStatus() {
    return this.get('/api/system/status');
  }
  
  async validatePairing(token, deviceId) {
    return this.post('/api/system/validate-pairing', { token, deviceId });
  }
  
  async adminLogin(pin) {
    return this.post('/api/system/admin-login', { 
      pin, 
      pairingToken: this.pairingToken 
    });
  }
  
  async logout() {
    await this.post('/api/system/logout');
    await this.clearCredentials();
  }
  
  // ============ WEBSOCKET ============
  
  connectWebSocket(onMessage) {
    if (!this.baseUrl) {
      throw new Error('Server URL not configured');
    }
    
    const wsUrl = this.baseUrl.replace('http', 'ws') + '/ws';
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      console.log('WebSocket connected');
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessage(data);
      } catch (error) {
        console.error('WebSocket message parse error:', error);
      }
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
    
    ws.onclose = () => {
      console.log('WebSocket closed');
    };
    
    return ws;
  }
}

// Singleton instance
export const api = new ApiService();
export default api;

/**
 * ASTROSURVEILLANCE - Download Service
 * 
 * Handles video downloads to device storage.
 * Supports background downloads with progress tracking.
 */

import RNFS from 'react-native-fs';
import { PermissionsAndroid, Platform } from 'react-native';
import { api } from './api';

class DownloadService {
  constructor() {
    this.activeDownloads = new Map();
    this.downloadPath = Platform.select({
      android: RNFS.DownloadDirectoryPath,
      ios: RNFS.DocumentDirectoryPath,
    });
  }
  
  /**
   * Request storage permissions (Android)
   */
  async requestPermissions() {
    if (Platform.OS !== 'android') return true;
    
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
        {
          title: 'Storage Permission',
          message: 'ASTROSURVEILLANCE needs storage access to save recordings.',
          buttonNeutral: 'Ask Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        }
      );
      
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (err) {
      console.error('Permission request failed:', err);
      return false;
    }
  }
  
  /**
   * Download a recording
   * @param {string} filename - Recording filename
   * @param {Function} onProgress - Progress callback (0-100)
   * @returns {Promise<string>} Local file path
   */
  async downloadRecording(filename, onProgress = () => {}) {
    const hasPermission = await this.requestPermissions();
    if (!hasPermission) {
      throw new Error('Storage permission denied');
    }
    
    const downloadUrl = api.getRecordingDownloadUrl(filename);
    const localPath = `${this.downloadPath}/ASTRO_${filename}`;
    
    // Check if already downloading
    if (this.activeDownloads.has(filename)) {
      throw new Error('Download already in progress');
    }
    
    try {
      const downloadId = Date.now().toString();
      this.activeDownloads.set(filename, downloadId);
      
      const options = {
        fromUrl: downloadUrl,
        toFile: localPath,
        headers: {
          'X-Pairing-Token': api.pairingToken || '',
          'X-Session-Id': api.sessionId || '',
        },
        background: true,
        discretionary: true,
        progress: (res) => {
          const percent = Math.round((res.bytesWritten / res.contentLength) * 100);
          onProgress(percent);
        },
      };
      
      const result = await RNFS.downloadFile(options).promise;
      
      if (result.statusCode === 200) {
        console.log('Download complete:', localPath);
        return localPath;
      } else {
        throw new Error(`Download failed with status ${result.statusCode}`);
      }
    } finally {
      this.activeDownloads.delete(filename);
    }
  }
  
  /**
   * Cancel a download
   * @param {string} filename - Recording filename
   */
  cancelDownload(filename) {
    const downloadId = this.activeDownloads.get(filename);
    if (downloadId) {
      RNFS.stopDownload(parseInt(downloadId));
      this.activeDownloads.delete(filename);
    }
  }
  
  /**
   * Check if file exists locally
   * @param {string} filename - Recording filename
   * @returns {Promise<boolean>}
   */
  async isDownloaded(filename) {
    const localPath = `${this.downloadPath}/ASTRO_${filename}`;
    return RNFS.exists(localPath);
  }
  
  /**
   * Get local file path
   * @param {string} filename - Recording filename
   * @returns {string}
   */
  getLocalPath(filename) {
    return `${this.downloadPath}/ASTRO_${filename}`;
  }
  
  /**
   * Delete local file
   * @param {string} filename - Recording filename
   */
  async deleteLocal(filename) {
    const localPath = `${this.downloadPath}/ASTRO_${filename}`;
    const exists = await RNFS.exists(localPath);
    if (exists) {
      await RNFS.unlink(localPath);
    }
  }
  
  /**
   * Get all downloaded recordings
   * @returns {Promise<Array>}
   */
  async getDownloadedRecordings() {
    try {
      const files = await RNFS.readDir(this.downloadPath);
      return files
        .filter(file => file.name.startsWith('ASTRO_') && file.name.endsWith('.mp4'))
        .map(file => ({
          filename: file.name.replace('ASTRO_', ''),
          localPath: file.path,
          size: file.size,
          downloadedAt: file.mtime,
        }));
    } catch (err) {
      console.error('Failed to read downloads:', err);
      return [];
    }
  }
  
  /**
   * Get storage info
   * @returns {Promise<Object>}
   */
  async getStorageInfo() {
    try {
      const freeSpace = await RNFS.getFSInfo();
      return {
        freeSpace: freeSpace.freeSpace,
        totalSpace: freeSpace.totalSpace,
        usedPercent: Math.round((1 - freeSpace.freeSpace / freeSpace.totalSpace) * 100),
      };
    } catch (err) {
      console.error('Failed to get storage info:', err);
      return null;
    }
  }
}

export const downloadService = new DownloadService();
export default downloadService;

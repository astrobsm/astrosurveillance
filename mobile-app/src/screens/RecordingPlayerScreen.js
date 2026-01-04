/**
 * ASTROSURVEILLANCE - Recording Player Screen
 * 
 * Video playback screen with controls and download option.
 */

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Video from 'react-native-video';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { api } from '../services/api';
import { downloadService } from '../services/download';
import { colors, spacing, borderRadius, typography } from '../utils/theme';

const RecordingPlayerScreen = ({ route }) => {
  const { recording } = route.params;
  const videoRef = useRef(null);
  
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  
  const streamUrl = api.getRecordingStreamUrl(recording.filename);
  
  const handleLoad = (data) => {
    setDuration(data.duration);
    setIsLoading(false);
  };
  
  const handleProgress = (data) => {
    setCurrentTime(data.currentTime);
  };
  
  const handleError = (err) => {
    setError('Failed to load video');
    setIsLoading(false);
  };
  
  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };
  
  const handleSeek = (direction) => {
    const seekAmount = 10; // seconds
    const newTime = direction === 'forward' 
      ? Math.min(currentTime + seekAmount, duration)
      : Math.max(currentTime - seekAmount, 0);
    
    videoRef.current?.seek(newTime);
  };
  
  const handleDownload = async () => {
    if (downloading) return;
    
    try {
      setDownloading(true);
      setDownloadProgress(0);
      
      await downloadService.downloadRecording(
        recording.filename,
        (progress) => setDownloadProgress(progress)
      );
      
      Alert.alert('Success', 'Recording downloaded to your device');
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setDownloading(false);
    }
  };
  
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  return (
    <View style={styles.container}>
      {/* Video Player */}
      <View style={styles.videoContainer}>
        {error ? (
          <View style={styles.errorContainer}>
            <Icon name="alert-circle" size={48} color={colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : (
          <>
            <Video
              ref={videoRef}
              source={{ uri: streamUrl }}
              style={styles.video}
              paused={!isPlaying}
              resizeMode="contain"
              onLoad={handleLoad}
              onProgress={handleProgress}
              onError={handleError}
              repeat={false}
            />
            
            {isLoading && (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color={colors.accent} />
                <Text style={styles.loadingText}>Loading video...</Text>
              </View>
            )}
          </>
        )}
      </View>
      
      {/* Controls */}
      <View style={styles.controls}>
        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressFill,
                { width: duration > 0 ? `${(currentTime / duration) * 100}%` : '0%' }
              ]} 
            />
          </View>
          <Text style={styles.timeText}>{formatTime(duration)}</Text>
        </View>
        
        {/* Playback Controls */}
        <View style={styles.playbackControls}>
          <TouchableOpacity
            style={styles.controlButton}
            onPress={() => handleSeek('backward')}
          >
            <Icon name="rewind-10" size={32} color={colors.textPrimary} />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.playButton}
            onPress={handlePlayPause}
          >
            <Icon 
              name={isPlaying ? 'pause' : 'play'} 
              size={48} 
              color={colors.textPrimary} 
            />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.controlButton}
            onPress={() => handleSeek('forward')}
          >
            <Icon name="fast-forward-10" size={32} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>
      
      {/* Recording Info */}
      <View style={styles.infoSection}>
        <View style={styles.infoRow}>
          <Icon name="cctv" size={20} color={colors.textMuted} />
          <Text style={styles.infoLabel}>Camera:</Text>
          <Text style={styles.infoValue}>{recording.cameraId}</Text>
        </View>
        
        <View style={styles.infoRow}>
          <Icon name="calendar" size={20} color={colors.textMuted} />
          <Text style={styles.infoLabel}>Date:</Text>
          <Text style={styles.infoValue}>
            {new Date(recording.timestamp).toLocaleString()}
          </Text>
        </View>
        
        <View style={styles.infoRow}>
          <Icon name="file-video" size={20} color={colors.textMuted} />
          <Text style={styles.infoLabel}>File:</Text>
          <Text style={styles.infoValue} numberOfLines={1}>
            {recording.filename}
          </Text>
        </View>
      </View>
      
      {/* Download Button */}
      <TouchableOpacity
        style={[styles.downloadButton, downloading && styles.downloadingButton]}
        onPress={handleDownload}
        disabled={downloading}
      >
        {downloading ? (
          <View style={styles.downloadProgress}>
            <View 
              style={[
                styles.downloadProgressFill,
                { width: `${downloadProgress}%` }
              ]} 
            />
            <Text style={styles.downloadText}>
              Downloading... {downloadProgress}%
            </Text>
          </View>
        ) : (
          <>
            <Icon name="download" size={24} color={colors.textPrimary} />
            <Text style={styles.downloadText}>Download to Device</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  videoContainer: {
    aspectRatio: 16 / 9,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  video: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...typography.bodySmall,
    marginTop: spacing.sm,
  },
  errorContainer: {
    alignItems: 'center',
  },
  errorText: {
    ...typography.body,
    color: colors.danger,
    marginTop: spacing.sm,
  },
  controls: {
    padding: spacing.md,
    backgroundColor: colors.surface,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  progressBar: {
    flex: 1,
    height: 4,
    backgroundColor: colors.surfaceLight,
    borderRadius: 2,
    marginHorizontal: spacing.sm,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: 2,
  },
  timeText: {
    ...typography.caption,
    width: 45,
    textAlign: 'center',
  },
  playbackControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlButton: {
    padding: spacing.md,
  },
  playButton: {
    backgroundColor: colors.accent,
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: spacing.xl,
  },
  infoSection: {
    padding: spacing.md,
    backgroundColor: colors.surface,
    marginTop: spacing.md,
    marginHorizontal: spacing.md,
    borderRadius: borderRadius.md,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  infoLabel: {
    ...typography.bodySmall,
    marginLeft: spacing.sm,
    width: 60,
  },
  infoValue: {
    ...typography.body,
    flex: 1,
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    marginHorizontal: spacing.md,
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  downloadingButton: {
    backgroundColor: colors.surfaceLight,
  },
  downloadText: {
    ...typography.body,
    fontWeight: 'bold',
    marginLeft: spacing.sm,
  },
  downloadProgress: {
    flex: 1,
    height: '100%',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  downloadProgressFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: colors.accent,
  },
});

export default RecordingPlayerScreen;

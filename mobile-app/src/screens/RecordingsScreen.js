/**
 * ASTROSURVEILLANCE - Recordings Screen
 * 
 * Lists all recordings with filtering and download capabilities.
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { useApp } from '../context/AppContext';
import { downloadService } from '../services/download';
import { colors, spacing, borderRadius, typography, shadows } from '../utils/theme';

const RecordingsScreen = ({ route, navigation }) => {
  const { cameraId } = route.params || {};
  const { state, actions } = useApp();
  const [refreshing, setRefreshing] = useState(false);
  const [downloadingFiles, setDownloadingFiles] = useState({});
  
  useFocusEffect(
    useCallback(() => {
      actions.fetchRecordings(cameraId);
    }, [cameraId])
  );
  
  const onRefresh = async () => {
    setRefreshing(true);
    await actions.fetchRecordings(cameraId);
    setRefreshing(false);
  };
  
  const handleDownload = async (recording) => {
    if (downloadingFiles[recording.filename]) return;
    
    try {
      setDownloadingFiles(prev => ({
        ...prev,
        [recording.filename]: { progress: 0 }
      }));
      
      await downloadService.downloadRecording(
        recording.filename,
        (progress) => {
          setDownloadingFiles(prev => ({
            ...prev,
            [recording.filename]: { progress }
          }));
        }
      );
      
      Alert.alert('Success', 'Recording downloaded successfully');
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setDownloadingFiles(prev => {
        const updated = { ...prev };
        delete updated[recording.filename];
        return updated;
      });
    }
  };
  
  const handlePlay = (recording) => {
    navigation.navigate('RecordingPlayer', { recording });
  };
  
  const handleDelete = (recording) => {
    Alert.alert(
      'Delete Recording',
      'Are you sure you want to delete this recording?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await actions.deleteRecording(recording.filename);
              actions.fetchRecordings(cameraId);
            } catch (error) {
              Alert.alert('Error', 'Failed to delete recording');
            }
          },
        },
      ]
    );
  };
  
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  const formatFileSize = (bytes) => {
    if (!bytes) return 'Unknown';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };
  
  const renderRecording = ({ item }) => {
    const downloadState = downloadingFiles[item.filename];
    const isDownloading = !!downloadState;
    
    return (
      <View style={[styles.recordingCard, shadows.small]}>
        <TouchableOpacity
          style={styles.recordingMain}
          onPress={() => handlePlay(item)}
        >
          <View style={styles.recordingIcon}>
            <Icon name="video" size={32} color={colors.accent} />
            {item.downloaded && (
              <Icon 
                name="check-circle" 
                size={16} 
                color={colors.success}
                style={styles.downloadedBadge}
              />
            )}
          </View>
          
          <View style={styles.recordingInfo}>
            <Text style={styles.recordingCamera}>{item.cameraId}</Text>
            <Text style={styles.recordingDate}>
              {new Date(item.timestamp).toLocaleString()}
            </Text>
            <View style={styles.recordingMeta}>
              <Text style={styles.recordingDuration}>
                <Icon name="clock-outline" size={12} color={colors.textMuted} />
                {' '}{formatDuration(item.duration)}
              </Text>
              <Text style={styles.recordingSize}>
                <Icon name="file" size={12} color={colors.textMuted} />
                {' '}{formatFileSize(item.size)}
              </Text>
            </View>
          </View>
          
          <Icon name="play-circle" size={32} color={colors.accent} />
        </TouchableOpacity>
        
        <View style={styles.recordingActions}>
          {isDownloading ? (
            <View style={styles.downloadProgress}>
              <View style={styles.progressBar}>
                <View 
                  style={[
                    styles.progressFill,
                    { width: `${downloadState.progress}%` }
                  ]} 
                />
              </View>
              <Text style={styles.progressText}>{downloadState.progress}%</Text>
            </View>
          ) : (
            <>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => handleDownload(item)}
              >
                <Icon name="download" size={20} color={colors.textSecondary} />
                <Text style={styles.actionText}>Download</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => handleDelete(item)}
              >
                <Icon name="delete" size={20} color={colors.danger} />
                <Text style={[styles.actionText, { color: colors.danger }]}>
                  Delete
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    );
  };
  
  const renderEmptyList = () => (
    <View style={styles.emptyContainer}>
      <Icon name="video-off" size={80} color={colors.textMuted} />
      <Text style={styles.emptyTitle}>No Recordings</Text>
      <Text style={styles.emptyText}>
        {cameraId 
          ? 'No recordings found for this camera.'
          : 'No recordings have been captured yet.'}
      </Text>
    </View>
  );
  
  const renderHeader = () => (
    <View style={styles.listHeader}>
      <Text style={styles.listHeaderText}>
        {state.recordings.length} recording{state.recordings.length !== 1 ? 's' : ''}
        {cameraId && ` for ${cameraId}`}
      </Text>
    </View>
  );
  
  return (
    <View style={styles.container}>
      <FlatList
        data={state.recordings}
        renderItem={renderRecording}
        keyExtractor={(item) => item.id || item.filename}
        contentContainerStyle={styles.listContainer}
        ListHeaderComponent={state.recordings.length > 0 ? renderHeader : null}
        ListEmptyComponent={renderEmptyList}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  listContainer: {
    padding: spacing.md,
    flexGrow: 1,
  },
  listHeader: {
    marginBottom: spacing.md,
  },
  listHeaderText: {
    ...typography.bodySmall,
  },
  recordingCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  recordingMain: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  recordingIcon: {
    position: 'relative',
    marginRight: spacing.md,
  },
  downloadedBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: colors.surface,
    borderRadius: 8,
  },
  recordingInfo: {
    flex: 1,
  },
  recordingCamera: {
    ...typography.h3,
    marginBottom: spacing.xs,
  },
  recordingDate: {
    ...typography.bodySmall,
    marginBottom: spacing.xs,
  },
  recordingMeta: {
    flexDirection: 'row',
  },
  recordingDuration: {
    ...typography.caption,
    marginRight: spacing.md,
  },
  recordingSize: {
    ...typography.caption,
  },
  recordingActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.surfaceLight,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
  },
  actionText: {
    ...typography.bodySmall,
    marginLeft: spacing.xs,
  },
  downloadProgress: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  progressBar: {
    flex: 1,
    height: 8,
    backgroundColor: colors.surfaceLight,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
    marginRight: spacing.sm,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.accent,
  },
  progressText: {
    ...typography.caption,
    width: 40,
    textAlign: 'right',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyTitle: {
    ...typography.h2,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  emptyText: {
    ...typography.bodySmall,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
});

export default RecordingsScreen;

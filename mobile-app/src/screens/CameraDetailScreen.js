/**
 * ASTROSURVEILLANCE - Camera Detail Screen
 * 
 * Shows detailed camera information, live status,
 * alarm control, and access to recordings.
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import { colors, spacing, borderRadius, typography, shadows } from '../utils/theme';

const CameraDetailScreen = ({ route, navigation }) => {
  const { cameraId } = route.params;
  const { state, actions } = useApp();
  const [camera, setCamera] = useState(null);
  const [recordings, setRecordings] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  
  useFocusEffect(
    useCallback(() => {
      loadCameraData();
    }, [cameraId])
  );
  
  const loadCameraData = async () => {
    try {
      setLoading(true);
      const cameraData = await api.getCamera(cameraId);
      setCamera(cameraData);
      
      const cameraRecordings = await api.getRecordingsForCamera(cameraId);
      setRecordings(cameraRecordings.slice(0, 5)); // Show last 5
    } catch (error) {
      Alert.alert('Error', 'Failed to load camera data');
    } finally {
      setLoading(false);
    }
  };
  
  const onRefresh = async () => {
    setRefreshing(true);
    await loadCameraData();
    setRefreshing(false);
  };
  
  const handleToggleAlarm = async (value) => {
    try {
      await api.updateCamera(cameraId, { alarmEnabled: value });
      setCamera(prev => ({ ...prev, alarmEnabled: value }));
    } catch (error) {
      Alert.alert('Error', 'Failed to update alarm setting');
    }
  };
  
  const handleToggleMotion = async (value) => {
    try {
      await api.updateCamera(cameraId, { motionEnabled: value });
      setCamera(prev => ({ ...prev, motionEnabled: value }));
    } catch (error) {
      Alert.alert('Error', 'Failed to update motion detection setting');
    }
  };
  
  const handleViewAllRecordings = () => {
    navigation.navigate('Recordings', { 
      screen: 'RecordingsList',
      params: { cameraId }
    });
  };
  
  const getStatusColor = (status) => {
    const statusColors = {
      ONLINE: colors.online,
      OFFLINE: colors.offline,
      RECORDING: colors.recording,
      ERROR: colors.error,
    };
    return statusColors[status] || colors.offline;
  };
  
  if (!camera) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }
  
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.accent}
        />
      }
    >
      {/* Status Card */}
      <View style={[styles.card, shadows.small]}>
        <View style={styles.statusHeader}>
          <View style={[
            styles.statusIndicator,
            { backgroundColor: getStatusColor(camera.status) }
          ]} />
          <Text style={styles.statusText}>{camera.status}</Text>
        </View>
        
        <View style={styles.infoRow}>
          <Icon name="identifier" size={20} color={colors.textMuted} />
          <Text style={styles.infoLabel}>ID:</Text>
          <Text style={styles.infoValue}>{camera.id}</Text>
        </View>
        
        <View style={styles.infoRow}>
          <Icon name="map-marker" size={20} color={colors.textMuted} />
          <Text style={styles.infoLabel}>Location:</Text>
          <Text style={styles.infoValue}>{camera.location}</Text>
        </View>
        
        <View style={styles.infoRow}>
          <Icon name="calendar-clock" size={20} color={colors.textMuted} />
          <Text style={styles.infoLabel}>Last seen:</Text>
          <Text style={styles.infoValue}>
            {camera.lastSeen ? new Date(camera.lastSeen).toLocaleString() : 'Unknown'}
          </Text>
        </View>
      </View>
      
      {/* Recording State Card */}
      {camera.recording && (
        <View style={[styles.card, styles.recordingCard, shadows.small]}>
          <View style={styles.cardHeader}>
            <Icon name="record-circle" size={24} color={colors.recording} />
            <Text style={styles.cardTitle}>Recording Status</Text>
          </View>
          
          <View style={styles.recordingInfo}>
            <Text style={styles.recordingState}>{camera.recording.state}</Text>
            {camera.recording.remainingMs > 0 && (
              <Text style={styles.recordingTime}>
                {Math.ceil(camera.recording.remainingMs / 1000)}s remaining
              </Text>
            )}
          </View>
        </View>
      )}
      
      {/* Controls Card */}
      <View style={[styles.card, shadows.small]}>
        <Text style={styles.cardTitle}>Controls</Text>
        
        <View style={styles.controlRow}>
          <View style={styles.controlInfo}>
            <Icon name="alarm-light" size={24} color={colors.textSecondary} />
            <Text style={styles.controlLabel}>Alarm Enabled</Text>
          </View>
          <Switch
            value={camera.alarmEnabled}
            onValueChange={handleToggleAlarm}
            trackColor={{ false: colors.surfaceLight, true: colors.primaryLight }}
            thumbColor={camera.alarmEnabled ? colors.accent : colors.textMuted}
          />
        </View>
        
        <View style={styles.controlRow}>
          <View style={styles.controlInfo}>
            <Icon name="motion-sensor" size={24} color={colors.textSecondary} />
            <Text style={styles.controlLabel}>Motion Detection</Text>
          </View>
          <Switch
            value={camera.motionEnabled}
            onValueChange={handleToggleMotion}
            trackColor={{ false: colors.surfaceLight, true: colors.primaryLight }}
            thumbColor={camera.motionEnabled ? colors.accent : colors.textMuted}
          />
        </View>
      </View>
      
      {/* Recent Recordings Card */}
      <View style={[styles.card, shadows.small]}>
        <View style={styles.cardHeader}>
          <Icon name="video" size={24} color={colors.accent} />
          <Text style={styles.cardTitle}>Recent Recordings</Text>
          <Text style={styles.recordingCount}>{camera.recordingCount || 0} total</Text>
        </View>
        
        {recordings.length === 0 ? (
          <Text style={styles.noRecordings}>No recordings yet</Text>
        ) : (
          <>
            {recordings.map((recording, index) => (
              <TouchableOpacity
                key={recording.id || index}
                style={styles.recordingItem}
                onPress={() => navigation.navigate('Recordings', {
                  screen: 'RecordingPlayer',
                  params: { recording }
                })}
              >
                <Icon name="play-circle" size={20} color={colors.accent} />
                <View style={styles.recordingItemInfo}>
                  <Text style={styles.recordingFilename}>{recording.filename}</Text>
                  <Text style={styles.recordingDate}>
                    {new Date(recording.timestamp).toLocaleString()}
                  </Text>
                </View>
                <Icon name="chevron-right" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            ))}
            
            {camera.recordingCount > 5 && (
              <TouchableOpacity
                style={styles.viewAllButton}
                onPress={handleViewAllRecordings}
              >
                <Text style={styles.viewAllText}>View All Recordings</Text>
                <Icon name="arrow-right" size={16} color={colors.accent} />
              </TouchableOpacity>
            )}
          </>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentContainer: {
    padding: spacing.md,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    ...typography.body,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  recordingCard: {
    borderLeftWidth: 4,
    borderLeftColor: colors.recording,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  cardTitle: {
    ...typography.h3,
    marginLeft: spacing.sm,
    flex: 1,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceLight,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: spacing.sm,
  },
  statusText: {
    ...typography.h3,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  infoLabel: {
    ...typography.bodySmall,
    marginLeft: spacing.sm,
    width: 70,
  },
  infoValue: {
    ...typography.body,
    flex: 1,
  },
  recordingInfo: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  recordingState: {
    ...typography.h2,
    color: colors.recording,
  },
  recordingTime: {
    ...typography.bodySmall,
    marginTop: spacing.xs,
  },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceLight,
  },
  controlInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  controlLabel: {
    ...typography.body,
    marginLeft: spacing.sm,
  },
  recordingCount: {
    ...typography.caption,
    color: colors.textMuted,
  },
  noRecordings: {
    ...typography.bodySmall,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  recordingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceLight,
  },
  recordingItemInfo: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  recordingFilename: {
    ...typography.bodySmall,
  },
  recordingDate: {
    ...typography.caption,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  viewAllText: {
    ...typography.body,
    color: colors.accent,
    marginRight: spacing.xs,
  },
});

export default CameraDetailScreen;

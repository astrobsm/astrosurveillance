/**
 * ASTROSURVEILLANCE - Dashboard Screen
 * 
 * Main overview screen showing system status, alarm control,
 * recent events, and quick access to cameras.
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useApp } from '../context/AppContext';
import { useConnection } from '../context/ConnectionContext';
import { colors, spacing, borderRadius, typography, shadows } from '../utils/theme';

const DashboardScreen = ({ navigation }) => {
  const { state, actions } = useApp();
  const { isConnected, serverInfo, events } = useConnection();
  const [refreshing, setRefreshing] = useState(false);
  
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );
  
  const loadData = async () => {
    await actions.refreshAll();
  };
  
  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };
  
  const handleAlarmToggle = async () => {
    const currentState = state.alarmState?.state;
    const action = currentState === 'ARMED' ? 'disarm' : 'arm';
    
    Alert.alert(
      `${action.charAt(0).toUpperCase() + action.slice(1)} Alarm`,
      `Are you sure you want to ${action} the alarm system?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Confirm', 
          onPress: async () => {
            await actions.toggleAlarm();
          }
        },
      ]
    );
  };
  
  const handleStopAlarm = async () => {
    await actions.stopAlarm();
  };
  
  const renderConnectionStatus = () => (
    <View style={[styles.statusCard, shadows.small]}>
      <View style={styles.statusRow}>
        <Icon 
          name={isConnected ? 'server-network' : 'server-network-off'} 
          size={24} 
          color={isConnected ? colors.success : colors.danger} 
        />
        <View style={styles.statusText}>
          <Text style={styles.statusTitle}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </Text>
          <Text style={styles.statusSubtitle}>
            {serverInfo?.hostname || 'Edge Server'}
          </Text>
        </View>
      </View>
    </View>
  );
  
  const renderAlarmControl = () => {
    const alarmState = state.alarmState?.state || 'UNKNOWN';
    const isTriggered = alarmState === 'TRIGGERED';
    const isArmed = alarmState === 'ARMED';
    
    return (
      <View style={[styles.alarmCard, shadows.medium]}>
        <View style={styles.alarmHeader}>
          <Icon 
            name={isTriggered ? 'alarm-light' : (isArmed ? 'shield-check' : 'shield-off')} 
            size={40} 
            color={isTriggered ? colors.danger : (isArmed ? colors.alarmArmed : colors.alarmDisarmed)} 
          />
          <Text style={[
            styles.alarmStatus,
            isTriggered && styles.alarmTriggered
          ]}>
            {alarmState}
          </Text>
        </View>
        
        <View style={styles.alarmButtons}>
          {isTriggered ? (
            <TouchableOpacity 
              style={[styles.alarmButton, styles.stopButton]}
              onPress={handleStopAlarm}
            >
              <Icon name="stop" size={24} color={colors.textPrimary} />
              <Text style={styles.alarmButtonText}>STOP ALARM</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              style={[
                styles.alarmButton, 
                isArmed ? styles.disarmButton : styles.armButton
              ]}
              onPress={handleAlarmToggle}
            >
              <Icon 
                name={isArmed ? 'shield-off' : 'shield-check'} 
                size={24} 
                color={colors.textPrimary} 
              />
              <Text style={styles.alarmButtonText}>
                {isArmed ? 'DISARM' : 'ARM'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };
  
  const renderCameraOverview = () => {
    const cameras = state.cameras || [];
    const online = cameras.filter(c => c.status === 'ONLINE').length;
    const recording = cameras.filter(c => c.status === 'RECORDING').length;
    
    return (
      <TouchableOpacity 
        style={[styles.overviewCard, shadows.small]}
        onPress={() => navigation.navigate('Cameras')}
      >
        <View style={styles.overviewHeader}>
          <Icon name="cctv" size={28} color={colors.accent} />
          <Text style={styles.overviewTitle}>Cameras</Text>
          <Icon name="chevron-right" size={24} color={colors.textMuted} />
        </View>
        
        <View style={styles.overviewStats}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{cameras.length}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.online }]}>{online}</Text>
            <Text style={styles.statLabel}>Online</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.recording }]}>{recording}</Text>
            <Text style={styles.statLabel}>Recording</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };
  
  const renderStorageHealth = () => {
    const storage = state.storageHealth;
    if (!storage) return null;
    
    const usagePercent = storage.usagePercent || 0;
    const healthColor = 
      storage.health === 'HEALTHY' ? colors.success :
      storage.health === 'WARNING' ? colors.warning : colors.danger;
    
    return (
      <View style={[styles.storageCard, shadows.small]}>
        <View style={styles.storageHeader}>
          <Icon name="harddisk" size={24} color={colors.textSecondary} />
          <Text style={styles.storageTitle}>Storage</Text>
          <Text style={[styles.storagePercent, { color: healthColor }]}>
            {usagePercent.toFixed(1)}%
          </Text>
        </View>
        
        <View style={styles.storageBar}>
          <View 
            style={[
              styles.storageBarFill, 
              { width: `${usagePercent}%`, backgroundColor: healthColor }
            ]} 
          />
        </View>
        
        <Text style={styles.storageText}>
          {storage.recordingCount || 0} recordings
        </Text>
      </View>
    );
  };
  
  const renderRecentEvents = () => {
    const recentEvents = events.slice(0, 5);
    
    return (
      <View style={[styles.eventsCard, shadows.small]}>
        <Text style={styles.sectionTitle}>Recent Events</Text>
        
        {recentEvents.length === 0 ? (
          <Text style={styles.noEvents}>No recent events</Text>
        ) : (
          recentEvents.map((event, index) => (
            <View key={index} style={styles.eventItem}>
              <Icon 
                name={getEventIcon(event.type)} 
                size={20} 
                color={getEventColor(event.type)} 
              />
              <View style={styles.eventText}>
                <Text style={styles.eventType}>{formatEventType(event.type)}</Text>
                <Text style={styles.eventTime}>
                  {formatTime(event.receivedAt)}
                </Text>
              </View>
            </View>
          ))
        )}
      </View>
    );
  };
  
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>ASTROSURVEILLANCE</Text>
        <Text style={styles.headerSubtitle}>Factory Monitoring</Text>
      </View>
      
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
          />
        }
      >
        {renderConnectionStatus()}
        {renderAlarmControl()}
        {renderCameraOverview()}
        {renderStorageHealth()}
        {renderRecentEvents()}
      </ScrollView>
    </SafeAreaView>
  );
};

// Helper functions
const getEventIcon = (type) => {
  const icons = {
    MOTION_DETECTED: 'motion-sensor',
    ALARM_TRIGGERED: 'alarm-light',
    ALARM_STOPPED: 'alarm-off',
    RECORDING_STARTED: 'record-rec',
    RECORDING_COMPLETE: 'check-circle',
  };
  return icons[type] || 'information';
};

const getEventColor = (type) => {
  const colors_map = {
    MOTION_DETECTED: colors.warning,
    ALARM_TRIGGERED: colors.danger,
    ALARM_STOPPED: colors.success,
    RECORDING_STARTED: colors.recording,
    RECORDING_COMPLETE: colors.success,
  };
  return colors_map[type] || colors.textSecondary;
};

const formatEventType = (type) => {
  return type.replace(/_/g, ' ').toLowerCase()
    .replace(/\b\w/g, l => l.toUpperCase());
};

const formatTime = (date) => {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleTimeString();
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerTitle: {
    ...typography.h1,
    color: colors.textPrimary,
  },
  headerSubtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.md,
  },
  statusCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    marginLeft: spacing.md,
  },
  statusTitle: {
    ...typography.body,
    fontWeight: '600',
  },
  statusSubtitle: {
    ...typography.caption,
  },
  alarmCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  alarmHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  alarmStatus: {
    ...typography.h2,
    marginLeft: spacing.md,
  },
  alarmTriggered: {
    color: colors.danger,
  },
  alarmButtons: {
    flexDirection: 'row',
  },
  alarmButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  armButton: {
    backgroundColor: colors.alarmArmed,
  },
  disarmButton: {
    backgroundColor: colors.alarmDisarmed,
  },
  stopButton: {
    backgroundColor: colors.danger,
  },
  alarmButtonText: {
    ...typography.body,
    fontWeight: 'bold',
    marginLeft: spacing.sm,
  },
  overviewCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  overviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  overviewTitle: {
    ...typography.h3,
    flex: 1,
    marginLeft: spacing.sm,
  },
  overviewStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  statLabel: {
    ...typography.caption,
  },
  storageCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  storageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  storageTitle: {
    ...typography.body,
    flex: 1,
    marginLeft: spacing.sm,
  },
  storagePercent: {
    ...typography.body,
    fontWeight: 'bold',
  },
  storageBar: {
    height: 8,
    backgroundColor: colors.surfaceLight,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
  },
  storageBarFill: {
    height: '100%',
    borderRadius: borderRadius.sm,
  },
  storageText: {
    ...typography.caption,
    marginTop: spacing.xs,
  },
  eventsCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  sectionTitle: {
    ...typography.h3,
    marginBottom: spacing.md,
  },
  noEvents: {
    ...typography.bodySmall,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  eventItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceLight,
  },
  eventText: {
    marginLeft: spacing.sm,
    flex: 1,
  },
  eventType: {
    ...typography.bodySmall,
  },
  eventTime: {
    ...typography.caption,
  },
});

export default DashboardScreen;

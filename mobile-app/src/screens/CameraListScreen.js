/**
 * ASTROSURVEILLANCE - Camera List Screen
 * 
 * Displays all registered cameras with status indicators.
 * Allows quick access to camera details and recordings.
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { useApp } from '../context/AppContext';
import { colors, spacing, borderRadius, typography, shadows } from '../utils/theme';

const CameraListScreen = ({ navigation }) => {
  const { state, actions } = useApp();
  const [refreshing, setRefreshing] = useState(false);
  
  useFocusEffect(
    useCallback(() => {
      actions.fetchCameras();
    }, [])
  );
  
  const onRefresh = async () => {
    setRefreshing(true);
    await actions.fetchCameras();
    setRefreshing(false);
  };
  
  const getStatusColor = (status) => {
    const statusColors = {
      ONLINE: colors.online,
      OFFLINE: colors.offline,
      RECORDING: colors.recording,
      ERROR: colors.error,
      INITIALIZING: colors.warning,
    };
    return statusColors[status] || colors.offline;
  };
  
  const getStatusIcon = (status) => {
    const icons = {
      ONLINE: 'check-circle',
      OFFLINE: 'minus-circle',
      RECORDING: 'record-circle',
      ERROR: 'alert-circle',
      INITIALIZING: 'loading',
    };
    return icons[status] || 'help-circle';
  };
  
  const renderCamera = ({ item }) => (
    <TouchableOpacity
      style={[styles.cameraCard, shadows.small]}
      onPress={() => navigation.navigate('CameraDetail', { 
        cameraId: item.id,
        cameraName: item.name 
      })}
    >
      <View style={styles.cameraIcon}>
        <Icon name="cctv" size={40} color={colors.textSecondary} />
        <View style={[
          styles.statusDot,
          { backgroundColor: getStatusColor(item.status) }
        ]} />
      </View>
      
      <View style={styles.cameraInfo}>
        <Text style={styles.cameraName}>{item.name}</Text>
        <Text style={styles.cameraLocation}>
          <Icon name="map-marker" size={14} color={colors.textMuted} />
          {' '}{item.location}
        </Text>
        <View style={styles.cameraStatus}>
          <Icon 
            name={getStatusIcon(item.status)} 
            size={16} 
            color={getStatusColor(item.status)} 
          />
          <Text style={[
            styles.statusText,
            { color: getStatusColor(item.status) }
          ]}>
            {item.status}
          </Text>
        </View>
      </View>
      
      <View style={styles.cameraActions}>
        <View style={styles.recordingCount}>
          <Icon name="video" size={16} color={colors.textMuted} />
          <Text style={styles.recordingCountText}>{item.recordingCount || 0}</Text>
        </View>
        <Icon name="chevron-right" size={24} color={colors.textMuted} />
      </View>
    </TouchableOpacity>
  );
  
  const renderEmptyList = () => (
    <View style={styles.emptyContainer}>
      <Icon name="cctv" size={80} color={colors.textMuted} />
      <Text style={styles.emptyTitle}>No Cameras</Text>
      <Text style={styles.emptyText}>
        No cameras have been registered yet.{'\n'}
        Use the server to discover and add cameras.
      </Text>
    </View>
  );
  
  const renderHeader = () => (
    <View style={styles.listHeader}>
      <Text style={styles.listHeaderText}>
        {state.cameras.length} camera{state.cameras.length !== 1 ? 's' : ''}
      </Text>
    </View>
  );
  
  return (
    <View style={styles.container}>
      <FlatList
        data={state.cameras}
        renderItem={renderCamera}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        ListHeaderComponent={state.cameras.length > 0 ? renderHeader : null}
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
  cameraCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cameraIcon: {
    position: 'relative',
    marginRight: spacing.md,
  },
  statusDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  cameraInfo: {
    flex: 1,
  },
  cameraName: {
    ...typography.h3,
    marginBottom: spacing.xs,
  },
  cameraLocation: {
    ...typography.bodySmall,
    marginBottom: spacing.xs,
  },
  cameraStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    ...typography.caption,
    marginLeft: spacing.xs,
    fontWeight: '600',
  },
  cameraActions: {
    alignItems: 'center',
  },
  recordingCount: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  recordingCountText: {
    ...typography.caption,
    marginLeft: spacing.xs,
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

export default CameraListScreen;

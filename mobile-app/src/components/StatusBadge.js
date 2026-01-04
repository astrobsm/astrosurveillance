/**
 * ASTROSURVEILLANCE - Status Badge Component
 * 
 * Reusable status indicator badge.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { colors, spacing, borderRadius, typography } from '../utils/theme';

const statusConfig = {
  online: {
    color: colors.success,
    icon: 'check-circle',
    label: 'Online',
  },
  offline: {
    color: colors.danger,
    icon: 'close-circle',
    label: 'Offline',
  },
  recording: {
    color: colors.accent,
    icon: 'record-rec',
    label: 'Recording',
  },
  idle: {
    color: colors.textMuted,
    icon: 'pause-circle',
    label: 'Idle',
  },
  error: {
    color: colors.danger,
    icon: 'alert-circle',
    label: 'Error',
  },
  connecting: {
    color: colors.warning,
    icon: 'loading',
    label: 'Connecting',
  },
};

const StatusBadge = ({ status, showLabel = true, size = 'medium' }) => {
  const config = statusConfig[status] || statusConfig.offline;
  
  const iconSize = size === 'small' ? 14 : size === 'large' ? 22 : 18;
  
  return (
    <View style={[styles.container, styles[size]]}>
      <View style={[styles.dot, { backgroundColor: config.color }]}>
        <Icon name={config.icon} size={iconSize} color={colors.textPrimary} />
      </View>
      {showLabel && (
        <Text style={[styles.label, { color: config.color }]}>
          {config.label}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  small: {
    
  },
  medium: {
    
  },
  large: {
    
  },
  dot: {
    borderRadius: borderRadius.round,
    padding: 2,
  },
  label: {
    ...typography.caption,
    marginLeft: spacing.xs,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
});

export default StatusBadge;

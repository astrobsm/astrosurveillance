/**
 * ASTROSURVEILLANCE - Settings Screen
 * 
 * System settings, admin access, and connection management.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Switch,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { useConnection } from '../context/ConnectionContext';
import { useApp } from '../context/AppContext';
import { colors, spacing, borderRadius, typography, shadows } from '../utils/theme';

const SettingsScreen = ({ navigation }) => {
  const { serverInfo, isAdmin, adminLogin, disconnect } = useConnection();
  const { state, actions } = useApp();
  
  const [showPinInput, setShowPinInput] = useState(false);
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  
  const handleAdminLogin = async () => {
    if (pin.length < 4) {
      Alert.alert('Error', 'PIN must be at least 4 digits');
      return;
    }
    
    try {
      setLoading(true);
      const success = await adminLogin(pin);
      
      if (success) {
        Alert.alert('Success', 'Admin access granted');
        setShowPinInput(false);
        setPin('');
      } else {
        Alert.alert('Error', 'Invalid PIN');
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };
  
  const handleDisconnect = () => {
    Alert.alert(
      'Disconnect',
      'Are you sure you want to disconnect from the server? You will need to pair again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            await disconnect();
          },
        },
      ]
    );
  };
  
  const handleCleanupStorage = async () => {
    Alert.alert(
      'Cleanup Storage',
      'This will delete old recordings to free up space. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Cleanup',
          onPress: async () => {
            try {
              await actions.cleanupStorage();
              Alert.alert('Success', 'Storage cleanup completed');
            } catch (error) {
              Alert.alert('Error', 'Cleanup failed');
            }
          },
        },
      ]
    );
  };
  
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Server Info */}
      <View style={[styles.section, shadows.small]}>
        <Text style={styles.sectionTitle}>Server Connection</Text>
        
        <View style={styles.infoRow}>
          <Icon name="server" size={20} color={colors.textMuted} />
          <Text style={styles.infoLabel}>Hostname:</Text>
          <Text style={styles.infoValue}>{serverInfo?.hostname || 'Unknown'}</Text>
        </View>
        
        <View style={styles.infoRow}>
          <Icon name="ip-network" size={20} color={colors.textMuted} />
          <Text style={styles.infoLabel}>Address:</Text>
          <Text style={styles.infoValue}>
            {serverInfo?.networkAddresses?.[0]?.address || 'Unknown'}
          </Text>
        </View>
        
        <View style={styles.infoRow}>
          <Icon name="clock-outline" size={20} color={colors.textMuted} />
          <Text style={styles.infoLabel}>Uptime:</Text>
          <Text style={styles.infoValue}>
            {serverInfo?.uptime 
              ? `${Math.floor(serverInfo.uptime / 3600)}h ${Math.floor((serverInfo.uptime % 3600) / 60)}m`
              : 'Unknown'}
          </Text>
        </View>
        
        <View style={styles.infoRow}>
          <Icon name="information" size={20} color={colors.textMuted} />
          <Text style={styles.infoLabel}>Version:</Text>
          <Text style={styles.infoValue}>{serverInfo?.version || '1.0.0'}</Text>
        </View>
      </View>
      
      {/* Admin Access */}
      <View style={[styles.section, shadows.small]}>
        <Text style={styles.sectionTitle}>Admin Access</Text>
        
        {isAdmin ? (
          <View style={styles.adminBadge}>
            <Icon name="shield-check" size={24} color={colors.success} />
            <Text style={styles.adminText}>Admin Mode Active</Text>
          </View>
        ) : showPinInput ? (
          <View style={styles.pinInputContainer}>
            <TextInput
              style={styles.pinInput}
              placeholder="Enter PIN"
              placeholderTextColor={colors.textMuted}
              value={pin}
              onChangeText={setPin}
              keyboardType="numeric"
              secureTextEntry
              maxLength={8}
            />
            <View style={styles.pinButtons}>
              <TouchableOpacity
                style={styles.pinButton}
                onPress={() => {
                  setShowPinInput(false);
                  setPin('');
                }}
              >
                <Text style={styles.pinButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.pinButton, styles.pinButtonPrimary]}
                onPress={handleAdminLogin}
                disabled={loading}
              >
                <Text style={[styles.pinButtonText, styles.pinButtonTextPrimary]}>
                  {loading ? 'Verifying...' : 'Login'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => setShowPinInput(true)}
          >
            <Icon name="shield-lock" size={24} color={colors.accent} />
            <Text style={styles.actionButtonText}>Enter Admin PIN</Text>
            <Icon name="chevron-right" size={24} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>
      
      {/* Storage */}
      <View style={[styles.section, shadows.small]}>
        <Text style={styles.sectionTitle}>Storage</Text>
        
        <View style={styles.storageInfo}>
          <View style={styles.storageBar}>
            <View 
              style={[
                styles.storageBarFill,
                { width: `${state.storageHealth?.usagePercent || 0}%` }
              ]} 
            />
          </View>
          <Text style={styles.storageText}>
            {state.storageHealth?.usagePercent?.toFixed(1) || 0}% used • 
            {state.storageHealth?.recordingCount || 0} recordings
          </Text>
        </View>
        
        {isAdmin && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleCleanupStorage}
          >
            <Icon name="broom" size={24} color={colors.warning} />
            <Text style={styles.actionButtonText}>Cleanup Old Recordings</Text>
            <Icon name="chevron-right" size={24} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>
      
      {/* Alarm Settings */}
      {isAdmin && (
        <View style={[styles.section, shadows.small]}>
          <Text style={styles.sectionTitle}>Alarm Settings</Text>
          
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Icon name="alarm" size={24} color={colors.textSecondary} />
              <Text style={styles.settingLabel}>Alarm Enabled</Text>
            </View>
            <Switch
              value={state.alarmState?.enabled}
              onValueChange={async (value) => {
                // Would update alarm config
              }}
              trackColor={{ false: colors.surfaceLight, true: colors.primaryLight }}
              thumbColor={state.alarmState?.enabled ? colors.accent : colors.textMuted}
            />
          </View>
          
          <View style={styles.infoRow}>
            <Icon name="timer" size={20} color={colors.textMuted} />
            <Text style={styles.infoLabel}>Duration:</Text>
            <Text style={styles.infoValue}>
              {state.alarmState?.durationSeconds || 10} seconds
            </Text>
          </View>
        </View>
      )}
      
      {/* Danger Zone */}
      <View style={[styles.section, styles.dangerSection, shadows.small]}>
        <Text style={[styles.sectionTitle, { color: colors.danger }]}>
          Danger Zone
        </Text>
        
        <TouchableOpacity
          style={[styles.actionButton, styles.dangerButton]}
          onPress={handleDisconnect}
        >
          <Icon name="logout" size={24} color={colors.danger} />
          <Text style={[styles.actionButtonText, { color: colors.danger }]}>
            Disconnect from Server
          </Text>
        </TouchableOpacity>
      </View>
      
      {/* App Info */}
      <View style={styles.appInfo}>
        <Text style={styles.appName}>ASTROSURVEILLANCE</Text>
        <Text style={styles.appVersion}>Mobile App v1.0.0</Text>
        <Text style={styles.appCopyright}>© 2026 Bonnesante Medicals</Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
  },
  section: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.h3,
    marginBottom: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceLight,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  infoLabel: {
    ...typography.bodySmall,
    marginLeft: spacing.sm,
    width: 80,
  },
  infoValue: {
    ...typography.body,
    flex: 1,
  },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceLight,
    padding: spacing.md,
    borderRadius: borderRadius.md,
  },
  adminText: {
    ...typography.body,
    color: colors.success,
    marginLeft: spacing.sm,
    fontWeight: 'bold',
  },
  pinInputContainer: {
    marginTop: spacing.sm,
  },
  pinInput: {
    backgroundColor: colors.surfaceLight,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    ...typography.body,
    color: colors.textPrimary,
    textAlign: 'center',
    fontSize: 24,
    letterSpacing: 8,
  },
  pinButtons: {
    flexDirection: 'row',
    marginTop: spacing.md,
  },
  pinButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: borderRadius.md,
    marginHorizontal: spacing.xs,
  },
  pinButtonPrimary: {
    backgroundColor: colors.accent,
  },
  pinButtonText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  pinButtonTextPrimary: {
    color: colors.textPrimary,
    fontWeight: 'bold',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceLight,
  },
  actionButtonText: {
    ...typography.body,
    flex: 1,
    marginLeft: spacing.sm,
  },
  storageInfo: {
    marginBottom: spacing.md,
  },
  storageBar: {
    height: 8,
    backgroundColor: colors.surfaceLight,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
    marginBottom: spacing.xs,
  },
  storageBarFill: {
    height: '100%',
    backgroundColor: colors.accent,
  },
  storageText: {
    ...typography.caption,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceLight,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingLabel: {
    ...typography.body,
    marginLeft: spacing.sm,
  },
  dangerSection: {
    borderWidth: 1,
    borderColor: colors.danger,
  },
  dangerButton: {
    borderTopWidth: 0,
  },
  appInfo: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  appName: {
    ...typography.h3,
    color: colors.textMuted,
  },
  appVersion: {
    ...typography.bodySmall,
    marginTop: spacing.xs,
  },
  appCopyright: {
    ...typography.caption,
    marginTop: spacing.xs,
  },
});

export default SettingsScreen;

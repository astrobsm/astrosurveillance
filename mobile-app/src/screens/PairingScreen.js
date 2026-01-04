/**
 * ASTROSURVEILLANCE - Pairing Screen
 * 
 * Initial setup screen for connecting to the edge server.
 * Supports QR code scanning and manual connection.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { useConnection } from '../context/ConnectionContext';
import { colors, spacing, borderRadius, typography, shadows } from '../utils/theme';

const PairingScreen = ({ navigation }) => {
  const { manualConnect, pairWithServer } = useConnection();
  
  const [showManual, setShowManual] = useState(false);
  const [serverIp, setServerIp] = useState('');
  const [serverPort, setServerPort] = useState('8080');
  const [loading, setLoading] = useState(false);
  
  const handleScanQR = () => {
    navigation.navigate('QRScanner');
  };
  
  const handleManualConnect = async () => {
    if (!serverIp) {
      Alert.alert('Error', 'Please enter server IP address');
      return;
    }
    
    const serverUrl = `http://${serverIp}:${serverPort || '8080'}`;
    
    try {
      setLoading(true);
      const connected = await manualConnect(serverUrl);
      
      if (connected) {
        // For manual connection, generate a device ID and try to pair
        const deviceId = `mobile_${Date.now()}`;
        
        // In production, this would require scanning QR or getting token from server
        Alert.alert(
          'Connected',
          'Connected to server. Please scan the pairing QR code from the server to complete setup.',
          [
            {
              text: 'Scan QR',
              onPress: () => navigation.navigate('QRScanner'),
            },
          ]
        );
      } else {
        Alert.alert('Error', 'Could not connect to server. Check the IP address and ensure the server is running.');
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo / Header */}
          <View style={styles.header}>
            <Icon name="cctv" size={80} color={colors.accent} />
            <Text style={styles.title}>ASTROSURVEILLANCE</Text>
            <Text style={styles.subtitle}>Factory Monitoring System</Text>
          </View>
          
          {/* Instructions */}
          <View style={styles.instructions}>
            <Text style={styles.instructionTitle}>Connect to Edge Server</Text>
            <Text style={styles.instructionText}>
              Scan the QR code displayed on the server, or connect manually 
              using the server's IP address.
            </Text>
          </View>
          
          {/* QR Scan Button */}
          <TouchableOpacity
            style={[styles.primaryButton, shadows.medium]}
            onPress={handleScanQR}
          >
            <Icon name="qrcode-scan" size={28} color={colors.textPrimary} />
            <Text style={styles.primaryButtonText}>Scan QR Code</Text>
          </TouchableOpacity>
          
          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>
          
          {/* Manual Connection */}
          {showManual ? (
            <View style={styles.manualSection}>
              <Text style={styles.manualTitle}>Manual Connection</Text>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Server IP Address</Text>
                <TextInput
                  style={styles.input}
                  placeholder="192.168.1.100"
                  placeholderTextColor={colors.textMuted}
                  value={serverIp}
                  onChangeText={setServerIp}
                  keyboardType="numeric"
                  autoCapitalize="none"
                />
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Port (default: 8080)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="8080"
                  placeholderTextColor={colors.textMuted}
                  value={serverPort}
                  onChangeText={setServerPort}
                  keyboardType="numeric"
                />
              </View>
              
              <TouchableOpacity
                style={[styles.connectButton, loading && styles.buttonDisabled]}
                onPress={handleManualConnect}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={colors.textPrimary} />
                ) : (
                  <>
                    <Icon name="connection" size={20} color={colors.textPrimary} />
                    <Text style={styles.connectButtonText}>Connect</Text>
                  </>
                )}
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowManual(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => setShowManual(true)}
            >
              <Icon name="ethernet" size={24} color={colors.textSecondary} />
              <Text style={styles.secondaryButtonText}>Connect Manually</Text>
            </TouchableOpacity>
          )}
          
          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Make sure your phone is connected to the same network as the surveillance system.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginTop: spacing.xxl,
    marginBottom: spacing.xl,
  },
  title: {
    ...typography.h1,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.bodySmall,
    marginTop: spacing.xs,
  },
  instructions: {
    marginBottom: spacing.xl,
  },
  instructionTitle: {
    ...typography.h3,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  instructionText: {
    ...typography.bodySmall,
    textAlign: 'center',
    lineHeight: 22,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.lg,
  },
  primaryButtonText: {
    ...typography.h3,
    marginLeft: spacing.md,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.xl,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.surfaceLight,
  },
  dividerText: {
    ...typography.bodySmall,
    marginHorizontal: spacing.md,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.surfaceLight,
  },
  secondaryButtonText: {
    ...typography.body,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
  },
  manualSection: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  manualTitle: {
    ...typography.h3,
    marginBottom: spacing.md,
  },
  inputGroup: {
    marginBottom: spacing.md,
  },
  inputLabel: {
    ...typography.bodySmall,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.surfaceLight,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.body,
    color: colors.textPrimary,
  },
  connectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryLight,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    marginTop: spacing.sm,
  },
  connectButtonText: {
    ...typography.body,
    fontWeight: 'bold',
    marginLeft: spacing.sm,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  cancelButtonText: {
    ...typography.body,
    color: colors.textMuted,
  },
  footer: {
    marginTop: 'auto',
    paddingTop: spacing.xl,
  },
  footerText: {
    ...typography.caption,
    textAlign: 'center',
    lineHeight: 18,
  },
});

export default PairingScreen;

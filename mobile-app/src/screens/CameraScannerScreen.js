/**
 * ASTROSURVEILLANCE - Camera Scanner Screen
 * 
 * Scans barcode/QR code on cameras to add them to the system.
 * 
 * Supported formats:
 * 1. JSON: {"ip":"192.168.1.100","username":"admin","password":"pass123"}
 * 2. RTSP URL: rtsp://admin:pass123@192.168.1.100:554/stream1
 * 3. ONVIF format: ONVIF:192.168.1.100:80:admin:pass123:Camera Name
 * 4. Simple format: ip:port:username:password:name:location
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import QRCodeScanner from 'react-native-qrcode-scanner';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { useConnection } from '../context/ConnectionContext';
import { colors, spacing, borderRadius, typography } from '../utils/theme';
import api from '../services/api';

const CameraScannerScreen = ({ navigation }) => {
  const { isConnected } = useConnection();
  const [scanning, setScanning] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [scannedData, setScannedData] = useState('');
  
  // Manual input fields
  const [manualData, setManualData] = useState({
    ip: '',
    port: '554',
    username: 'admin',
    password: '',
    name: '',
    location: '',
  });
  
  const handleScan = async (e) => {
    if (processing) return;
    
    setScanning(false);
    setScannedData(e.data);
    
    // Process the scanned data
    await addCameraFromScan(e.data);
  };
  
  const addCameraFromScan = async (data) => {
    if (!data) {
      Alert.alert('Error', 'No barcode data to process');
      return;
    }
    
    setProcessing(true);
    
    try {
      const response = await api.post('/cameras/scan', {
        scanData: data
      });
      
      if (response.data.code === 'SUCCESS') {
        const camera = response.data.data.camera;
        
        Alert.alert(
          'Camera Added!',
          `Successfully added ${camera.name || camera.id}\nLocation: ${camera.location || 'Not specified'}`,
          [
            {
              text: 'Add Another',
              onPress: () => {
                setScanning(true);
                setProcessing(false);
                setScannedData('');
              },
            },
            {
              text: 'Done',
              onPress: () => navigation.goBack(),
            },
          ]
        );
      } else {
        throw new Error(response.data.message || 'Failed to add camera');
      }
      
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'Failed to add camera';
      
      Alert.alert('Error', message, [
        {
          text: 'Try Again',
          onPress: () => {
            setScanning(true);
            setProcessing(false);
          },
        },
        {
          text: 'Enter Manually',
          onPress: () => {
            setShowManual(true);
            setProcessing(false);
          },
        },
      ]);
    }
  };
  
  const addCameraManually = async () => {
    if (!manualData.ip) {
      Alert.alert('Error', 'Camera IP address is required');
      return;
    }
    
    // Build the data object
    const cameraData = JSON.stringify({
      ip: manualData.ip,
      port: parseInt(manualData.port) || 554,
      username: manualData.username || 'admin',
      password: manualData.password || 'admin',
      name: manualData.name || `Camera ${manualData.ip}`,
      location: manualData.location || 'Unknown',
    });
    
    await addCameraFromScan(cameraData);
  };
  
  const handleClose = () => {
    navigation.goBack();
  };
  
  if (!isConnected) {
    return (
      <View style={styles.container}>
        <View style={styles.notConnected}>
          <Icon name="server-off" size={64} color={colors.textMuted} />
          <Text style={styles.notConnectedTitle}>Not Connected</Text>
          <Text style={styles.notConnectedText}>
            Please connect to the surveillance server first
          </Text>
          <TouchableOpacity
            style={styles.connectButton}
            onPress={() => navigation.navigate('Pairing')}
          >
            <Icon name="connection" size={20} color={colors.textPrimary} />
            <Text style={styles.connectButtonText}>Connect to Server</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }
  
  if (showManual) {
    return (
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView style={styles.manualContainer}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => setShowManual(false)}>
              <Icon name="arrow-left" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Add Camera Manually</Text>
            <View style={{ width: 24 }} />
          </View>
          
          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Camera IP Address *</Text>
              <TextInput
                style={styles.input}
                value={manualData.ip}
                onChangeText={(text) => setManualData({ ...manualData, ip: text })}
                placeholder="192.168.1.100"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
                autoCapitalize="none"
              />
            </View>
            
            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: spacing.sm }]}>
                <Text style={styles.label}>RTSP Port</Text>
                <TextInput
                  style={styles.input}
                  value={manualData.port}
                  onChangeText={(text) => setManualData({ ...manualData, port: text })}
                  placeholder="554"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                />
              </View>
              
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.label}>Username</Text>
                <TextInput
                  style={styles.input}
                  value={manualData.username}
                  onChangeText={(text) => setManualData({ ...manualData, username: text })}
                  placeholder="admin"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="none"
                />
              </View>
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                value={manualData.password}
                onChangeText={(text) => setManualData({ ...manualData, password: text })}
                placeholder="Enter password"
                placeholderTextColor={colors.textMuted}
                secureTextEntry
                autoCapitalize="none"
              />
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Camera Name</Text>
              <TextInput
                style={styles.input}
                value={manualData.name}
                onChangeText={(text) => setManualData({ ...manualData, name: text })}
                placeholder="Factory Entrance"
                placeholderTextColor={colors.textMuted}
              />
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Location</Text>
              <TextInput
                style={styles.input}
                value={manualData.location}
                onChangeText={(text) => setManualData({ ...manualData, location: text })}
                placeholder="Building A, Floor 1"
                placeholderTextColor={colors.textMuted}
              />
            </View>
            
            <TouchableOpacity
              style={styles.addButton}
              onPress={addCameraManually}
              disabled={processing}
            >
              {processing ? (
                <Text style={styles.addButtonText}>Adding Camera...</Text>
              ) : (
                <>
                  <Icon name="plus" size={20} color="#fff" />
                  <Text style={styles.addButtonText}>Add Camera</Text>
                </>
              )}
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.scanButton}
              onPress={() => {
                setShowManual(false);
                setScanning(true);
              }}
            >
              <Icon name="qrcode-scan" size={20} color={colors.accent} />
              <Text style={styles.scanButtonText}>Scan Barcode Instead</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }
  
  return (
    <View style={styles.container}>
      <QRCodeScanner
        onRead={handleScan}
        reactivate={scanning}
        reactivateTimeout={2000}
        showMarker={true}
        markerStyle={styles.marker}
        cameraStyle={styles.camera}
        topContent={
          <View style={styles.topContent}>
            <Icon name="barcode-scan" size={32} color={colors.accent} />
            <Text style={styles.title}>Scan Camera Barcode</Text>
            <Text style={styles.subtitle}>
              Point your camera at the QR code or barcode on the surveillance camera
            </Text>
          </View>
        }
        bottomContent={
          <View style={styles.bottomContent}>
            {processing ? (
              <View style={styles.processingContainer}>
                <Icon name="loading" size={24} color={colors.accent} />
                <Text style={styles.processingText}>Adding camera to system...</Text>
              </View>
            ) : (
              <>
                <View style={styles.buttonRow}>
                  <TouchableOpacity
                    style={styles.manualButton}
                    onPress={() => setShowManual(true)}
                  >
                    <Icon name="keyboard" size={20} color={colors.textPrimary} />
                    <Text style={styles.manualButtonText}>Enter Manually</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={handleClose}
                  >
                    <Icon name="close" size={20} color={colors.textPrimary} />
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
            
            <View style={styles.supportedFormats}>
              <Text style={styles.formatsTitle}>Supported Barcode Formats:</Text>
              <Text style={styles.formatItem}>• QR Code with camera JSON data</Text>
              <Text style={styles.formatItem}>• RTSP URL encoded in barcode</Text>
              <Text style={styles.formatItem}>• ONVIF camera identifier</Text>
              <Text style={styles.formatItem}>• Simple IP:port:user:pass format</Text>
            </View>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  camera: {
    height: '45%',
  },
  marker: {
    borderColor: colors.accent,
    borderRadius: borderRadius.md,
    borderWidth: 3,
  },
  topContent: {
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  title: {
    ...typography.h2,
    marginTop: spacing.md,
  },
  subtitle: {
    ...typography.bodySmall,
    textAlign: 'center',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  bottomContent: {
    flex: 1,
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  processingContainer: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  processingText: {
    ...typography.body,
    color: colors.accent,
    marginLeft: spacing.sm,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  manualButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  manualButtonText: {
    ...typography.body,
    marginLeft: spacing.sm,
  },
  cancelButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceLight,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  cancelButtonText: {
    ...typography.body,
    marginLeft: spacing.sm,
  },
  supportedFormats: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  formatsTitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    fontWeight: '600',
  },
  formatItem: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: 4,
  },
  
  // Manual Input Styles
  manualContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    backgroundColor: colors.surface,
  },
  headerTitle: {
    ...typography.h3,
  },
  form: {
    padding: spacing.lg,
  },
  inputGroup: {
    marginBottom: spacing.md,
  },
  label: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.body,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.surfaceLight,
  },
  row: {
    flexDirection: 'row',
  },
  addButton: {
    backgroundColor: colors.accent,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  addButtonText: {
    ...typography.body,
    color: '#fff',
    fontWeight: '600',
    marginLeft: spacing.sm,
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    marginTop: spacing.md,
  },
  scanButtonText: {
    ...typography.body,
    color: colors.accent,
    marginLeft: spacing.sm,
  },
  
  // Not Connected Styles
  notConnected: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  notConnectedTitle: {
    ...typography.h2,
    marginTop: spacing.lg,
  },
  notConnectedText: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  connectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    marginTop: spacing.lg,
  },
  connectButtonText: {
    ...typography.body,
    color: '#fff',
    marginLeft: spacing.sm,
    fontWeight: '600',
  },
});

export default CameraScannerScreen;

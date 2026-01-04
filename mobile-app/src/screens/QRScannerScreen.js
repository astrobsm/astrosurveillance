/**
 * ASTROSURVEILLANCE - QR Scanner Screen
 * 
 * Scans pairing QR code from edge server.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  TouchableOpacity,
} from 'react-native';
import QRCodeScanner from 'react-native-qrcode-scanner';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { useConnection } from '../context/ConnectionContext';
import { colors, spacing, borderRadius, typography } from '../utils/theme';

const QRScannerScreen = ({ navigation }) => {
  const { pairWithServer } = useConnection();
  const [scanning, setScanning] = useState(true);
  const [processing, setProcessing] = useState(false);
  
  const handleScan = async (e) => {
    if (processing) return;
    
    setScanning(false);
    setProcessing(true);
    
    try {
      const data = JSON.parse(e.data);
      
      // Validate QR data
      if (data.type !== 'ASTROSURVEILLANCE') {
        throw new Error('Invalid QR code. Please scan the QR code from the ASTROSURVEILLANCE server.');
      }
      
      if (!data.server || !data.token) {
        throw new Error('Invalid pairing data');
      }
      
      // Check expiry
      if (new Date(data.expires) < new Date()) {
        throw new Error('QR code has expired. Please generate a new one from the server.');
      }
      
      // Attempt pairing
      const deviceId = `mobile_${Date.now()}`;
      const success = await pairWithServer(data.server, data.token, deviceId);
      
      if (success) {
        Alert.alert(
          'Success',
          'Successfully paired with the surveillance server!',
          [
            {
              text: 'OK',
              onPress: () => navigation.goBack(),
            },
          ]
        );
      } else {
        throw new Error('Pairing failed. Please try again.');
      }
      
    } catch (error) {
      let message = error.message;
      
      if (error instanceof SyntaxError) {
        message = 'Invalid QR code format. Please scan the QR code from the ASTROSURVEILLANCE server.';
      }
      
      Alert.alert('Error', message, [
        {
          text: 'Try Again',
          onPress: () => {
            setScanning(true);
            setProcessing(false);
          },
        },
        {
          text: 'Cancel',
          onPress: () => navigation.goBack(),
          style: 'cancel',
        },
      ]);
    }
  };
  
  const handleClose = () => {
    navigation.goBack();
  };
  
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
            <Icon name="qrcode-scan" size={32} color={colors.accent} />
            <Text style={styles.title}>Scan Pairing QR Code</Text>
            <Text style={styles.subtitle}>
              Point your camera at the QR code displayed on the server
            </Text>
          </View>
        }
        bottomContent={
          <View style={styles.bottomContent}>
            {processing ? (
              <View style={styles.processingContainer}>
                <Text style={styles.processingText}>Connecting to server...</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={handleClose}
              >
                <Icon name="close" size={24} color={colors.textPrimary} />
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            )}
            
            <View style={styles.instructions}>
              <View style={styles.instructionItem}>
                <Icon name="numeric-1-circle" size={20} color={colors.accent} />
                <Text style={styles.instructionText}>
                  Open server web interface
                </Text>
              </View>
              <View style={styles.instructionItem}>
                <Icon name="numeric-2-circle" size={20} color={colors.accent} />
                <Text style={styles.instructionText}>
                  Go to System → Generate Pairing QR
                </Text>
              </View>
              <View style={styles.instructionItem}>
                <Icon name="numeric-3-circle" size={20} color={colors.accent} />
                <Text style={styles.instructionText}>
                  Scan the displayed QR code
                </Text>
              </View>
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
    height: '50%',
  },
  marker: {
    borderColor: colors.accent,
    borderRadius: borderRadius.md,
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
  },
  bottomContent: {
    flex: 1,
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  processingContainer: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  processingText: {
    ...typography.body,
    color: colors.accent,
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
  },
  cancelButtonText: {
    ...typography.body,
    marginLeft: spacing.sm,
  },
  instructions: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  instructionText: {
    ...typography.bodySmall,
    marginLeft: spacing.sm,
    flex: 1,
  },
});

export default QRScannerScreen;

/**
 * ASTROSURVEILLANCE - App Navigator
 * 
 * Main navigation structure with bottom tabs and stack navigators.
 */

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { useConnection } from '../context/ConnectionContext';
import { colors } from '../utils/theme';

// Screens
import DashboardScreen from '../screens/DashboardScreen';
import CameraListScreen from '../screens/CameraListScreen';
import CameraDetailScreen from '../screens/CameraDetailScreen';
import RecordingsScreen from '../screens/RecordingsScreen';
import RecordingPlayerScreen from '../screens/RecordingPlayerScreen';
import SettingsScreen from '../screens/SettingsScreen';
import PairingScreen from '../screens/PairingScreen';
import QRScannerScreen from '../screens/QRScannerScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// Stack navigators for each tab
function CameraStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: colors.textPrimary,
        headerTitleStyle: { fontWeight: 'bold' },
      }}
    >
      <Stack.Screen 
        name="CameraList" 
        component={CameraListScreen} 
        options={{ title: 'Cameras' }}
      />
      <Stack.Screen 
        name="CameraDetail" 
        component={CameraDetailScreen}
        options={({ route }) => ({ title: route.params?.cameraName || 'Camera' })}
      />
    </Stack.Navigator>
  );
}

function RecordingsStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: colors.textPrimary,
        headerTitleStyle: { fontWeight: 'bold' },
      }}
    >
      <Stack.Screen 
        name="RecordingsList" 
        component={RecordingsScreen} 
        options={{ title: 'Recordings' }}
      />
      <Stack.Screen 
        name="RecordingPlayer" 
        component={RecordingPlayerScreen}
        options={{ title: 'Playback' }}
      />
    </Stack.Navigator>
  );
}

function SettingsStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: colors.textPrimary,
        headerTitleStyle: { fontWeight: 'bold' },
      }}
    >
      <Stack.Screen 
        name="SettingsMain" 
        component={SettingsScreen} 
        options={{ title: 'Settings' }}
      />
    </Stack.Navigator>
  );
}

// Main tab navigator
function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          
          switch (route.name) {
            case 'Dashboard':
              iconName = focused ? 'view-dashboard' : 'view-dashboard-outline';
              break;
            case 'Cameras':
              iconName = focused ? 'cctv' : 'cctv';
              break;
            case 'Recordings':
              iconName = focused ? 'video' : 'video-outline';
              break;
            case 'Settings':
              iconName = focused ? 'cog' : 'cog-outline';
              break;
            default:
              iconName = 'circle';
          }
          
          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.surfaceLight,
          paddingBottom: 4,
          height: 60,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
        headerShown: false,
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Cameras" component={CameraStack} />
      <Tab.Screen name="Recordings" component={RecordingsStack} />
      <Tab.Screen name="Settings" component={SettingsStack} />
    </Tab.Navigator>
  );
}

// Root navigator with pairing flow
function AppNavigator() {
  const { isPaired } = useConnection();
  
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!isPaired ? (
        // Pairing flow
        <>
          <Stack.Screen name="Pairing" component={PairingScreen} />
          <Stack.Screen 
            name="QRScanner" 
            component={QRScannerScreen}
            options={{ 
              headerShown: true,
              headerStyle: { backgroundColor: colors.primary },
              headerTintColor: colors.textPrimary,
              title: 'Scan QR Code'
            }}
          />
        </>
      ) : (
        // Main app
        <Stack.Screen name="Main" component={MainTabs} />
      )}
    </Stack.Navigator>
  );
}

export default AppNavigator;

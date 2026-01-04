/**
 * ASTROSURVEILLANCE Mobile App
 * 
 * Main entry point for the React Native application.
 * Provides secure access to factory surveillance cameras.
 */

import React, { useEffect } from 'react';
import { StatusBar, LogBox } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppProvider } from './src/context/AppContext';
import { ConnectionProvider } from './src/context/ConnectionContext';
import AppNavigator from './src/navigation/AppNavigator';
import { colors } from './src/utils/theme';

// Suppress specific warnings for cleaner development experience
LogBox.ignoreLogs([
  'Non-serializable values were found in the navigation state',
]);

const App = () => {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <ConnectionProvider>
          <NavigationContainer>
            <StatusBar 
              barStyle="light-content" 
              backgroundColor={colors.primary} 
            />
            <AppNavigator />
          </NavigationContainer>
        </ConnectionProvider>
      </AppProvider>
    </SafeAreaProvider>
  );
};

export default App;

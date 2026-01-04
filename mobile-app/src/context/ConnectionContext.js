/**
 * ASTROSURVEILLANCE - Connection Context
 * 
 * Manages connection state to the edge server.
 * Handles pairing, authentication, and WebSocket connection.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { api } from '../services/api';

const ConnectionContext = createContext(null);

export function ConnectionProvider({ children }) {
  const [isConnected, setIsConnected] = useState(false);
  const [isPaired, setIsPaired] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [serverInfo, setServerInfo] = useState(null);
  const [networkState, setNetworkState] = useState(null);
  const [wsConnection, setWsConnection] = useState(null);
  const [events, setEvents] = useState([]);
  
  // Initialize connection on mount
  useEffect(() => {
    initializeConnection();
    
    // Subscribe to network state changes
    const unsubscribe = NetInfo.addEventListener(state => {
      setNetworkState(state);
      if (state.isConnected && isPaired) {
        checkServerConnection();
      }
    });
    
    return () => {
      unsubscribe();
      if (wsConnection) {
        wsConnection.close();
      }
    };
  }, []);
  
  const initializeConnection = async () => {
    const connected = await api.initialize();
    setIsConnected(connected);
    setIsPaired(!!api.pairingToken);
    
    if (connected) {
      await fetchServerInfo();
      connectWebSocket();
    }
  };
  
  const checkServerConnection = async () => {
    const connected = await api.checkConnection();
    setIsConnected(connected);
    return connected;
  };
  
  const fetchServerInfo = async () => {
    try {
      const info = await api.getSystemInfo();
      setServerInfo(info);
      return info;
    } catch (error) {
      console.error('Failed to fetch server info:', error);
      return null;
    }
  };
  
  const connectWebSocket = useCallback(() => {
    if (wsConnection) {
      wsConnection.close();
    }
    
    try {
      const ws = api.connectWebSocket((data) => {
        handleWebSocketMessage(data);
      });
      
      setWsConnection(ws);
    } catch (error) {
      console.error('WebSocket connection failed:', error);
    }
  }, []);
  
  const handleWebSocketMessage = (data) => {
    // Add event to list (keep last 50)
    setEvents(prev => {
      const updated = [{ ...data, receivedAt: new Date() }, ...prev];
      return updated.slice(0, 50);
    });
    
    // Handle specific event types
    switch (data.type) {
      case 'MOTION_DETECTED':
        // Could trigger notification here
        break;
      case 'ALARM_TRIGGERED':
        // Could trigger vibration/sound here
        break;
      case 'RECORDING_COMPLETE':
        // Could refresh recordings list
        break;
    }
  };
  
  const pairWithServer = async (serverUrl, pairingToken, deviceId) => {
    try {
      await api.setServerUrl(serverUrl);
      
      const result = await api.validatePairing(pairingToken, deviceId);
      
      if (result && result.session) {
        await api.setSession(result.session.sessionId, result.pairingToken);
        setIsPaired(true);
        setIsConnected(true);
        
        await fetchServerInfo();
        connectWebSocket();
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Pairing failed:', error);
      throw error;
    }
  };
  
  const manualConnect = async (serverUrl) => {
    try {
      await api.setServerUrl(serverUrl);
      const connected = await api.checkConnection();
      
      if (connected) {
        setIsConnected(true);
        await fetchServerInfo();
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Manual connection failed:', error);
      return false;
    }
  };
  
  const adminLogin = async (pin) => {
    try {
      const result = await api.adminLogin(pin);
      
      if (result && result.sessionId) {
        await api.setSession(result.sessionId, api.pairingToken);
        setIsAdmin(true);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Admin login failed:', error);
      throw error;
    }
  };
  
  const disconnect = async () => {
    if (wsConnection) {
      wsConnection.close();
      setWsConnection(null);
    }
    
    await api.logout();
    
    setIsConnected(false);
    setIsPaired(false);
    setIsAdmin(false);
    setServerInfo(null);
    setEvents([]);
  };
  
  const value = {
    isConnected,
    isPaired,
    isAdmin,
    serverInfo,
    networkState,
    events,
    
    // Actions
    checkConnection: checkServerConnection,
    pairWithServer,
    manualConnect,
    adminLogin,
    disconnect,
    reconnectWebSocket: connectWebSocket,
  };
  
  return (
    <ConnectionContext.Provider value={value}>
      {children}
    </ConnectionContext.Provider>
  );
}

export function useConnection() {
  const context = useContext(ConnectionContext);
  if (!context) {
    throw new Error('useConnection must be used within ConnectionProvider');
  }
  return context;
}

export default ConnectionContext;

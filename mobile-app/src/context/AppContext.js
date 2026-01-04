/**
 * ASTROSURVEILLANCE - App Context
 * 
 * Global state management for the mobile app.
 * Handles cameras, recordings, alarm state, and storage.
 */

import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { api } from '../services/api';

// Initial state
const initialState = {
  cameras: [],
  selectedCamera: null,
  recordings: [],
  alarmState: null,
  storageHealth: null,
  systemStatus: null,
  isLoading: false,
  error: null,
  lastUpdated: null,
};

// Action types
const ActionTypes = {
  SET_LOADING: 'SET_LOADING',
  SET_ERROR: 'SET_ERROR',
  SET_CAMERAS: 'SET_CAMERAS',
  SET_SELECTED_CAMERA: 'SET_SELECTED_CAMERA',
  SET_RECORDINGS: 'SET_RECORDINGS',
  SET_ALARM_STATE: 'SET_ALARM_STATE',
  SET_STORAGE_HEALTH: 'SET_STORAGE_HEALTH',
  SET_SYSTEM_STATUS: 'SET_SYSTEM_STATUS',
  UPDATE_CAMERA: 'UPDATE_CAMERA',
  CLEAR_ERROR: 'CLEAR_ERROR',
  RESET: 'RESET',
};

// Reducer
function appReducer(state, action) {
  switch (action.type) {
    case ActionTypes.SET_LOADING:
      return { ...state, isLoading: action.payload };
      
    case ActionTypes.SET_ERROR:
      return { ...state, error: action.payload, isLoading: false };
      
    case ActionTypes.SET_CAMERAS:
      return { 
        ...state, 
        cameras: action.payload, 
        lastUpdated: new Date(),
        isLoading: false 
      };
      
    case ActionTypes.SET_SELECTED_CAMERA:
      return { ...state, selectedCamera: action.payload };
      
    case ActionTypes.SET_RECORDINGS:
      return { ...state, recordings: action.payload, isLoading: false };
      
    case ActionTypes.SET_ALARM_STATE:
      return { ...state, alarmState: action.payload };
      
    case ActionTypes.SET_STORAGE_HEALTH:
      return { ...state, storageHealth: action.payload };
      
    case ActionTypes.SET_SYSTEM_STATUS:
      return { ...state, systemStatus: action.payload };
      
    case ActionTypes.UPDATE_CAMERA:
      return {
        ...state,
        cameras: state.cameras.map(cam =>
          cam.id === action.payload.id ? { ...cam, ...action.payload } : cam
        ),
      };
      
    case ActionTypes.CLEAR_ERROR:
      return { ...state, error: null };
      
    case ActionTypes.RESET:
      return initialState;
      
    default:
      return state;
  }
}

// Create context
const AppContext = createContext(null);

// Provider component
export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, initialState);
  
  // Actions
  const actions = {
    setLoading: (loading) => {
      dispatch({ type: ActionTypes.SET_LOADING, payload: loading });
    },
    
    setError: (error) => {
      dispatch({ type: ActionTypes.SET_ERROR, payload: error });
    },
    
    clearError: () => {
      dispatch({ type: ActionTypes.CLEAR_ERROR });
    },
    
    fetchCameras: async () => {
      try {
        dispatch({ type: ActionTypes.SET_LOADING, payload: true });
        const cameras = await api.getCameras();
        dispatch({ type: ActionTypes.SET_CAMERAS, payload: cameras });
        return cameras;
      } catch (error) {
        dispatch({ type: ActionTypes.SET_ERROR, payload: error.message });
        return [];
      }
    },
    
    selectCamera: (camera) => {
      dispatch({ type: ActionTypes.SET_SELECTED_CAMERA, payload: camera });
    },
    
    fetchRecordings: async (cameraId = null) => {
      try {
        dispatch({ type: ActionTypes.SET_LOADING, payload: true });
        const recordings = cameraId 
          ? await api.getRecordingsForCamera(cameraId)
          : await api.getRecordings();
        dispatch({ type: ActionTypes.SET_RECORDINGS, payload: recordings });
        return recordings;
      } catch (error) {
        dispatch({ type: ActionTypes.SET_ERROR, payload: error.message });
        return [];
      }
    },
    
    fetchAlarmState: async () => {
      try {
        const alarmState = await api.getAlarmStatus();
        dispatch({ type: ActionTypes.SET_ALARM_STATE, payload: alarmState });
        return alarmState;
      } catch (error) {
        console.error('Failed to fetch alarm state:', error);
        return null;
      }
    },
    
    toggleAlarm: async () => {
      try {
        const result = await api.toggleAlarm();
        dispatch({ type: ActionTypes.SET_ALARM_STATE, payload: result });
        return result;
      } catch (error) {
        dispatch({ type: ActionTypes.SET_ERROR, payload: error.message });
        return null;
      }
    },
    
    stopAlarm: async () => {
      try {
        const result = await api.stopAlarm();
        dispatch({ type: ActionTypes.SET_ALARM_STATE, payload: result });
        return result;
      } catch (error) {
        dispatch({ type: ActionTypes.SET_ERROR, payload: error.message });
        return null;
      }
    },
    
    fetchStorageHealth: async () => {
      try {
        const health = await api.getStorageHealth();
        dispatch({ type: ActionTypes.SET_STORAGE_HEALTH, payload: health });
        return health;
      } catch (error) {
        console.error('Failed to fetch storage health:', error);
        return null;
      }
    },
    
    fetchSystemStatus: async () => {
      try {
        const status = await api.getSystemStatus();
        dispatch({ type: ActionTypes.SET_SYSTEM_STATUS, payload: status });
        return status;
      } catch (error) {
        console.error('Failed to fetch system status:', error);
        return null;
      }
    },
    
    updateCameraState: (cameraId, updates) => {
      dispatch({ 
        type: ActionTypes.UPDATE_CAMERA, 
        payload: { id: cameraId, ...updates } 
      });
    },
    
    refreshAll: async () => {
      await Promise.all([
        actions.fetchCameras(),
        actions.fetchAlarmState(),
        actions.fetchStorageHealth(),
      ]);
    },
    
    reset: () => {
      dispatch({ type: ActionTypes.RESET });
    },
  };
  
  return (
    <AppContext.Provider value={{ state, actions }}>
      {children}
    </AppContext.Provider>
  );
}

// Hook for using context
export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}

export default AppContext;

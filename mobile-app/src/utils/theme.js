/**
 * ASTROSURVEILLANCE - Theme Configuration
 * 
 * Consistent styling across the mobile app.
 * Professional factory surveillance aesthetic.
 */

export const colors = {
  // Primary brand colors
  primary: '#1a237e',        // Deep blue
  primaryDark: '#0d1642',    // Darker blue
  primaryLight: '#3949ab',   // Lighter blue
  
  // Accent colors
  accent: '#ff6f00',         // Alert orange
  accentLight: '#ffa040',    // Light orange
  
  // Status colors
  success: '#2e7d32',        // Green
  warning: '#f9a825',        // Yellow
  danger: '#c62828',         // Red
  
  // UI colors
  background: '#121212',     // Dark background
  surface: '#1e1e1e',        // Card surfaces
  surfaceLight: '#2d2d2d',   // Lighter surface
  
  // Text colors
  textPrimary: '#ffffff',
  textSecondary: '#b0b0b0',
  textMuted: '#707070',
  
  // Camera status
  online: '#4caf50',
  offline: '#757575',
  recording: '#f44336',
  error: '#ff5722',
  
  // Alarm colors
  alarmArmed: '#4caf50',
  alarmDisarmed: '#757575',
  alarmTriggered: '#f44336',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const borderRadius = {
  sm: 4,
  md: 8,
  lg: 16,
  xl: 24,
  round: 9999,
};

export const typography = {
  h1: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  h2: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  h3: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  body: {
    fontSize: 16,
    color: colors.textPrimary,
  },
  bodySmall: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  caption: {
    fontSize: 12,
    color: colors.textMuted,
  },
};

export const shadows = {
  small: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 2,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.30,
    shadowRadius: 4.65,
    elevation: 4,
  },
  large: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.37,
    shadowRadius: 7.49,
    elevation: 8,
  },
};

export default {
  colors,
  spacing,
  borderRadius,
  typography,
  shadows,
};

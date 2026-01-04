/**
 * ASTROSURVEILLANCE - Button Component
 * 
 * Reusable button with variants and loading state.
 */

import React from 'react';
import { 
  TouchableOpacity, 
  Text, 
  StyleSheet, 
  ActivityIndicator 
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { colors, spacing, borderRadius, typography } from '../utils/theme';

const Button = ({ 
  title, 
  onPress, 
  variant = 'primary', 
  icon, 
  iconRight,
  loading = false,
  disabled = false,
  size = 'medium',
  style,
}) => {
  const buttonStyles = [
    styles.button,
    styles[variant],
    styles[`size_${size}`],
    disabled && styles.disabled,
    style,
  ];
  
  const textStyles = [
    styles.text,
    styles[`text_${variant}`],
    styles[`textSize_${size}`],
  ];
  
  const iconColor = variant === 'primary' || variant === 'danger' 
    ? colors.textPrimary 
    : colors.textSecondary;
  
  const iconSize = size === 'small' ? 16 : size === 'large' ? 24 : 20;
  
  return (
    <TouchableOpacity
      style={buttonStyles}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator color={iconColor} size="small" />
      ) : (
        <>
          {icon && !iconRight && (
            <Icon name={icon} size={iconSize} color={iconColor} style={styles.iconLeft} />
          )}
          <Text style={textStyles}>{title}</Text>
          {icon && iconRight && (
            <Icon name={icon} size={iconSize} color={iconColor} style={styles.iconRight} />
          )}
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.md,
  },
  
  // Variants
  primary: {
    backgroundColor: colors.accent,
  },
  secondary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceLight,
  },
  danger: {
    backgroundColor: colors.danger,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  
  // Sizes
  size_small: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  size_medium: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  size_large: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  
  disabled: {
    opacity: 0.5,
  },
  
  text: {
    fontWeight: 'bold',
  },
  text_primary: {
    color: colors.textPrimary,
  },
  text_secondary: {
    color: colors.textSecondary,
  },
  text_danger: {
    color: colors.textPrimary,
  },
  text_ghost: {
    color: colors.textSecondary,
  },
  
  textSize_small: {
    ...typography.caption,
  },
  textSize_medium: {
    ...typography.body,
  },
  textSize_large: {
    ...typography.h3,
  },
  
  iconLeft: {
    marginRight: spacing.xs,
  },
  iconRight: {
    marginLeft: spacing.xs,
  },
});

export default Button;

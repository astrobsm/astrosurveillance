/**
 * ASTROSURVEILLANCE - Card Component
 * 
 * Reusable card container with shadow and styling.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { colors, spacing, borderRadius, typography, shadows } from '../utils/theme';

const Card = ({ 
  title, 
  subtitle, 
  icon, 
  iconColor = colors.accent,
  children, 
  onPress,
  style,
  headerRight,
}) => {
  const Container = onPress ? TouchableOpacity : View;
  
  return (
    <Container 
      style={[styles.container, shadows.small, style]} 
      onPress={onPress}
      activeOpacity={0.7}
    >
      {(title || icon) && (
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {icon && (
              <Icon name={icon} size={24} color={iconColor} style={styles.icon} />
            )}
            <View>
              {title && <Text style={styles.title}>{title}</Text>}
              {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
            </View>
          </View>
          {headerRight}
        </View>
      )}
      {children && <View style={styles.content}>{children}</View>}
    </Container>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceLight,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  icon: {
    marginRight: spacing.sm,
  },
  title: {
    ...typography.h3,
  },
  subtitle: {
    ...typography.caption,
    marginTop: 2,
  },
  content: {
    padding: spacing.md,
  },
});

export default Card;

import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { theme } from '@/constants/Theme';

export function GlowButton({ label, onPress, accent = theme.colors.bands.beta, style }: { label: string; onPress?: () => void; accent?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={onPress}
      style={[styles.base, { borderColor: accent, backgroundColor: accent + '0f' }, style]}
    >
      <Text style={[styles.label, { color: theme.colors.text }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: theme.borderRadius.pill,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderWidth: 1,
    alignItems: 'center',
    shadowColor: theme.colors.bands.gamma,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
    fontVariant: ['tabular-nums'] as const,
  },
});

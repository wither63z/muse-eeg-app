import React from 'react';
import { TouchableOpacity, View, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { Theme } from '@/src/theme/tokens';

export function ModernButton({
  children,
  accent = Theme.colors.ch4_Beta_TP10,
  onPress,
  style,
}: { children?: React.ReactNode; accent?: string; onPress?: () => void; style?: StyleProp<ViewStyle> }) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={[styles.base, style]}
    >
      <View style={[styles.inner, { borderColor: accent, backgroundColor: accent + '0f' }]}>
        {children}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Theme.metrics.borderRadius,
    paddingVertical: 14,
    paddingHorizontal: Theme.metrics.padding,
    backgroundColor: Theme.colors.bg,
    borderWidth: Theme.metrics.borderWidth,
    borderColor: Theme.colors.border,
    shadowColor: Theme.colors.ch4_Beta_TP10,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  inner: {
    borderRadius: Theme.metrics.borderRadius,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
});

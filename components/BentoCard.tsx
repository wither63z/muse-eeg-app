import React from 'react';
import { View, TouchableOpacity, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Theme } from '@/src/theme/tokens';

export function BentoCard({ children, accent, active, onPress }: { children?: React.ReactNode; accent?: string; active?: boolean; onPress?: () => void }) {
  const color = accent || Theme.colors.border;
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress}>
      <View style={[styles.card, active && { borderColor: color, backgroundColor: color + '0f' }]}>
        {children}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Theme.colors.bg,
    borderColor: Theme.colors.border,
    borderWidth: Theme.metrics.borderWidth,
    borderRadius: Theme.metrics.borderRadius,
    padding: Theme.metrics.padding,
  },
});

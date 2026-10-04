import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '@/constants/Theme';

interface BatteryGaugeProps {
  percent: number | null;
}

export function BatteryGaugeCompact({ percent }: BatteryGaugeProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>ENERGÍA</Text>
      <View style={styles.valueContainer}>
        <Text style={[styles.value, theme.typography]}>
          {percent !== null ? `${percent.toFixed(0)}%` : '--'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    height: 120,
    justifyContent: 'space-between',
  },
  label: {
    color: theme.colors.secondaryText,
    fontSize: 10,
    letterSpacing: 0.5,
  },
  valueContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  value: {
    color: theme.colors.text,
    fontSize: 32,
    fontWeight: '700',
  },
});

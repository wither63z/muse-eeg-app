import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useMuseStore } from '@/store/useMuseStore';
import { theme } from '@/constants/Theme';

export function HeartRateCompact() {
  const heartRate = useMuseStore((s) => s.heartRate);
  const status = useMuseStore((s) => s.status);

  return (
    <View style={styles.card}>
      <Text style={styles.label}>PULSO</Text>
      <View style={styles.valueContainer}>
        <Text style={[styles.value, theme.typography]}>
          {heartRate ? `${heartRate} BPM` : '-- BPM'}
        </Text>
        {!heartRate && status === 'streaming' && (
          <Text style={styles.label}>Esperando señal estable</Text>
        )}
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
    fontSize: 28,
    fontWeight: '700',
  },
});

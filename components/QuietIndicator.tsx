import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useMuseStore } from '@/store/useMuseStore';
import { theme } from '@/constants/Theme';

export function QuietIndicator() {
  const accel = useMuseStore((s) => s.telemetry.accel);
  const gyro = useMuseStore((s) => s.telemetry.gyro);

  const isQuiet = React.useMemo(() => {
    if (!accel || !gyro) return null;
    // Accelerometer is decoded in g, not m/s². This is an orientation-independent proxy.
    const a = Math.abs(Math.hypot(accel.x, accel.y, accel.z) - 1);
    const g = Math.abs(gyro.x ?? 0) + Math.abs(gyro.y ?? 0) + Math.abs(gyro.z ?? 0);
    return a < 0.08 && g < 15;
  }, [accel, gyro]);

  return (
    <View style={[styles.card, isQuiet === null ? undefined : isQuiet ? styles.quiet : styles.moving]}>
      <Text style={styles.label}>{isQuiet === null ? 'SIN DATOS' : isQuiet ? 'QUIETO' : 'MOVIMIENTO'}</Text>
      <Text style={styles.sub}>
        {accel ? `${accel.x.toFixed(2)} / ${accel.y.toFixed(2)} / ${(accel.z).toFixed(2)} g` : '--'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    height: 90,
    justifyContent: 'space-between',
  },
  quiet: { borderColor: '#32D74B' },
  moving: { borderColor: theme.colors.simulator },
  label: {
    color: theme.colors.text,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    fontVariant: ['tabular-nums'],
  },
  sub: {
    color: theme.colors.secondaryText,
    fontSize: 10,
    fontVariant: ['tabular-nums'],
  },
});

import React, { useEffect, memo } from 'react';
import { View, Text, StyleSheet, LayoutChangeEvent } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { BandPowerFrame, EegChannel, BandMap } from '@/types/muse';
import { BAND_NAMES } from '@/types/muse';
import { theme } from '@/constants/Theme';

interface BandBarsProps {
  frame: BandPowerFrame | null;
  channel: EegChannel | 'avg';
  mode: 'absolute' | 'relative';
}

interface BandValues {
  name: typeof BAND_NAMES[number];
  value: number;
  displayValue: string;
}

function getBandValues(frame: BandPowerFrame, channel: EegChannel | 'avg', mode: 'absolute' | 'relative'): BandValues[] {
  let values: BandMap<number>;

  if (channel === 'avg') {
    const result: BandMap<number> = { delta: 0, theta: 0, alpha: 0, beta: 0, gamma: 0 };
    for (const band of BAND_NAMES) {
      if (mode === 'relative') {
        let sum = 0;
        for (const ch of ['TP9', 'AF7', 'AF8', 'TP10'] as EegChannel[]) {
          sum += frame.relative[ch][band];
        }
        result[band] = sum / 4;
      } else {
        let sumLinear = 0;
        for (const ch of ['TP9', 'AF7', 'AF8', 'TP10'] as EegChannel[]) {
          const logVal = frame.absoluteLog[ch][band];
          sumLinear += Math.pow(10, logVal);
        }
        const avgLinear = sumLinear / 4;
        result[band] = Math.log10(Math.max(avgLinear, 1e-12));
      }
    }
    values = result;
  } else {
    values = mode === 'relative' ? frame.relative[channel] : frame.absoluteLog[channel];
  }

  return BAND_NAMES.map((name) => ({
    name,
    value: values[name],
    displayValue: formatBandValue(values[name], mode),
  }));
}

function formatBandValue(value: number, mode: 'absolute' | 'relative'): string {
  if (mode === 'relative') {
    return `${(value * 100).toFixed(1)}%`;
  }
  // Absolute: log10 scale, show as is
  return value.toFixed(2);
}

function BandBar({ item, mode }: { item: BandValues; mode: 'absolute' | 'relative' }) {
  const animatedWidth = useSharedValue(0);
  const color = theme.colors.bands[item.name];
  const borderRadius = theme.borderRadius.card;

  // Normaliza para visualización: relativo 0-1, absoluto mapeado a porcentaje visual
  const fillRatio = mode === 'relative'
    ? Math.max(0, Math.min(1, item.value))
    : Math.max(0, Math.min(1, ((item.value + 2) / 4)));

  useEffect(() => {
    animatedWidth.value = withTiming(fillRatio, { duration: 120 });
  }, [fillRatio, animatedWidth]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: `${animatedWidth.value * 100}%`,
  }));

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        <Text style={styles.name}>{item.name.toUpperCase()}</Text>
        <Text style={styles.value}>{item.displayValue}</Text>
      </View>
      <View style={styles.barTrack}>
        <Animated.View style={[styles.barFill, { backgroundColor: color }, animatedStyle]} />
      </View>
    </View>
  );
}

const MemoizedBandBar = memo(BandBar);

export function BandBars({ frame, channel, mode }: BandBarsProps) {
  if (!frame) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Sin datos de bandas</Text>
      </View>
    );
  }

  const items = getBandValues(frame, channel, mode);

  return (
    <View style={styles.container}>
      {items.map((item) => (
        <MemoizedBandBar key={item.name} item={item} mode={mode} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: theme.spacing.sm,
  },
  name: {
    color: theme.colors.text,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    flex: 1,
  },
  value: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  barTrack: {
    height: 4,
    backgroundColor: theme.colors.border,
    borderRadius: theme.borderRadius.sm,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: theme.borderRadius.sm,
  },
  emptyContainer: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: theme.colors.secondaryText,
    fontSize: 14,
  },
});

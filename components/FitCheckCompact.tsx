import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { FitCheck } from '@/types/muse';
import { theme } from '@/constants/Theme';

interface FitCheckCompactProps {
  fit: FitCheck;
  headbandOn: boolean;
}

const BAND_COLORS = {
  TP9: theme.colors.bands.delta,
  AF7: theme.colors.bands.theta,
  AF8: theme.colors.bands.alpha,
  TP10: theme.colors.bands.beta,
} as const;

export function FitCheckCompact({ fit, headbandOn }: FitCheckCompactProps) {
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {(['TP9', 'AF7', 'AF8', 'TP10'] as const).map((ch) => {
          const level = fit[ch];
          // 0 good (green), 1 fair (orange), 2 poor (red)
          const statusColor = level === 0 ? '#22c55e' : level === 1 ? '#f59e0b' : '#ef4444';
          const opacity = headbandOn ? 1 : 0.3;

          return (
            <View key={ch} style={styles.electrodeWrapper}>
              <View
                style={[
                  styles.electrode,
                  {
                    backgroundColor: statusColor,
                    opacity,
                  },
                ]}
              >
                <View style={[styles.indicator, { backgroundColor: BAND_COLORS[ch] }]} />
              </View>
              <Text style={styles.label}>{ch}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: theme.spacing.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  electrodeWrapper: {
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  electrode: {
    width: 40,
    height: 40,
    borderRadius: theme.borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  label: {
    color: theme.colors.secondaryText,
    fontSize: 10,
    fontWeight: '700',
  },
});

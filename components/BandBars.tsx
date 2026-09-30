import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BandPowerFrame, EegChannel, BandMap } from '@/types/muse';
import { BAND_NAMES } from '@/types/muse';

interface BandBarsProps {
  frame: BandPowerFrame | null;
  channel: EegChannel | 'avg';
  mode: 'absolute' | 'relative';
}

const BAND_COLORS: Record<string, string> = {
  delta: '#8b5cf6',
  theta: '#3b82f6',
  alpha: '#22c55e',
  beta: '#f59e0b',
  gamma: '#ef4444',
};

const BAND_LABELS: Record<string, string> = {
  delta: 'δ',
  theta: 'θ',
  alpha: 'α',
  beta: 'β',
  gamma: 'γ',
};

export function BandBars({ frame, channel, mode }: BandBarsProps) {
  if (!frame) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Sin datos de bandas</Text>
      </View>
    );
  }

  const values = getValues(frame, channel, mode);

  return (
    <View style={styles.container}>
      {BAND_NAMES.map((band) => {
        const value = values[band];
        const height = mode === 'relative'
          ? value * 100
          : Math.max(0, Math.min(100, ((value + 2) / 4) * 100));

        return (
          <View key={band} style={styles.barContainer}>
            <Text style={styles.valueText}>{value.toFixed(2)}</Text>
            <View style={styles.barBackground}>
              <View
                style={[
                  styles.barFill,
                  { height: `${height}%`, backgroundColor: BAND_COLORS[band] },
                ]}
              />
            </View>
            <Text style={styles.bandLabel}>{BAND_LABELS[band]}</Text>
          </View>
        );
      })}
    </View>
  );
}

function getValues(
  frame: BandPowerFrame,
  channel: EegChannel | 'avg',
  mode: 'absolute' | 'relative',
): BandMap<number> {
  if (channel === 'avg') {
    // Promediar en potencia lineal, luego log para absolute
    const result: BandMap<number> = { delta: 0, theta: 0, alpha: 0, beta: 0, gamma: 0 };
    for (const band of BAND_NAMES) {
      if (mode === 'relative') {
        let sum = 0;
        for (const ch of ['TP9', 'AF7', 'AF8', 'TP10'] as EegChannel[]) {
          sum += frame.relative[ch][band];
        }
        result[band] = sum / 4;
      } else {
        // Promedio en potencia lineal
        let sumLinear = 0;
        for (const ch of ['TP9', 'AF7', 'AF8', 'TP10'] as EegChannel[]) {
          const logVal = frame.absoluteLog[ch][band];
          sumLinear += Math.pow(10, logVal);
        }
        const avgLinear = sumLinear / 4;
        result[band] = Math.log10(Math.max(avgLinear, 1e-12));
      }
    }
    return result;
  }

  if (mode === 'relative') {
    return frame.relative[channel];
  }
  return frame.absoluteLog[channel];
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: 200,
    paddingHorizontal: 16,
  },
  emptyContainer: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: '#64748b',
    fontSize: 14,
  },
  barContainer: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  valueText: {
    color: '#f1f5f9',
    fontSize: 11,
    marginBottom: 4,
  },
  barBackground: {
    flex: 1,
    width: '100%',
    backgroundColor: '#1e293b',
    borderRadius: 4,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  barFill: {
    width: '100%',
    borderRadius: 4,
  },
  bandLabel: {
    color: '#94a3b8',
    fontSize: 16,
    marginTop: 6,
  },
});

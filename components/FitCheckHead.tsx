import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { FitCheck } from '@/types/muse';

interface FitCheckHeadProps {
  fit: FitCheck;
  headbandOn: boolean;
}

const CHANNEL_POSITIONS = {
  AF7: { top: '20%', left: '25%' },
  AF8: { top: '20%', right: '25%' },
  TP9: { bottom: '20%', left: '25%' },
  TP10: { bottom: '20%', right: '25%' },
} as const;

const FIT_COLORS = ['#22c55e', '#f59e0b', '#ef4444'] as const;

export function FitCheckHead({ fit, headbandOn }: FitCheckHeadProps) {
  return (
    <View style={styles.container}>
      <View style={styles.headContainer}>
        {/* Círculo de la cabeza */}
        <View style={[styles.headCircle, !headbandOn && styles.headCircleOff]} />

        {/* Electrodos */}
        {Object.entries(CHANNEL_POSITIONS).map(([ch, pos]) => {
          const level = fit[ch as keyof FitCheck];
          return (
            <View
              key={ch}
              style={[
                styles.electrode,
                pos,
                { backgroundColor: FIT_COLORS[level] },
                !headbandOn && styles.electrodeOff,
              ]}
            >
              <Text style={styles.electrodeLabel}>{ch}</Text>
            </View>
          );
        })}
      </View>

      {!headbandOn && (
        <Text style={styles.warningText}>Diadema no colocada</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    padding: 12,
  },
  headContainer: {
    width: 160,
    height: 160,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headCircle: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#334155',
    borderWidth: 2,
    borderColor: '#475569',
  },
  headCircleOff: {
    borderColor: '#64748b',
    backgroundColor: '#1e293b',
  },
  electrode: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  electrodeOff: {
    opacity: 0.4,
  },
  electrodeLabel: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  warningText: {
    color: '#ef4444',
    fontSize: 12,
    marginTop: 8,
  },
});

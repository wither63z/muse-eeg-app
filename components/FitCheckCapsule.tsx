import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { FitCheck } from '@/types/muse';
import { theme } from '@/constants/Theme';

interface FitCheckCapsuleProps {
  fit: FitCheck;
  headbandOn: boolean;
}

const CHANNEL_STATES = {
  TP9: { dot: '#FF7B7B', text: '#FF7B7B', label: 'TP9' },
  AF7: { dot: '#FFD180', text: '#FFD180', label: 'AF7' },
  AF8: { dot: '#A8E6CF', text: '#A8E6CF', label: 'AF8' },
  TP10: { dot: '#AEEFFF', text: '#AEEFFF', label: 'TP10' },
} as const;

export function FitCheckCapsule({ fit, headbandOn }: FitCheckCapsuleProps) {
  return (
    <View style={styles.grid}>
      {(['TP9', 'AF7', 'AF8', 'TP10'] as const).map((ch) => {
        const cfg = CHANNEL_STATES[ch];
        const isConnected = headbandOn;
        const dotColor = isConnected ? cfg.dot : '#8B949E';
        const textColor = isConnected ? cfg.text : '#8B949E';

        return (
          <View key={ch} style={styles.capsule}>
            <View style={[styles.dot, { backgroundColor: dotColor }]} />
            <Text style={[styles.channelName, { color: textColor }]}>{cfg.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
    justifyContent: 'space-between',
  },
  capsule: {
    width: '48%',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#21262D',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  channelName: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});

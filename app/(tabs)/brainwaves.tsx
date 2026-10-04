import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { BandBars } from '@/components/BandBars';
import { useMuseStore } from '@/store/useMuseStore';
import { EegChannel } from '@/types/muse';
import { theme } from '@/constants/Theme';
import { BentoCard } from '@/components/BentoCard';

const CHANNELS: (EegChannel | 'avg')[] = ['TP9', 'AF7', 'AF8', 'TP10', 'avg'];

export default function BrainwavesScreen() {
  const bands = useMuseStore((s) => s.bands);
  const [channel, setChannel] = useState<EegChannel | 'avg'>('avg');
  const [mode, setMode] = useState<'absolute' | 'relative'>('relative');
  const isSimulating = useMuseStore((s) => s.isSimulating);

  return (
    <View style={styles.container}>
      {isSimulating && (
        <View style={styles.simBanner}>
          <Text style={styles.simText}>MODO SIMULADOR</Text>
        </View>
      )}
      <View style={styles.controls}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.controlRow}>
          <Text style={styles.controlLabel}>Canal:</Text>
          {CHANNELS.map((ch) => (
            <BentoCard
              key={ch}
              active={channel === ch}
              accent={channel === ch ? theme.colors.bands.beta : theme.colors.border}
              onPress={() => setChannel(ch)}
            >
              <Text style={[styles.chipText, channel === ch && styles.chipTextActive]}>
                {ch === 'avg' ? 'Promedio' : ch}
              </Text>
            </BentoCard>
          ))}
        </ScrollView>

        <View style={styles.controlRow}>
          <Text style={styles.controlLabel}>Modo:</Text>
          <TouchableOpacity
            style={[styles.chip, mode === 'relative' && styles.chipActive]}
            onPress={() => setMode('relative')}
          >
            <Text style={[styles.chipText, mode === 'relative' && styles.chipTextActive]}>
              Relativo
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.chip, mode === 'absolute' && styles.chipActive]}
            onPress={() => setMode('absolute')}
          >
            <Text style={[styles.chipText, mode === 'absolute' && styles.chipTextActive]}>
              Absoluto
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.barsContainer}>
        <BandBars frame={bands} channel={channel} mode={mode} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  controls: {
    padding: 8,
    backgroundColor: theme.colors.surface,
  },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  controlLabel: {
    color: theme.colors.secondaryText,
    fontSize: 12,
    marginRight: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: theme.colors.border,
    borderRadius: 16,
    marginRight: 6,
  },
  chipActive: {
    backgroundColor: theme.colors.bands.beta,
  },
  chipText: {
    color: theme.colors.secondaryText,
    fontSize: 12,
  },
  chipTextActive: {
    color: theme.colors.text,
    fontVariant: ['tabular-nums'] as const,
  },
  barsContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  simBanner: {
    backgroundColor: theme.colors.simulator,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  simText: {
    color: theme.colors.background,
    fontWeight: '700',
    fontSize: 12,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
});
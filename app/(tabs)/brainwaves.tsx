import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { BandBars } from '@/components/BandBars';
import { useMuseStore } from '@/store/useMuseStore';
import { EegChannel } from '@/types/muse';

const CHANNELS: (EegChannel | 'avg')[] = ['TP9', 'AF7', 'AF8', 'TP10', 'avg'];

export default function BrainwavesScreen() {
  const bands = useMuseStore((s) => s.bands);
  const [channel, setChannel] = useState<EegChannel | 'avg'>('avg');
  const [mode, setMode] = useState<'absolute' | 'relative'>('relative');

  return (
    <View style={styles.container}>
      <View style={styles.controls}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.controlRow}>
          <Text style={styles.controlLabel}>Canal:</Text>
          {CHANNELS.map((ch) => (
            <TouchableOpacity
              key={ch}
              style={[styles.chip, channel === ch && styles.chipActive]}
              onPress={() => setChannel(ch)}
            >
              <Text style={[styles.chipText, channel === ch && styles.chipTextActive]}>
                {ch === 'avg' ? 'Promedio' : ch}
              </Text>
            </TouchableOpacity>
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
    backgroundColor: '#0f172a',
  },
  controls: {
    padding: 8,
    backgroundColor: '#1e293b',
  },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  controlLabel: {
    color: '#94a3b8',
    fontSize: 12,
    marginRight: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#334155',
    borderRadius: 16,
    marginRight: 6,
  },
  chipActive: {
    backgroundColor: '#3b82f6',
  },
  chipText: {
    color: '#94a3b8',
    fontSize: 12,
  },
  chipTextActive: {
    color: '#fff',
  },
  barsContainer: {
    flex: 1,
    justifyContent: 'center',
  },
});

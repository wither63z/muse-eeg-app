import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { EegScope } from '@/components/EegScope';
import { useMuseStore } from '@/store/useMuseStore';

const WINDOWS = [2, 5, 10] as const;
const UV_PER_DIVS = [50, 100, 200, 500] as const;

export default function RawEegScreen() {
  const status = useMuseStore((s) => s.status);
  const [windowSeconds, setWindowSeconds] = useState<2 | 5 | 10>(5);
  const [uvPerDiv, setUvPerDiv] = useState<50 | 100 | 200 | 500>(100);
  const [paused, setPaused] = useState(false);
  const [displayHighPass, setDisplayHighPass] = useState(true);

  const isStreaming = status === 'streaming';

  return (
    <View style={styles.container}>
      <View style={styles.controls}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.controlRow}>
          <Text style={styles.controlLabel}>Ventana:</Text>
          {WINDOWS.map((w) => (
            <TouchableOpacity
              key={w}
              style={[styles.chip, windowSeconds === w && styles.chipActive]}
              onPress={() => setWindowSeconds(w)}
            >
              <Text style={[styles.chipText, windowSeconds === w && styles.chipTextActive]}>
                {w}s
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.controlRow}>
          <Text style={styles.controlLabel}>µV/div:</Text>
          {UV_PER_DIVS.map((uv) => (
            <TouchableOpacity
              key={uv}
              style={[styles.chip, uvPerDiv === uv && styles.chipActive]}
              onPress={() => setUvPerDiv(uv)}
            >
              <Text style={[styles.chipText, uvPerDiv === uv && styles.chipTextActive]}>
                {uv}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.controlRow}>
          <TouchableOpacity
            style={[styles.chip, paused && styles.chipActive]}
            onPress={() => setPaused(!paused)}
          >
            <Text style={[styles.chipText, paused && styles.chipTextActive]}>
              {paused ? 'Reanudar' : 'Pausa'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.chip, displayHighPass && styles.chipActive]}
            onPress={() => setDisplayHighPass(!displayHighPass)}
          >
            <Text style={[styles.chipText, displayHighPass && styles.chipTextActive]}>
              HP: {displayHighPass ? 'ON' : 'OFF'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.scopeContainer}>
        {isStreaming ? (
          <EegScope
            windowSeconds={windowSeconds}
            uvPerDiv={uvPerDiv}
            paused={paused}
            displayHighPass={displayHighPass}
          />
        ) : (
          <View style={styles.noSignal}>
            <Text style={styles.noSignalText}>Sin señal</Text>
          </View>
        )}
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
  scopeContainer: {
    flex: 1,
  },
  noSignal: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noSignalText: {
    color: '#64748b',
    fontSize: 18,
  },
});

import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { EegScope } from '@/components/EegScope';
import { useMuseStore } from '@/store/useMuseStore';
import { recorder } from '@/recording/recorder';
import { theme } from '@/constants/Theme';
import { BentoCard } from '@/components/BentoCard';
import { GlowButton } from '@/components/GlowButton';
import { QuietIndicator } from '@/components/QuietIndicator';

const WINDOWS = [2, 5, 10] as const;
const UV_PER_DIVS = [50, 100] as const;

export default function RawEegScreen() {
  const status = useMuseStore((s) => s.status);
  const [windowSeconds, setWindowSeconds] = useState<2 | 5 | 10>(5);
  const [uvPerDiv, setUvPerDiv] = useState<50 | 100>(100);
  const [paused, setPaused] = useState(false);
  const [displayHighPass, setDisplayHighPass] = useState(true);
  const isStreaming = status === 'streaming';
  const isRecording = useMuseStore((s) => s.isRecording);

  return (
    <View style={styles.screen}>
      {/* Fila de controles estilo píldora */}
      <View style={styles.controlRow}>
        <View style={styles.pillGroup}>
          <Text style={styles.groupLabel}>Ventana</Text>
          <View style={styles.pillRow}>
            {WINDOWS.map((w) => (
              <TouchableOpacity
                key={w}
                style={[styles.pill, windowSeconds === w && styles.pillActive]}
                onPress={() => setWindowSeconds(w)}
              >
                <Text style={[styles.pillText, windowSeconds === w && styles.pillTextActive]}>
                  {w}s
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.pillGroup}>
          <Text style={styles.groupLabel}>Escala</Text>
          <View style={styles.pillRow}>
            {UV_PER_DIVS.map((uv) => (
              <TouchableOpacity
                key={uv}
                style={[styles.pill, uvPerDiv === uv && styles.pillActive]}
                onPress={() => setUvPerDiv(uv)}
              >
                <Text style={[styles.pillText, uvPerDiv === uv && styles.pillTextActive]}>
                  {uv}µV
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity
          style={[styles.pill, paused && styles.pillActive]}
          onPress={() => setPaused(!paused)}
        >
          <Text style={[styles.pillText, paused && styles.pillTextActive]}>
            {paused ? 'Reanudar' : 'Pausa'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Lienzo continuo 70% */}
      <View style={styles.canvasContainer}>
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

      {/* HUD inferior compact */}
      <View style={styles.hud}>
        <QuietIndicator />
        <View style={styles.hudLeft}>
          {isRecording && (
            <>
              <Text style={styles.recDot}>●</Text>
              <Text style={styles.recTimer}>01:23</Text>
            </>
          )}
        </View>
        <View style={styles.hudRight}>
          <TouchableOpacity style={styles.microButton} onPress={() => recorder.addMarker('M1')}>
            <Text style={styles.microButtonText}>+M1</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.microButton} onPress={() => recorder.addMarker('M2')}>
            <Text style={styles.microButtonText}>+M2</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  pillGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  groupLabel: {
    color: theme.colors.secondaryText,
    fontSize: 11,
    fontWeight: '600',
    marginRight: theme.spacing.xs,
  },
  pillRow: {
    flexDirection: 'row',
  },
  pill: {
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 6,
  },
  pillActive: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.text,
  },
  pillText: {
    color: theme.colors.secondaryText,
    fontSize: 12,
    fontWeight: '600',
  },
  pillTextActive: {
    color: theme.colors.text,
    fontWeight: '700',
  },
  canvasContainer: {
    flex: 1,
  },
  noSignal: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noSignalText: {
    color: theme.colors.secondaryText,
    fontSize: 18,
  },
  hud: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  hudLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  recDot: {
    color: '#FF453A',
    fontSize: 14,
    fontWeight: '700',
  },
  recTimer: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '600',
    fontVariant: ['tabular-nums'] as const,
  },
  hudRight: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  microButton: {
    borderRadius: 16,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  microButtonText: {
    color: theme.colors.text,
    fontSize: 11,
    fontWeight: '600',
  },
});

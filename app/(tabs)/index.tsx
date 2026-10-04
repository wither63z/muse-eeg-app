import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useMuseStore } from '@/store/useMuseStore';
import { useShallow } from 'zustand/react/shallow';
import { theme } from '@/constants/Theme';
import { ConnectionButtonsRow } from '@/components/ConnectionButtonsRow';
import { BatteryGaugeCompact } from '@/components/BatteryGaugeCompact';
import { HeartRateCompact } from '@/components/HeartRateCompact';
import { dspEngine } from '@/dsp/dspEngine';
import { BentoCard } from '@/components/BentoCard';

const ELECTRODE_MAP = {
  TP9: { color: theme.colors.electrodes.tp9, label: 'TP9' },
  AF7: { color: theme.colors.electrodes.af7, label: 'AF7' },
  AF8: { color: theme.colors.electrodes.af8, label: 'AF8' },
  TP10: { color: theme.colors.electrodes.tp10, label: 'TP10' },
} as const;

export default function DashboardScreen() {
  const [showStats, setShowStats] = useState(false);
  const { telemetry, fit, headbandOn, stats } = useMuseStore(
    useShallow((s) => ({
      telemetry: s.telemetry,
      fit: s.fit,
      headbandOn: s.headbandOn,
      stats: s.stats,
    })),
  );
  const quality = dspEngine.getFitDiagnostics();
  const fitLabel = (ch: 'TP9'|'AF7'|'AF8'|'TP10') => {
    if (!quality || quality[ch].reason === 'Esperando datos') return 'Esperando';
    return fit[ch] === 0 ? 'Buena' : fit[ch] === 1 ? 'Regular' : 'Mala';
  };

  const totalDropped = Object.values(stats.packetsDropped).reduce((a, b) => a + b, 0);

  return (
    <View style={styles.container}>
      <ConnectionButtonsRow />

      <View style={styles.grid}>
        {(['TP9', 'AF7', 'AF8', 'TP10'] as const).map((ch) => (
          <BentoCard key={ch} accent={ELECTRODE_MAP[ch].color} active={fit[ch] === 0}>
            <View style={styles.electrodeContent}>
              <View style={[styles.dot, { backgroundColor: ELECTRODE_MAP[ch].color }]} />
              <Text style={styles.electrodeLabel}>{ELECTRODE_MAP[ch].label}</Text>
            </View>
            <Text style={styles.fitPercent}>{fitLabel(ch)}</Text>
          </BentoCard>
        ))}
      </View>

      <View style={styles.telemetryRow}>
        <BentoCard>
          <BatteryGaugeCompact percent={telemetry.battery?.percent ?? null} />
        </BentoCard>
        <BentoCard>
          <HeartRateCompact />
        </BentoCard>
      </View>

      <BentoCard onPress={() => setShowStats(!showStats)} active={showStats}>
        <View style={styles.statsHeader}>
          <Text style={styles.statsTitle}>Estadísticas Avanzadas</Text>
          <Text style={styles.statsArrow}>{showStats ? '▲' : '▼'}</Text>
        </View>
        {showStats && (
          <View style={styles.statsContent}>
            <Text style={[styles.statText, theme.typography]}>
              Tasa efectiva: {stats.effectiveRateHz?.toFixed(1) ?? '--'} Hz
            </Text>
            <Text style={[styles.statText, theme.typography]}>
              Paquetes recibidos: {Object.values(stats.packetsReceived).reduce((a, b) => a + b, 0)}
            </Text>
            <Text style={[styles.statText, theme.typography]}>
              Paquetes perdidos: {totalDropped}
            </Text>
            <Text style={styles.statText}>Calidad EEG estimada; no mide impedancia ni porcentaje de contacto.</Text>
            {quality && (['TP9', 'AF7', 'AF8', 'TP10'] as const).map((ch) => (
              <Text key={ch} style={[styles.statText, theme.typography]}>
                {ch}: {quality[ch].reason} · σ {quality[ch].sigmaUv.toFixed(1)} µV · red {(quality[ch].mainsRatio * 100).toFixed(0)}% · saturación {(quality[ch].clippedFraction * 100).toFixed(0)}%
              </Text>
            ))}
          </View>
        )}
      </BentoCard>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: theme.spacing.md,
    gap: theme.spacing.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  electrodeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  electrodeLabel: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  telemetryRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  statsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statsTitle: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  statsArrow: {
    color: theme.colors.secondaryText,
    fontSize: 12,
  },
  statsContent: {
    gap: theme.spacing.xs,
    marginTop: theme.spacing.sm,
  },
  fitPercent: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.secondaryText,
    fontVariant: ['tabular-nums'] as const,
    marginTop: theme.spacing.xs,
  },
  statText: {
    color: theme.colors.secondaryText,
    fontSize: 12,
  },
});

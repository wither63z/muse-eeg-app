import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { ConnectionCard } from '@/components/ConnectionCard';
import { BatteryGauge } from '@/components/BatteryGauge';
import { FitCheckHead } from '@/components/FitCheckHead';
import { useMuseStore } from '@/store/useMuseStore';
import { useShallow } from 'zustand/react/shallow';

export default function DashboardScreen() {
  const { status, device, telemetry, fit, headbandOn, stats } = useMuseStore(
    useShallow((s) => ({
      status: s.status,
      device: s.device,
      telemetry: s.telemetry,
      fit: s.fit,
      headbandOn: s.headbandOn,
      stats: s.stats,
    })),
  );

  const totalDropped = Object.values(stats.packetsDropped).reduce((a, b) => a + b, 0);

  return (
    <ScrollView style={styles.container}>
      <ConnectionCard />

      <View style={styles.section}>
        <BatteryGauge
          percent={telemetry.battery?.percent ?? null}
          voltageMv={telemetry.battery?.voltageMv ?? null}
        />
      </View>

      <View style={styles.section}>
        <FitCheckHead fit={fit} headbandOn={headbandOn} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Estadísticas</Text>
        <Text style={styles.statText}>
          Tasa efectiva: {stats.effectiveRateHz?.toFixed(1) ?? '—'} Hz
        </Text>
        <Text style={styles.statText}>
          Paquetes perdidos: {totalDropped}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  section: {
    marginHorizontal: 8,
    marginVertical: 4,
  },
  sectionTitle: {
    color: '#f1f5f9',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  statText: {
    color: '#94a3b8',
    fontSize: 13,
    marginVertical: 2,
  },
});

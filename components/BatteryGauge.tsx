import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface BatteryGaugeProps {
  percent: number | null;
  voltageMv: number | null;
}

export function BatteryGauge({ percent, voltageMv }: BatteryGaugeProps) {
  if (percent === null) {
    return (
      <View style={styles.container}>
        <Text style={styles.label}>Batería: —</Text>
      </View>
    );
  }

  const color = percent < 20 ? '#ef4444' : percent < 50 ? '#f59e0b' : '#22c55e';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.label}>Batería</Text>
        <Text style={styles.value}>{percent.toFixed(0)}%</Text>
      </View>
      <View style={styles.barBackground}>
        <View
          style={[
            styles.barFill,
            { width: `${percent}%`, backgroundColor: color },
          ]}
        />
      </View>
      {voltageMv !== null && (
        <Text style={styles.voltage}>{(voltageMv / 1000).toFixed(2)} V</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 12,
    backgroundColor: '#1e293b',
    borderRadius: 8,
    marginVertical: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  label: {
    color: '#94a3b8',
    fontSize: 14,
  },
  value: {
    color: '#f1f5f9',
    fontSize: 14,
    fontWeight: '600',
  },
  barBackground: {
    height: 8,
    backgroundColor: '#334155',
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
  voltage: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 4,
  },
});

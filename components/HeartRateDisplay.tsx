import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing
} from 'react-native-reanimated';
import { useMuseStore } from '@/store/useMuseStore';

export function HeartRateDisplay() {
  const heartRate = useMuseStore((s) => s.heartRate);
  const scale = useSharedValue(1);

  useEffect(() => {
    if (heartRate && heartRate > 0) {
      // Calcular duración del latido basado en BPM
      const duration = (60 / heartRate) * 1000;

      scale.value = withRepeat(
        withSequence(
          withTiming(1.2, { duration: duration * 0.2, easing: Easing.out(Easing.quad) }),
          withTiming(1, { duration: duration * 0.8, easing: Easing.inOut(Easing.quad) })
        ),
        -1, // Infinito mientras haya heartRate
        false
      );
    } else {
      scale.value = withTiming(1);
    }
  }, [heartRate, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.label}>Ritmo Cardíaco</Text>
        <Animated.View style={[styles.heartIcon, animatedStyle]}>
          <Text style={styles.heartEmoji}>❤️</Text>
        </Animated.View>
      </View>

      <View style={styles.valueContainer}>
        <Text style={styles.value}>
          {heartRate ? heartRate : '--'}
        </Text>
        <Text style={styles.unit}>BPM</Text>
      </View>

      <Text style={styles.hint}>
        {heartRate
          ? 'Sensor PPG activo (Muse 2)'
          : 'Esperando señal del sensor óptico...'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    marginVertical: 8,
    minHeight: 120,
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '500',
  },
  heartIcon: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heartEmoji: {
    fontSize: 20,
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  value: {
    color: '#f1f5f9',
    fontSize: 48,
    fontWeight: 'bold',
  },
  unit: {
    color: '#ef4444',
    fontSize: 18,
    fontWeight: '600',
  },
  hint: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 8,
  },
});

import React, { useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { Canvas, Path, Skia, SkPath, Group, Line } from '@shopify/react-native-skia';
import { SharedValue, useSharedValue } from 'react-native-reanimated';
import { EegChannel } from '@/types/muse';
import { dspEngine } from '@/dsp/dspEngine';
import { useRafLoop } from '@/hooks/useRafLoop';

interface EegScopeProps {
  windowSeconds: 2 | 5 | 10;
  uvPerDiv: 50 | 100 | 200 | 500;
  paused: boolean;
  displayHighPass: boolean;
}

const EEG_CHANNELS: EegChannel[] = ['TP9', 'AF7', 'AF8', 'TP10'];
const CHANNEL_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444'] as const;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const LANE_HEIGHT = 180;

export function EegScope({ windowSeconds, uvPerDiv, paused, displayHighPass }: EegScopeProps) {
  const path0 = useSharedValue(Skia.Path.Make());
  const path1 = useSharedValue(Skia.Path.Make());
  const path2 = useSharedValue(Skia.Path.Make());
  const path3 = useSharedValue(Skia.Path.Make());
  const paths: SharedValue<SkPath>[] = [path0, path1, path2, path3];

  const bufferRef = useRef<Float32Array>(new Float32Array(windowSeconds * 256));
  const highPassStateRef = useRef<Map<EegChannel, { yPrev: number; xPrev: number }>>(new Map());

  const draw = useCallback(() => {
    const width = SCREEN_WIDTH;

    for (let chIdx = 0; chIdx < 4; chIdx++) {
      const ch = EEG_CHANNELS[chIdx];
      const buf = bufferRef.current;
      const n = dspEngine.getScopeWindow(ch, windowSeconds, buf);

      if (n === 0) continue;

      const path = Skia.Path.Make();
      const samplesPerColumn = Math.max(1, Math.floor(n / width));
      const centerY = LANE_HEIGHT * chIdx + LANE_HEIGHT / 2;
      const divHeight = LANE_HEIGHT / 2;

      for (let col = 0; col < width; col++) {
        const start = col * samplesPerColumn;
        const end = Math.min(start + samplesPerColumn, n);

        let minUv = Infinity;
        let maxUv = -Infinity;

        for (let i = start; i < end; i++) {
          let uv = buf[i];

          if (displayHighPass) {
            const state = highPassStateRef.current.get(ch) || { yPrev: 0, xPrev: 0 };
            const alpha = 0.9879;
            const y = alpha * (state.yPrev + uv - state.xPrev);
            highPassStateRef.current.set(ch, { yPrev: y, xPrev: uv });
            uv = y;
          }

          if (uv < minUv) minUv = uv;
          if (uv > maxUv) maxUv = uv;
        }

        if (minUv === Infinity) continue;

        const yMin = centerY - (minUv / uvPerDiv) * divHeight;
        const yMax = centerY - (maxUv / uvPerDiv) * divHeight;

        const clampedYMin = Math.max(LANE_HEIGHT * chIdx, Math.min(LANE_HEIGHT * (chIdx + 1), yMin));
        const clampedYMax = Math.max(LANE_HEIGHT * chIdx, Math.min(LANE_HEIGHT * (chIdx + 1), yMax));

        path.moveTo(col, clampedYMin);
        path.lineTo(col, clampedYMax);
      }

      paths[chIdx].value = path;
    }
  }, [windowSeconds, uvPerDiv, displayHighPass, paths]);

  useRafLoop(draw, !paused);

  return (
    <View style={styles.container}>
      <Canvas style={styles.canvas}>
        {/* Líneas de cero por canal */}
        {EEG_CHANNELS.map((ch, i) => (
          <Group key={`grid-${ch}`}>
            <Line
              p1={{ x: 0, y: LANE_HEIGHT * i + LANE_HEIGHT / 2 }}
              p2={{ x: SCREEN_WIDTH, y: LANE_HEIGHT * i + LANE_HEIGHT / 2 }}
              color="#334155"
              strokeWidth={1}
            />
          </Group>
        ))}
        {/* Formas de onda */}
        {EEG_CHANNELS.map((ch, i) => (
          <Group key={`wave-${ch}`}>
            <Path
              path={paths[i]}
              color={CHANNEL_COLORS[i]}
              strokeWidth={1.5}
              style="stroke"
            />
          </Group>
        ))}
      </Canvas>
      {/* Etiquetas de canal superpuestas */}
      {EEG_CHANNELS.map((ch, i) => (
        <View
          key={`label-${ch}`}
          style={[styles.channelLabel, { top: LANE_HEIGHT * i + 4 }]}
          pointerEvents="none"
        >
          <Text style={[styles.channelLabelText, { color: CHANNEL_COLORS[i] }]}>
            {ch}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  canvas: {
    flex: 1,
  },
  channelLabel: {
    position: 'absolute',
    left: 4,
  },
  channelLabelText: {
    fontSize: 12,
    fontWeight: '600',
  },
});

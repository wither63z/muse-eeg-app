import React, { useRef, useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, Platform } from 'react-native';
import { SharedValue, useSharedValue } from 'react-native-reanimated';
import { EegChannel } from '@/types/muse';
import { dspEngine } from '@/dsp/dspEngine';
import { useRafLoop } from '@/hooks/useRafLoop';

// Importación condicional por plataforma
let SkiaComponents: any;
let CanvasRenderer: any;

if (Platform.OS === 'web') {
  // En web, usamos canvas 2D nativo
  SkiaComponents = null;
  CanvasRenderer = null;
} else {
  // En nativo, usamos Skia
  const skia = require('@shopify/react-native-skia');
  SkiaComponents = {
    Canvas: skia.Canvas,
    Path: skia.Path,
    Skia: skia.Skia,
    Group: skia.Group,
    Line: skia.Line,
  };
  CanvasRenderer = skia.Canvas;
}

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
  const isWeb = Platform.OS === 'web';

  // Para web, usamos ref de canvas
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bufferRef = useRef<Float32Array>(new Float32Array(windowSeconds * 256));
  const highPassStateRef = useRef<Map<EegChannel, { yPrev: number; xPrev: number }>>(new Map());

  // Para nativo, usamos shared values de Skia
  let path0, path1, path2, path3;
  let paths: SharedValue<any>[] = [];

  if (!isWeb) {
    path0 = useSharedValue(SkiaComponents.Skia.Path.Make());
    path1 = useSharedValue(SkiaComponents.Skia.Path.Make());
    path2 = useSharedValue(SkiaComponents.Skia.Path.Make());
    path3 = useSharedValue(SkiaComponents.Skia.Path.Make());
    paths = [path0, path1, path2, path3];
  }

  const draw = useCallback(() => {
    if (isWeb && canvasRef.current) {
      // Renderizar con canvas 2D
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (let chIdx = 0; chIdx < 4; chIdx++) {
        const ch = EEG_CHANNELS[chIdx];
        const buf = bufferRef.current;
        const n = dspEngine.getScopeWindow(ch, windowSeconds, buf);

        if (n === 0) continue;

        const samplesPerColumn = Math.max(1, Math.floor(n / canvas.width));
        const centerY = LANE_HEIGHT * chIdx + LANE_HEIGHT / 2;
        const divHeight = LANE_HEIGHT / 2;

        ctx.strokeStyle = CHANNEL_COLORS[chIdx];
        ctx.lineWidth = 1.5;
        ctx.beginPath();

        let first = true;
        for (let col = 0; col < canvas.width; col++) {
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

          if (first) {
            ctx.moveTo(col, clampedYMin);
            first = false;
          } else {
            ctx.lineTo(col, clampedYMin);
          }
          ctx.lineTo(col, clampedYMax);
        }
        ctx.stroke();
      }
    } else if (!isWeb) {
      // Renderizar con Skia
      const width = SCREEN_WIDTH;

      for (let chIdx = 0; chIdx < 4; chIdx++) {
        const ch = EEG_CHANNELS[chIdx];
        const buf = bufferRef.current;
        const n = dspEngine.getScopeWindow(ch, windowSeconds, buf);

        if (n === 0) continue;

        const path = SkiaComponents.Skia.Path.Make();
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
    }
  }, [windowSeconds, uvPerDiv, displayHighPass, isWeb]);

  useRafLoop(draw, !paused);

  if (isWeb) {
    // Renderizar canvas 2D
    return (
      <View style={styles.container}>
        <canvas
          ref={canvasRef}
          width={SCREEN_WIDTH}
          height={LANE_HEIGHT * 4}
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
        />
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

  // Renderizar Skia
  return (
    <View style={styles.container}>
      <CanvasRenderer style={styles.canvas}>
        {/* Líneas de cero por canal */}
        {EEG_CHANNELS.map((ch, i) => (
          <SkiaComponents.Group key={`grid-${ch}`}>
            <SkiaComponents.Line
              p1={{ x: 0, y: LANE_HEIGHT * i + LANE_HEIGHT / 2 }}
              p2={{ x: SCREEN_WIDTH, y: LANE_HEIGHT * i + LANE_HEIGHT / 2 }}
              color="#334155"
              strokeWidth={1}
            />
          </SkiaComponents.Group>
        ))}
        {/* Formas de onda */}
        {EEG_CHANNELS.map((ch, i) => (
          <SkiaComponents.Group key={`wave-${ch}`}>
            <SkiaComponents.Path
              path={paths[i]}
              color={CHANNEL_COLORS[i]}
              strokeWidth={1.5}
              style="stroke"
            />
          </SkiaComponents.Group>
        ))}
      </CanvasRenderer>
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

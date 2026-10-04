import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import { RecordingRow } from '@/components/RecordingRow';
import { useMuseStore } from '@/store/useMuseStore';
import { recorder } from '@/recording/recorder';
import * as recordingsRepo from '@/recording/recordingsRepo';
import { theme } from '@/constants/Theme';
import { GlowButton } from '@/components/GlowButton';

export default function RecordingsScreen() {
  const status = useMuseStore((s) => s.status);
  const isRecording = useMuseStore((s) => s.isRecording);
  const recordingStartedAtMs = useMuseStore((s) => s.recordingStartedAtMs);
  const recordingRowCount = useMuseStore((s) => s.recordingRowCount);
  const recordings = useMuseStore((s) => s.recordings);

  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!isRecording || !recordingStartedAtMs) { setElapsed(0); return; }
    const interval = setInterval(() => { setElapsed(Date.now() - recordingStartedAtMs); }, 1000);
    return () => clearInterval(interval);
  }, [isRecording, recordingStartedAtMs]);

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    const parts: string[] = [];
    if (h > 0) parts.push(String(h));
    parts.push(String(m).padStart(2, '0'));
    parts.push(String(s).padStart(2, '0'));
    return parts.join(':');
  };

  const handleStart = async () => await recorder.start();
  const handleStop = async () => {
    await recorder.stop();
    const list = await recordingsRepo.list();
    useMuseStore.getState().setRecordings(list);
  };
  const handleMarker = (label: string) => recorder.addMarker(label);
  const handleShare = async (id: string) => await recordingsRepo.share(id);
  const handleDelete = async (id: string) => {
    await recordingsRepo.deleteRecording(id);
    const list = await recordingsRepo.list();
    useMuseStore.getState().setRecordings(list);
  };

  const isStreaming = status === 'streaming';

  return (
    <View style={styles.screen}>
      {/* Módulo de control superior */}
      <GlowButton
        label={isRecording ? `REC ${formatTime(elapsed)}` : 'Iniciar Grabación'}
        onPress={isRecording ? handleStop : handleStart}
        accent={isRecording ? theme.colors.simulator : theme.colors.bands.beta}
        style={{ opacity: (!isStreaming && !isRecording) ? 0.5 : 1, width: '100%' }}
      />

      {/* Marcadores horizontales */}
      <View style={styles.markersRow}>
        {['+M1', '+M2', '+M3'].map((label) => (
          <GlowButton
            key={label}
            label={label}
            onPress={() => handleMarker(label.slice(1))}
            accent={theme.colors.bands.gamma}
            style={{ flex: 1, marginHorizontal: theme.spacing.xs }}
          />
        ))}
      </View>

      {/* Divisor + Título */}
      <View style={styles.divider} />
      <Text style={styles.sectionTitle}>HISTORIAL DE SESIONES LOCALES</Text>

      {/* Lista */}
      <FlatList
        data={recordings}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <RecordingRow meta={item} onShare={handleShare} onDelete={handleDelete} />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No hay grabaciones todavía</Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingHorizontal: 16,
    paddingTop: theme.spacing.lg,
  },
  mainButton: {
    borderRadius: theme.borderRadius.pillMain,
    paddingVertical: 20,
    paddingHorizontal: 24,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    shadowColor: theme.colors.bands.gamma,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  mainButtonRecording: {
    backgroundColor: 'rgba(191,90,242,0.10)',
    borderColor: '#BF5AF2',
  },
  mainButtonText: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 1,
    fontVariant: ['tabular-nums'] as const,
  },
  markersRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: theme.spacing.md,
  },
  markerPill: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.borderRadius.card,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    marginHorizontal: theme.spacing.xs,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  markerText: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: '600',
    fontVariant: ['tabular-nums'] as const,
  },
  divider: {
    height: 1,
    backgroundColor: '#21262D',
    marginVertical: theme.spacing.md,
  },
  sectionTitle: {
    color: theme.colors.secondaryText,
    fontSize: 11,
    letterSpacing: 1.5,
    fontWeight: '600',
    marginBottom: theme.spacing.md,
  },
  listContent: {
    paddingBottom: theme.spacing.lg,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
  },
  emptyText: {
    color: theme.colors.secondaryText,
    fontSize: 14,
  },
});

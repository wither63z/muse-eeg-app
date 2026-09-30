import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import { RecordingRow } from '@/components/RecordingRow';
import { useMuseStore } from '@/store/useMuseStore';
import { recorder } from '@/recording/recorder';
import * as recordingsRepo from '@/recording/recordingsRepo';

export default function RecordingsScreen() {
  const status = useMuseStore((s) => s.status);
  const isRecording = useMuseStore((s) => s.isRecording);
  const recordingStartedAtMs = useMuseStore((s) => s.recordingStartedAtMs);
  const recordingRowCount = useMuseStore((s) => s.recordingRowCount);
  const recordings = useMuseStore((s) => s.recordings);

  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!isRecording || !recordingStartedAtMs) return;

    const interval = setInterval(() => {
      setElapsed(Date.now() - recordingStartedAtMs);
    }, 1000);

    return () => clearInterval(interval);
  }, [isRecording, recordingStartedAtMs]);

  const handleStart = async () => {
    await recorder.start();
  };

  const handleStop = async () => {
    await recorder.stop();
    const list = await recordingsRepo.list();
    useMuseStore.getState().setRecordings(list);
  };

  const handleMarker = () => {
    recorder.addMarker();
  };

  const handleShare = async (id: string) => {
    await recordingsRepo.share(id);
  };

  const handleDelete = async (id: string) => {
    await recordingsRepo.deleteRecording(id);
    const list = await recordingsRepo.list();
    useMuseStore.getState().setRecordings(list);
  };

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  };

  const isStreaming = status === 'streaming';

  return (
    <View style={styles.container}>
      <View style={styles.controls}>
        <TouchableOpacity
          style={[
            styles.recordButton,
            !isStreaming && styles.recordButtonDisabled,
            isRecording && styles.recordButtonStop,
          ]}
          onPress={isRecording ? handleStop : handleStart}
          disabled={!isStreaming && !isRecording}
        >
          <Text style={styles.recordButtonText}>
            {isRecording ? 'Detener' : 'Grabar'}
          </Text>
        </TouchableOpacity>

        {isRecording && (
          <View style={styles.recordingInfo}>
            <View style={styles.recordingDot} />
            <Text style={styles.recordingTime}>{formatTime(elapsed)}</Text>
            <Text style={styles.recordingRows}>{recordingRowCount} filas</Text>
          </View>
        )}

        {isRecording && (
          <TouchableOpacity style={styles.markerButton} onPress={handleMarker}>
            <Text style={styles.markerButtonText}>Marcador</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={recordings}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <RecordingRow
            meta={item}
            onShare={handleShare}
            onDelete={handleDelete}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No hay grabaciones todavía</Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#1e293b',
    gap: 12,
  },
  recordButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#ef4444',
    borderRadius: 8,
  },
  recordButtonDisabled: {
    backgroundColor: '#475569',
  },
  recordButtonStop: {
    backgroundColor: '#f59e0b',
  },
  recordButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  recordingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ef4444',
  },
  recordingTime: {
    color: '#f1f5f9',
    fontSize: 14,
    fontWeight: '600',
  },
  recordingRows: {
    color: '#94a3b8',
    fontSize: 12,
  },
  markerButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#3b82f6',
    borderRadius: 6,
  },
  markerButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  listContent: {
    padding: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    color: '#64748b',
    fontSize: 14,
  },
});

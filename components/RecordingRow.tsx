import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { RecordingMeta } from '@/types/muse';

interface RecordingRowProps {
  meta: RecordingMeta;
  onShare: (id: string) => void;
  onDelete: (id: string) => void;
}

export function RecordingRow({ meta, onShare, onDelete }: RecordingRowProps) {
  const handleDelete = () => {
    Alert.alert(
      'Eliminar grabación',
      `¿Eliminar ${meta.fileName}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => onDelete(meta.id) },
      ],
    );
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${String(secs).padStart(2, '0')}`;
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (ms: number) => {
    const d = new Date(ms);
    return d.toLocaleString();
  };

  return (
    <View style={styles.container}>
      <View style={styles.info}>
        <Text style={styles.fileName}>{meta.fileName}</Text>
        <Text style={styles.meta}>
          {formatDate(meta.startedAtMs)} · {formatDuration(meta.durationMs)} · {formatSize(meta.sizeBytes)}
        </Text>
        <Text style={styles.rows}>{meta.rowCount} filas</Text>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity style={styles.button} onPress={() => onShare(meta.id)}>
          <Text style={styles.buttonText}>Compartir</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, styles.deleteButton]} onPress={handleDelete}>
          <Text style={styles.buttonText}>Eliminar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#1e293b',
    borderRadius: 8,
    marginVertical: 4,
  },
  info: {
    flex: 1,
  },
  fileName: {
    color: '#f1f5f9',
    fontSize: 14,
    fontWeight: '600',
  },
  meta: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2,
  },
  rows: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  button: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#3b82f6',
    borderRadius: 6,
  },
  deleteButton: {
    backgroundColor: '#ef4444',
  },
  buttonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});

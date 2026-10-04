import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Platform } from 'react-native';
import { RecordingMeta } from '@/types/muse';
import { theme } from '@/constants/Theme';

interface RecordingRowProps {
  meta: RecordingMeta;
  onShare: (id: string) => void;
  onDelete: (id: string) => void | Promise<void>;
}

export function RecordingRow({ meta, onShare, onDelete }: RecordingRowProps) {
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const performDelete = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await onDelete(meta.id);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'No se pudo eliminar la grabación');
    } finally {
      setDeleting(false);
    }
  };
  const handleDelete = () => {
    if (deleting) return;
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(`¿Eliminar ${meta.fileName}?`)) {
        void performDelete();
      }
      return;
    }
    Alert.alert(
      'Eliminar grabación',
      `¿Eliminar ${meta.fileName}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => { void performDelete(); } },
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

  return (
    <View style={styles.container}>
      <View style={styles.info}>
        <Text style={styles.fileName}>{meta.fileName.replace('mindMonitor_', '').replace('.csv', '')}</Text>
        <Text style={[styles.meta, theme.typography]}>
          {formatDuration(meta.durationMs)} · {formatSize(meta.sizeBytes)}
        </Text>
        {deleteError && <Text style={{ color: theme.colors.error }}>{deleteError}</Text>}
      </View>
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => onShare(meta.id)}
          activeOpacity={0.7}
        >
          <Text style={styles.iconText}>📤</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.iconButton, styles.deleteButton]}
          onPress={handleDelete}
          disabled={deleting}
          accessibilityLabel="Eliminar grabación"
          activeOpacity={0.7}
        >
          <Text style={styles.iconText}>🗑️</Text>
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
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.sm,
    shadowColor: theme.colors.bands.gamma,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
  info: {
    flex: 1,
  },
  fileName: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: theme.spacing.xs,
  },
  meta: {
    color: theme.colors.secondaryText,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  actions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  iconButton: {
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.border,
  },
  deleteButton: {
    borderColor: theme.colors.error,
    borderWidth: 1,
    backgroundColor: 'rgba(248, 81, 73, 0.1)',
  },
  iconText: {
    fontSize: 18,
  },
});

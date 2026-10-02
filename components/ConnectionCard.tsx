import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { useMuseStore } from '@/store/useMuseStore';
import { museClient } from '@/ble/museClient';
import { ensureBlePermissions } from '@/ble/permissions';

const STATUS_LABELS: Record<string, string> = {
  idle: 'Desconectado',
  'requesting-permissions': 'Solicitando permisos...',
  scanning: 'Buscando dispositivos...',
  connecting: 'Conectando...',
  discovering: 'Descubriendo servicios...',
  streaming: 'Conectado',
  disconnecting: 'Desconectando...',
  error: 'Error',
};

export function ConnectionCard() {
  const status = useMuseStore((s) => s.status);
  const discovered = useMuseStore((s) => s.discovered);
  const device = useMuseStore((s) => s.device);
  const errorMessage = useMuseStore((s) => s.errorMessage);

  const handleScan = async () => {
    const granted = await ensureBlePermissions();
    if (granted) {
      await museClient.scan();
    }
  };

  const handleConnect = async (deviceId: string) => {
    await museClient.connect(deviceId);
  };

  const handleDisconnect = async () => {
    await museClient.disconnect();
  };

  const handleConnectHardware = async () => {
    // Si es web, intenta conectar vía WebBluetooth
    await museClient.connect('web-ble');
  };

  const isScanning = status === 'scanning';
  const isStreaming = status === 'streaming';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Conexión Muse</Text>
        <View style={[styles.statusBadge, isStreaming && styles.statusBadgeActive]}>
          <Text style={styles.statusText}>{STATUS_LABELS[status] || 'Desconocido'}</Text>
        </View>
      </View>
      {errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}
      <View style={styles.buttonRow}>
        {!isStreaming ? (
          Platform.OS === 'web' ? (
            <>
              <TouchableOpacity style={styles.button} onPress={handleConnectHardware}>
                <Text style={styles.buttonText}>Conectar Muse Real</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.button} onPress={() => museClient.connectSimulator()}>
                <Text style={styles.buttonText}>Simulador</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={[styles.button, isScanning && styles.buttonDisabled]}
              onPress={handleScan}
              disabled={isScanning}
            >
              {isScanning ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Buscar</Text>
              )}
            </TouchableOpacity>
          )
        ) : (
          <TouchableOpacity
            style={[styles.button, styles.buttonDisconnect]}
            onPress={handleDisconnect}
          >
            <Text style={styles.buttonText}>Desconectar</Text>
          </TouchableOpacity>
        )}
      </View>

      {device && (
        <Text style={styles.deviceText}>
          Conectado: {device.name}
        </Text>
      )}

      {discovered.length > 0 && !isStreaming && (
        <View style={styles.deviceList}>
          <Text style={styles.sectionTitle}>Dispositivos encontrados:</Text>
          {discovered.map((d) => (
            <TouchableOpacity
              key={d.id}
              style={styles.deviceItem}
              onPress={() => handleConnect(d.id)}
            >
              <Text style={styles.deviceName}>{d.name}</Text>
              <Text style={styles.deviceRssi}>{d.rssi} dBm</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    margin: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    color: '#f1f5f9',
    fontSize: 18,
    fontWeight: '700',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#334155',
  },
  statusBadgeActive: {
    backgroundColor: '#22c55e',
  },
  statusText: {
    color: '#f1f5f9',
    fontSize: 12,
    fontWeight: '600',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 13,
    marginBottom: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  button: {
    flex: 1,
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#475569',
  },
  buttonDisconnect: {
    backgroundColor: '#ef4444',
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  deviceText: {
    color: '#94a3b8',
    fontSize: 13,
    marginTop: 8,
  },
  deviceList: {
    marginTop: 12,
  },
  sectionTitle: {
    color: '#94a3b8',
    fontSize: 13,
    marginBottom: 8,
  },
  deviceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#0f172a',
    borderRadius: 8,
    marginBottom: 6,
  },
  deviceName: {
    color: '#f1f5f9',
    fontSize: 14,
  },
  deviceRssi: {
    color: '#64748b',
    fontSize: 12,
  },
});

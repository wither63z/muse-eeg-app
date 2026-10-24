import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { useMuseStore } from '@/store/useMuseStore';
import { museClient } from '@/ble/museClient';
import { ensureBlePermissions } from '@/ble/permissions';
import { theme } from '@/constants/Theme';

export function ConnectionButtonsRow() {
  const status = useMuseStore((s) => s.status);
  const errorMessage = useMuseStore((s) => s.errorMessage);
  const [eegOnly, setEegOnly] = useState(false);
  const busy = ['scanning', 'connecting', 'discovering', 'disconnecting'].includes(status);
  const isSimulating = useMuseStore((s) => s.isSimulating);
  const discovered = useMuseStore((s) => s.discovered);
  const isStreaming = status === 'streaming' && !isSimulating;

  const handleReal = async () => {
    const granted = await ensureBlePermissions();
    if (!granted) return;
    await museClient.scan();
  };

  const handleSelectAndConnect = async (id: string) => {
    await museClient.connect(id, eegOnly ? 'eeg' : 'full');
  };

  const handleSim = async () => {
    if (isSimulating) {
      await museClient.disconnect();
    } else {
      await museClient.connectSimulator();
    }
  };

  const handleDisconnect = async () => {
    await museClient.disconnect();
  };

  if (isStreaming || isSimulating) {
    return (
      <View style={styles.container}>
        <Text style={styles.deviceName}>
          {isSimulating
            ? 'Simulación: estos datos no vienen de una diadema'
            : 'Recibiendo datos de los cuatro canales EEG'}
        </Text>
        {errorMessage && <Text style={styles.deviceName}>{errorMessage}</Text>}
        <TouchableOpacity
          style={[styles.button, styles.disconnectButton]}
          onPress={handleDisconnect}
        >
          <Text style={styles.buttonText}>Desconectar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.deviceName}>
        {status === 'discovering'
          ? 'Esperando datos de los cuatro canales…'
          : status === 'connecting'
            ? 'Conectando…'
            : status === 'scanning'
              ? 'Buscando Muse…'
              : 'Muse desconectado'}
      </Text>
      {errorMessage && <Text style={{ color: theme.colors.secondaryText }}>{errorMessage}</Text>}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Switch
          value={eegOnly}
          onValueChange={setEegOnly}
          disabled={busy}
          accessibilityLabel="Solo EEG, sin pulso"
        />
        <Text style={styles.deviceName}>Solo EEG, sin pulso</Text>
      </View>
      <TouchableOpacity
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel="Buscar Muse"
        style={styles.button}
        onPress={handleReal}
      >
        <Text style={styles.buttonText}>{busy ? 'Espera un momento…' : 'Buscar Muse'}</Text>
      </TouchableOpacity>
      {discovered.length > 0 && (
        <View style={styles.list}>
          {discovered.map((d) => (
            <TouchableOpacity
              key={d.id}
              disabled={busy}
              style={styles.deviceRow}
              onPress={() => handleSelectAndConnect(d.id)}
            >
              <Text style={styles.deviceName}>{d.name}</Text>
              <Text style={styles.deviceRssi}>{d.rssi === null ? '' : `${d.rssi} dBm`}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      <TouchableOpacity
        style={[styles.button, isSimulating && styles.simActiveButton]}
        onPress={handleSim}
        disabled={busy}
      >
        <Text style={[styles.buttonText, isSimulating && styles.simActiveText]}>
          Modo Simulador
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  list: {
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  deviceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.card,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  deviceName: {
    color: theme.colors.text,
    fontWeight: '600',
    fontSize: 14,
  },
  deviceRssi: {
    color: theme.colors.secondaryText,
    fontSize: 12,
  },
  button: {
    paddingVertical: theme.spacing.lg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
  },
  simActiveButton: {
    borderColor: theme.colors.simulator,
    backgroundColor: '#33240a',
  },
  disconnectButton: {
    backgroundColor: '#331a1a',
    borderColor: '#ef4444',
  },
  buttonText: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  simActiveText: {
    color: theme.colors.simulator,
  },
});

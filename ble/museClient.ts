import type { Device, BleManager as BleManagerType } from 'react-native-ble-plx';
import { Platform } from 'react-native';
import { MuseDeviceInfo, ConnectionStatus, EegChannel } from '@/types/muse';
import { MUSE_SERVICE_UUID, MUSE_CHAR, EEG_CHAR_BY_CHANNEL, MUSE_NAME_PREFIX, MUSE_PRESET, MUSE_PPG_PRESET, ACCEL_G_PER_LSB, GYRO_DPS_PER_LSB } from '@/constants/muse';
import { getBleManager } from './bleManager';
import { museSimulator } from './museSimulator';
import { base64ToBytes, decodeEegPacket, decodeBattery, decodeMotion, decodePpg } from './museDecoder';
import { encodeCommand, CMD_HALT, CMD_RESUME } from './museCommands';
import { dspEngine } from '@/dsp/dspEngine';
import { recorder } from '@/recording/recorder';
import { useMuseStore } from '@/store/useMuseStore';
import { museWebBluetooth } from './museWebBluetooth';

const EEG_CHANNELS: EegChannel[] = ['TP9', 'AF7', 'AF8', 'TP10'];

/**
 * Cliente BLE para la diadema Muse.
 *
 * Rutas separadas:
 * - Web: usa navigator.bluetooth (Web Bluetooth API) vía museWebBluetooth.
 * - Nativo: usa react-native-ble-plx vía getBleManager().
 *
 * En ambos casos los datos fluyen al mismo dspEngine y store.
 */
class MuseClient {
  private ppgEnabled = false;
  private ppgPacketCount = 0;
  // Ruta nativa
  private nativeDevice: Device | null = null;
  private isNativeConnected: boolean = false;
  // Ruta web
  private isWebConnected: boolean = false;
  // Simulador
  private lastAccelMs: number = 0;
  private lastGyroMs: number = 0;

  // ─── Escaneo ────────────────────────────────────────────────────────

  async scan(timeoutMs: number = 10000): Promise<void> {
    if (Platform.OS === 'web') {
      await this.scanWeb();
      return;
    }
    await this.scanNative(timeoutMs);
  }

  private async scanNative(timeoutMs: number = 10000): Promise<void> {
    const manager = getBleManager();
    if (!manager) return;

    const store = useMuseStore.getState();
    store.setStatus('scanning');

    const state: string = await manager.state();
    if (state !== 'PoweredOn') {
      store.setStatus('error', 'Bluetooth está apagado. Actívalo para buscar dispositivos.');
      return;
    }

    return new Promise((resolve) => {
      const discovered = new Map<string, MuseDeviceInfo>();

      manager.startDeviceScan(null, { allowDuplicates: false }, (error: any, device: any) => {
        if (error) {
          console.error('Scan error:', error);
          return;
        }

        if (device && device.name && device.name.startsWith(MUSE_NAME_PREFIX)) {
          discovered.set(device.id, {
            id: device.id,
            name: device.name,
            rssi: device.rssi,
          });
          store.setDiscovered(Array.from(discovered.values()));
        }
      });

      setTimeout(() => {
        manager.stopDeviceScan();
        store.setStatus('idle');
        resolve();
      }, timeoutMs);
    });
  }

  private async scanWeb(): Promise<void> {
    const store = useMuseStore.getState();
    store.setStatus('scanning');

    try {
      // Web Bluetooth abre el diálogo de selección del navegador.
      // No hay "timeout" real: el usuario elige o cancela.
      await museWebBluetooth.scan();

      // Si llegó aquí, el usuario seleccionó un dispositivo.
      store.setDiscovered([{
        id: 'web-ble',
        name: 'Muse (Web Bluetooth)',
        rssi: 0,
      }]);
      store.setStatus('idle');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'No se seleccionó ningún dispositivo';
      console.log('[Web BLE] Scan cancelled:', msg);
      store.setStatus('idle');
    }
  }

  stopScan(): void {
    if (Platform.OS === 'web') return; // Web Bluetooth no tiene "stop scan"
    getBleManager()?.stopDeviceScan();
  }

  // ─── Conexión ───────────────────────────────────────────────────────

  async connect(deviceId?: string): Promise<void> {
    if (Platform.OS === 'web') {
      await this.connectWeb();
      return;
    }
    if (!deviceId) return;
    await this.connectNative(deviceId);
  }

  private async connectNative(deviceId: string): Promise<void> {
    const store = useMuseStore.getState();
    const manager = getBleManager();
    if (!manager) return;

    try {
      store.setStatus('connecting');

      const state: string = await manager.state();
      if (state !== 'PoweredOn') {
        store.setStatus('error', 'Bluetooth está apagado. Actívalo para conectar.');
        return;
      }

      const device = await manager.connectToDevice(deviceId, { requestMTU: 247 });
      this.nativeDevice = device;
      await device.discoverAllServicesAndCharacteristics();
      const characteristics = await device.characteristicsForService(MUSE_SERVICE_UUID);
      this.ppgEnabled = characteristics.some((c: { uuid: string }) => c.uuid.toLowerCase() === MUSE_CHAR.PPG);
      this.ppgPacketCount = 0;
      console.info(`[Muse] PPG infrarrojo ${this.ppgEnabled ? 'disponible; preset p50' : 'no disponible; preset p21'}`);

      if (!this.nativeDevice) {
        throw new Error('Failed to connect to device');
      }

      store.setStatus('discovering');

      // Muse 2: enviar secuencia de inicio ANTES de suscribirse
      // h (halt) → p21 (preset) → d (resume)
      await this.sendStartCommandsNative();

      // Suscribir a características EEG, batería, accel, gyro
      await this.subscribeToCharacteristicsNative();

      // Estado streaming
      this.isNativeConnected = true;
      store.setStatus('streaming');
      store.setDevice({
        id: this.nativeDevice.id,
        name: this.nativeDevice.name || 'Muse',
        rssi: this.nativeDevice.rssi,
      });

      // Iniciar DSP
      dspEngine.start();

      // Listener de desconexión
      if (this.nativeDevice) {
        this.nativeDevice.onDisconnected(async (error) => {
          this.isNativeConnected = false;
          dspEngine.stop();

          if (useMuseStore.getState().isRecording) {
            try {
              await recorder.stop();
            } catch {
              // Si ya está detenido, ignorar
            }
          }

          store.reset();
          store.setStatus('idle');
          if (error) {
            console.error('Disconnected with error:', error);
          }
        });
      }

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error de conexión';
      store.setStatus('error', message);
      throw error;
    }
  }

  private async connectWeb(): Promise<void> {
    const store = useMuseStore.getState();
    store.setStatus('connecting');

    try {
      // Conectar al dispositivo seleccionado en scanWeb
      await museWebBluetooth.connect();
      this.isWebConnected = true;
      this.ppgEnabled = await museWebBluetooth.hasCharacteristic(MUSE_CHAR.PPG);
      this.ppgPacketCount = 0;
      console.info(`[Muse] PPG infrarrojo ${this.ppgEnabled ? 'disponible; preset p50' : 'no disponible; preset p21'}`);

      store.setStatus('discovering');

      // Muse 2: enviar secuencia de inicio ANTES de suscribirse
      await this.sendStartCommandsWeb();

      // Suscribir a características EEG, batería, accel, gyro
      await this.subscribeToCharacteristicsWeb();

      // Estado streaming
      store.setStatus('streaming');
      store.setDevice({
        id: 'web-ble',
        name: 'Muse (Web Bluetooth)',
        rssi: 0,
      });

      // Iniciar DSP
      dspEngine.start();

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error de conexión';
      store.setStatus('error', message);
      throw error;
    }
  }

  // ─── Desconexión ────────────────────────────────────────────────────

  async disconnect(): Promise<void> {
    const store = useMuseStore.getState();

    // Simulator
    if (museSimulator.isRunning()) {
      if (store.isRecording) await recorder.stop();
      museSimulator.stop();
      dspEngine.stop();
      store.reset();
      store.setStatus('idle');
      return;
    }

    // Web
    if (this.isWebConnected) {
      store.setStatus('disconnecting');
      dspEngine.stop();

      if (store.isRecording) {
        try {
          await recorder.stop();
        } catch {
          // ignorar
        }
      }

      if (museWebBluetooth.device) {
        // Web Bluetooth no tiene cancelConnection; se cierra desde el lado del dispositivo
        museWebBluetooth.device.gatt?.disconnect();
      }
      this.isWebConnected = false;
      store.reset();
      store.setStatus('idle');
      return;
    }

    // Nativo
    if (!this.nativeDevice || !this.isNativeConnected) return;

    store.setStatus('disconnecting');
    dspEngine.stop();

    if (store.isRecording) {
      try {
        await recorder.stop();
      } catch {
        // ignorar
      }
    }

    try {
      await this.nativeDevice.cancelConnection();
    } catch (error) {
      console.error('Disconnect error:', error);
    }

    this.isNativeConnected = false;
    this.nativeDevice = null;
    store.reset();
    store.setStatus('idle');
  }

  // ─── Suscripciones nativas ──────────────────────────────────────────

  private async subscribeToCharacteristicsNative(): Promise<void> {
    if (!this.nativeDevice) return;

    const store = useMuseStore.getState();

    // Suscribir a canales EEG
    for (const channel of EEG_CHANNELS) {
      const charUuid = EEG_CHAR_BY_CHANNEL[channel];
      console.log(`[BLE] Subscribing to EEG channel ${channel}: ${charUuid}`);
      this.nativeDevice.monitorCharacteristicForService(
        MUSE_SERVICE_UUID,
        charUuid,
        (error, characteristic) => {
          if (error) {
            console.error(`Error monitoring ${channel}:`, error);
            return;
          }
          if (characteristic?.value) {
            try {
              const bytes = base64ToBytes(characteristic.value);
              const packet = decodeEegPacket(channel, bytes, Date.now());
              dspEngine.pushEeg(packet);
            } catch (e) {
              console.error(`Error decoding ${channel}:`, e);
            }
          }
        },
      );
    }

    // Suscribir a batería
    this.nativeDevice.monitorCharacteristicForService(
      MUSE_SERVICE_UUID,
      MUSE_CHAR.BATTERY,
      (error, characteristic) => {
        if (error) {
          console.error('Error monitoring battery:', error);
          return;
        }
        if (characteristic?.value) {
          try {
            const bytes = base64ToBytes(characteristic.value);
            const reading = decodeBattery(bytes);
            store.setBattery(reading);
          } catch (e) {
            console.error('Error decoding battery:', e);
          }
        }
      },
    );

    // Suscribir a accel
    this.nativeDevice.monitorCharacteristicForService(
      MUSE_SERVICE_UUID,
      MUSE_CHAR.ACCEL,
      (error, characteristic) => {
        if (error) {
          console.error('Error monitoring accel:', error);
          return;
        }
        if (characteristic?.value) {
          const now = Date.now();
          if (now - this.lastAccelMs < 100) return;
          this.lastAccelMs = now;
          try {
            const bytes = base64ToBytes(characteristic.value);
            const packet = decodeMotion(bytes, ACCEL_G_PER_LSB);
            store.setMotion(packet.samples[0], null, now);
          } catch (e) {
            console.error('Error decoding accel:', e);
          }
        }
      },
    );

    // Suscribir a gyro
    this.nativeDevice.monitorCharacteristicForService(
      MUSE_SERVICE_UUID,
      MUSE_CHAR.GYRO,
      (error, characteristic) => {
        if (error) {
          console.error('Error monitoring gyro:', error);
          return;
        }
        if (characteristic?.value) {
          const now = Date.now();
          if (now - this.lastGyroMs < 100) return;
          this.lastGyroMs = now;
          try {
            const bytes = base64ToBytes(characteristic.value);
            const packet = decodeMotion(bytes, GYRO_DPS_PER_LSB);
            store.setMotion(null, packet.samples[0], now);
          } catch (e) {
            console.error('Error decoding gyro:', e);
          }
        }
      },
    );

    // Suscribir a PPG (ritmo cardíaco)
    if (this.ppgEnabled) this.nativeDevice.monitorCharacteristicForService(
      MUSE_SERVICE_UUID,
      MUSE_CHAR.PPG,
      (error, characteristic) => {
        if (error) {
          console.error('Error monitoring ppg:', error);
          return;
        }
        if (characteristic?.value) {
          try {
            const bytes = base64ToBytes(characteristic.value);
            const packet = decodePpg(bytes, Date.now());
            this.ppgPacketCount++;
            if (this.ppgPacketCount === 1) console.info('[Muse] Primer paquete PPG infrarrojo recibido: 6 muestras');
            dspEngine.pushPpg(packet);
          } catch (e) {
            console.error('Error decoding ppg:', e);
          }
        }
      },
    );
  }

  // ─── Suscripciones web ──────────────────────────────────────────────

  private async subscribeToCharacteristicsWeb(): Promise<void> {
    const store = useMuseStore.getState();

    // Suscribir a canales EEG
    for (const channel of EEG_CHANNELS) {
      const charUuid = EEG_CHAR_BY_CHANNEL[channel];
      console.log(`[Web BLE] Subscribing to EEG channel ${channel}: ${charUuid}`);
      await museWebBluetooth.monitor(charUuid, (error, value) => {
        if (error || !value) {
          console.error(`Error monitoring ${channel}:`, error);
          return;
        }
        try {
          const bytes = base64ToBytes(value);
          const packet = decodeEegPacket(channel, bytes, Date.now());
          dspEngine.pushEeg(packet);
        } catch (e) {
          console.error(`Error decoding ${channel}:`, e);
        }
      });
    }

    // Suscribir a batería
    await museWebBluetooth.monitor(MUSE_CHAR.BATTERY, (error, value) => {
      if (error || !value) return;
      try {
        const bytes = base64ToBytes(value);
        const reading = decodeBattery(bytes);
        store.setBattery(reading);
      } catch (e) {
        console.error('Error decoding battery:', e);
      }
    });

    // Suscribir a accel
    await museWebBluetooth.monitor(MUSE_CHAR.ACCEL, (error, value) => {
      if (error || !value) return;
      const now = Date.now();
      if (now - this.lastAccelMs < 100) return;
      this.lastAccelMs = now;
      try {
        const bytes = base64ToBytes(value);
        const packet = decodeMotion(bytes, ACCEL_G_PER_LSB);
        store.setMotion(packet.samples[0], null, now);
      } catch (e) {
        console.error('Error decoding accel:', e);
      }
    });

    // Suscribir a gyro
    await museWebBluetooth.monitor(MUSE_CHAR.GYRO, (error, value) => {
      if (error || !value) return;
      const now = Date.now();
      if (now - this.lastGyroMs < 100) return;
      this.lastGyroMs = now;
      try {
        const bytes = base64ToBytes(value);
        const packet = decodeMotion(bytes, GYRO_DPS_PER_LSB);
        store.setMotion(null, packet.samples[0], now);
      } catch (e) {
        console.error('Error decoding gyro:', e);
      }
    });

    // Suscribir a PPG (ritmo cardíaco)
    if (this.ppgEnabled) await museWebBluetooth.monitor(MUSE_CHAR.PPG, (error, value) => {
      if (error || !value) return;
      try {
        const bytes = base64ToBytes(value);
        const packet = decodePpg(bytes, Date.now());
        this.ppgPacketCount++;
            if (this.ppgPacketCount === 1) console.info('[Muse] Primer paquete PPG infrarrojo recibido: 6 muestras');
            dspEngine.pushPpg(packet);
      } catch (e) {
        console.error('Error decoding ppg:', e);
      }
    });
  }

  // ─── Comandos nativos ───────────────────────────────────────────────

  private async sendStartCommandsNative(): Promise<void> {
    if (!this.nativeDevice) return;

    const commands = [CMD_HALT, this.ppgEnabled ? MUSE_PPG_PRESET : MUSE_PRESET, CMD_RESUME];

    for (const cmd of commands) {
      const encoded = encodeCommand(cmd);
      try {
        await this.nativeDevice.writeCharacteristicWithoutResponseForService(
          MUSE_SERVICE_UUID,
          MUSE_CHAR.CONTROL,
          encoded,
        );
      } catch {
        await this.nativeDevice.writeCharacteristicWithResponseForService(
          MUSE_SERVICE_UUID,
          MUSE_CHAR.CONTROL,
          encoded,
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  // ─── Comandos web ───────────────────────────────────────────────────

  private async sendStartCommandsWeb(): Promise<void> {
    const commands = [CMD_HALT, this.ppgEnabled ? MUSE_PPG_PRESET : MUSE_PRESET, CMD_RESUME];

    for (const cmd of commands) {
      const encoded = encodeCommand(cmd);
      const bytes = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
      await museWebBluetooth.write(MUSE_CHAR.CONTROL, bytes);
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  // ─── Simulador ──────────────────────────────────────────────────────

  async connectSimulator(): Promise<void> {
    const store = useMuseStore.getState();
    store.setStatus('streaming');
    store.setSimulating(true);
    dspEngine.start();
    museSimulator.start();
    store.setDevice({ id: 'sim-1', name: 'Muse Simulator', rssi: 0 });
  }
}

export const museClient = new MuseClient();

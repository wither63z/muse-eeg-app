import { Device } from 'react-native-ble-plx';
import { MuseDeviceInfo, ConnectionStatus, EegChannel, AccelerometerPacket, GyroscopePacket } from '@/types/muse';
import { MUSE_SERVICE_UUID, MUSE_CHAR, EEG_CHAR_BY_CHANNEL, MUSE_NAME_PREFIX, MUSE_PRESET, ACCEL_G_PER_LSB, GYRO_DPS_PER_LSB } from '@/constants/muse';
import { getBleManager } from './bleManager';
import { base64ToBytes, decodeEegPacket, decodeBattery, decodeMotion } from './museDecoder';
import { encodeCommand, CMD_HALT, CMD_RESUME } from './museCommands';
import { dspEngine } from '@/dsp/dspEngine';
import { useMuseStore } from '@/store/useMuseStore';

const EEG_CHANNELS: EegChannel[] = ['TP9', 'AF7', 'AF8', 'TP10'];

/**
 * Cliente BLE para la diadema Muse.
 * 
 * Secuencia de connect(deviceId):
 * 1. status = 'connecting'; manager.connectToDevice(deviceId, { requestMTU: 247 })
 * 2. status = 'discovering'; device.discoverAllServicesAndCharacteristics()
 * 3. Suscribir con monitorCharacteristicForDevice a: 4 canales EEG, BATTERY, ACCEL, GYRO
 * 4. Escribir en CONTROL: h → p21 → d, con ~50 ms entre comandos
 * 5. status = 'streaming'; iniciar timers de dspEngine
 * 6. device.onDisconnected(...): detener timers, store.reset(), status = 'idle'
 */
class MuseClient {
  private device: Device | null = null;
  private isConnected: boolean = false;

  async scan(timeoutMs: number = 10000): Promise<void> {
    const store = useMuseStore.getState();
    store.setStatus('scanning');

    const manager = getBleManager();

    return new Promise((resolve) => {
      const discovered = new Map<string, MuseDeviceInfo>();

      manager.startDeviceScan(null, { allowDuplicates: false }, (error, device) => {
        if (error) {
          console.error('Scan error:', error);
          return;
        }

        if (device && device.name?.startsWith(MUSE_NAME_PREFIX)) {
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

  stopScan(): void {
    getBleManager().stopDeviceScan();
  }

  async connect(deviceId: string): Promise<void> {
    const store = useMuseStore.getState();
    const manager = getBleManager();

    try {
      store.setStatus('connecting');

      // Conectar
      this.device = await manager.connectToDevice(deviceId, { requestMTU: 247 });
      await this.device.discoverAllServicesAndCharacteristics();

      store.setStatus('discovering');

      // Suscribir a características
      await this.subscribeToCharacteristics();

      // Enviar comandos de inicio
      await this.sendStartCommands();

      // Estado streaming
      this.isConnected = true;
      store.setStatus('streaming');
      store.setDevice({
        id: this.device.id,
        name: this.device.name || 'Muse',
        rssi: this.device.rssi,
      });

      // Iniciar DSP
      dspEngine.start();

      // Listener de desconexión
      this.device.onDisconnected((error) => {
        this.isConnected = false;
        dspEngine.stop();
        store.reset();
        store.setStatus('idle');
        if (error) {
          console.error('Disconnected with error:', error);
        }
      });

    } catch (error) {
      store.setStatus('error', error instanceof Error ? error.message : 'Error de conexión');
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (!this.device || !this.isConnected) return;

    const store = useMuseStore.getState();
    store.setStatus('disconnecting');

    dspEngine.stop();

    try {
      await this.device.cancelConnection();
    } catch (error) {
      console.error('Disconnect error:', error);
    }

    this.isConnected = false;
    this.device = null;
    store.reset();
    store.setStatus('idle');
  }

  private async subscribeToCharacteristics(): Promise<void> {
    if (!this.device) return;

    const store = useMuseStore.getState();

    // Suscribir a canales EEG
    for (const channel of EEG_CHANNELS) {
      const charUuid = EEG_CHAR_BY_CHANNEL[channel];
      this.device.monitorCharacteristicForDevice(
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
    this.device.monitorCharacteristicForDevice(
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
    this.device.monitorCharacteristicForDevice(
      MUSE_SERVICE_UUID,
      MUSE_CHAR.ACCEL,
      (error, characteristic) => {
        if (error) {
          console.error('Error monitoring accel:', error);
          return;
        }
        if (characteristic?.value) {
          try {
            const bytes = base64ToBytes(characteristic.value);
            const packet = decodeMotion(bytes, ACCEL_G_PER_LSB);
            store.setMotion(packet.samples[0], null, Date.now());
          } catch (e) {
            console.error('Error decoding accel:', e);
          }
        }
      },
    );

    // Suscribir a gyro
    this.device.monitorCharacteristicForDevice(
      MUSE_SERVICE_UUID,
      MUSE_CHAR.GYRO,
      (error, characteristic) => {
        if (error) {
          console.error('Error monitoring gyro:', error);
          return;
        }
        if (characteristic?.value) {
          try {
            const bytes = base64ToBytes(characteristic.value);
            const packet = decodeMotion(bytes, GYRO_DPS_PER_LSB);
            store.setMotion(null, packet.samples[0], Date.now());
          } catch (e) {
            console.error('Error decoding gyro:', e);
          }
        }
      },
    );
  }

  private async sendStartCommands(): Promise<void> {
    if (!this.device) return;

    const commands = [CMD_HALT, MUSE_PRESET, CMD_RESUME];

    for (const cmd of commands) {
      const encoded = encodeCommand(cmd);
      try {
        // Intentar write-without-response primero
        await this.device.writeCharacteristicWithoutResponseForDevice(
          MUSE_SERVICE_UUID,
          MUSE_CHAR.CONTROL,
          encoded,
        );
      } catch {
        // Fallback a write-with-response
        await this.device.writeCharacteristicWithResponseForDevice(
          MUSE_SERVICE_UUID,
          MUSE_CHAR.CONTROL,
          encoded,
        );
      }
      // Esperar 50 ms entre comandos
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
}

export const museClient = new MuseClient();

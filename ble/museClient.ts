import { Platform } from 'react-native';
import type { Device, Subscription } from 'react-native-ble-plx';
import { toByteArray } from 'base64-js';
import { EEG_CHANNELS, EegChannel, MuseDeviceInfo } from '@/types/muse';
import {
  MUSE_SERVICE_UUID,
  MUSE_CHAR,
  EEG_CHAR_BY_CHANNEL,
  ACCEL_G_PER_LSB,
  GYRO_DPS_PER_LSB,
  MUSE_PRESET,
  MUSE_PPG_PRESET,
} from '@/constants/muse';
import { getBleManager } from './bleManager';
import { museSimulator } from './museSimulator';
import {
  base64ToBytes,
  decodeEegPacket,
  decodeBattery,
  decodeMotion,
  decodePpg,
} from './museDecoder';
import { encodeCommand } from './museCommands';
import { museWebBluetooth } from './museWebBluetooth';
import { dspEngine } from '@/dsp/dspEngine';
import { recorder } from '@/recording/recorder';
import { useMuseStore } from '@/store/useMuseStore';

type Transport = {
  info: MuseDeviceInfo;
  available: string[];
  subscribe(uuid: string, callback: (value: string) => void): Promise<void>;
  write(command: string): Promise<void>;
  close(): Promise<void>;
};
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
async function deadline<T>(promise: Promise<T>, ms = 10000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('Muse no respondió a tiempo. Vuelve a conectar.')),
          ms,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** One shared acquisition path; platform adapters only own GATT operations. */
export class MuseClient {
  private transport: Transport | null = null;
  private generation = 0;
  private scanTimer: ReturnType<typeof setTimeout> | null = null;
  private monitorTimer: ReturnType<typeof setInterval> | null = null;
  private connecting = false;
  private scanDone: (() => void) | null = null;
  private lastMotion = { accel: 0, gyro: 0 };
  private counts = new Map<EegChannel, { sequence: number; count: number; time: number }>();

  async scan(timeoutMs = 10000): Promise<void> {
    const store = useMuseStore.getState();
    if (
      this.connecting ||
      this.transport ||
      museSimulator.isRunning() ||
      useMuseStore.getState().isRecording
    )
      return;
    this.stopScan();
    store.setDiscovered([]);
    store.setStatus('scanning');
    try {
      if (Platform.OS === 'web') {
        await museWebBluetooth.scan();
        const device = museWebBluetooth.device;
        if (device)
          store.setDiscovered([{ id: device.id, name: device.name || 'Muse', rssi: null }]);
        store.setStatus('idle');
        return;
      }
      const manager = getBleManager();
      if (!manager || (await manager.state()) !== 'PoweredOn')
        throw new Error('Activa Bluetooth y sus permisos para buscar Muse.');
      await new Promise<void>((resolve, reject) => {
        this.scanDone = resolve;
        const found = new Map<string, MuseDeviceInfo>();
        this.scanTimer = setTimeout(() => {
          this.stopScan();
          store.setStatus(
            'idle',
            found.size ? 'Elige Muse en la lista.' : 'No se encontraron dispositivos.',
          );
          resolve();
        }, timeoutMs);
        manager.startDeviceScan(null, { allowDuplicates: false }, (error, device) => {
          if (error) {
            store.setStatus('error', error.message);
            this.stopScan();
            return;
          }
          if (device?.name?.startsWith('Muse')) {
            found.set(device.id, { id: device.id, name: device.name, rssi: device.rssi });
            store.setDiscovered([...found.values()]);
          }
        });
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo buscar Muse.';
      const cancelled =
        error instanceof Error && ['NotFoundError', 'AbortError'].includes(error.name);
      store.setStatus(
        cancelled ? 'idle' : 'error',
        cancelled ? 'No se seleccionó una diadema.' : message,
      );
    }
  }
  stopScan(): void {
    if (this.scanTimer) clearTimeout(this.scanTimer);
    this.scanTimer = null;
    getBleManager()?.stopDeviceScan();
    const done = this.scanDone;
    this.scanDone = null;
    done?.();
    if (useMuseStore.getState().status === 'scanning') useMuseStore.getState().setStatus('idle');
  }
  private async open(deviceId: string | undefined, generation: number): Promise<Transport> {
    const lost = () => {
      if (generation === this.generation)
        void this.fail('Se perdió la conexión. Vuelve a conectar Muse.');
    };
    if (Platform.OS === 'web') {
      try {
        if (!museWebBluetooth.device) await museWebBluetooth.scan();
        await deadline(museWebBluetooth.connect(), 15000);
        museWebBluetooth.onDisconnected(lost);
        return {
          info: {
            id: museWebBluetooth.device!.id,
            name: museWebBluetooth.device!.name || 'Muse',
            rssi: null,
          },
          available: await deadline(museWebBluetooth.characteristics()),
          subscribe: (uuid, cb) => museWebBluetooth.monitor(uuid, cb),
          write: (cmd) =>
            museWebBluetooth.write(MUSE_CHAR.CONTROL, toByteArray(encodeCommand(cmd))),
          close: async () => {
            museWebBluetooth.disconnect();
          },
        };
      } catch (error) {
        museWebBluetooth.disconnect();
        throw error;
      }
    }
    const manager = getBleManager();
    if (!manager || !deviceId) throw new Error('Busca y selecciona Muse antes de conectar.');
    if ((await manager.state()) !== 'PoweredOn') throw new Error('Activa Bluetooth para conectar.');
    const device: Device = await manager.connectToDevice(deviceId, {
      requestMTU: 247,
      timeout: 15000,
    });
    const subscriptions: Subscription[] = [device.onDisconnected(lost)];
    try {
      await deadline(device.discoverAllServicesAndCharacteristics(), 15000);
      const characteristics = await deadline(device.characteristicsForService(MUSE_SERVICE_UUID));
      const control = characteristics.find((c) => c.uuid.toLowerCase() === MUSE_CHAR.CONTROL);
      return {
        info: { id: device.id, name: device.name || 'Muse', rssi: device.rssi },
        available: characteristics.map((c) => c.uuid.toLowerCase()),
        subscribe: async (uuid, cb) => {
          subscriptions.push(
            device.monitorCharacteristicForService(MUSE_SERVICE_UUID, uuid, (error, value) => {
              if (error) lost();
              else if (value?.value) cb(value.value);
            }),
          );
        },
        write: async (cmd) => {
          if (control?.isWritableWithResponse)
            await device.writeCharacteristicWithResponseForService(
              MUSE_SERVICE_UUID,
              MUSE_CHAR.CONTROL,
              encodeCommand(cmd),
            );
          else
            await device.writeCharacteristicWithoutResponseForService(
              MUSE_SERVICE_UUID,
              MUSE_CHAR.CONTROL,
              encodeCommand(cmd),
            );
        },
        close: async () => {
          subscriptions.splice(0).forEach((s) => s.remove());
          await device.cancelConnection();
        },
      };
    } catch (error) {
      subscriptions.forEach((s) => s.remove());
      await device.cancelConnection();
      throw error;
    }
  }
  async connect(deviceId?: string, profile: 'full' | 'eeg' = 'full'): Promise<void> {
    if (
      this.connecting ||
      this.transport ||
      museSimulator.isRunning() ||
      useMuseStore.getState().isRecording
    )
      return;
    this.stopScan();
    this.connecting = true;
    const generation = ++this.generation,
      store = useMuseStore.getState();
    store.setStatus('connecting');
    try {
      // The chooser must remain in the user's click call stack on web.
      const transport = await this.open(deviceId, generation);
      if (generation !== this.generation) {
        await transport.close();
        return;
      }
      this.transport = transport;
      const required = [MUSE_CHAR.CONTROL, ...EEG_CHANNELS.map((ch) => EEG_CHAR_BY_CHANNEL[ch])];
      if (required.some((uuid) => !transport.available.includes(uuid)))
        throw new Error('Esta diadema no ofrece los cuatro canales EEG requeridos.');
      store.setStatus('discovering');
      store.setDevice(transport.info);
      await deadline(transport.subscribe(MUSE_CHAR.CONTROL, () => {}));
      await deadline(transport.write('h'));
      await sleep(100);
      dspEngine.start();
      this.counts.clear();
      for (const channel of EEG_CHANNELS)
        await deadline(
          transport.subscribe(EEG_CHAR_BY_CHANNEL[channel], (value) => {
            if (generation !== this.generation) return;
            try {
              const received = Date.now(),
                mono = performance.now();
              const packet = decodeEegPacket(channel, base64ToBytes(value), received);
              const previous = this.counts.get(channel);
              if (
                !previous ||
                ((packet.sequence - previous.sequence + 65536) % 65536 > 0 &&
                  (packet.sequence - previous.sequence + 65536) % 65536 < 32768)
              )
                this.counts.set(channel, {
                  sequence: packet.sequence,
                  count: (previous?.count || 0) + 1,
                  time: mono,
                });
              dspEngine.pushEeg({ ...packet, receivedMonotonicMs: mono });
            } catch {
              void this.fail('Llegó un paquete EEG inválido. Vuelve a conectar.');
            }
          }),
        );
      const optional = [MUSE_CHAR.BATTERY, MUSE_CHAR.ACCEL, MUSE_CHAR.GYRO, MUSE_CHAR.PPG];
      for (const uuid of optional.filter((id) => transport.available.includes(id)))
        await deadline(
          transport.subscribe(uuid, (value) => {
            if (generation === this.generation) this.peripheral(uuid, value);
          }),
        );
      let ppg = profile === 'full' && transport.available.includes(MUSE_CHAR.PPG);
      try {
        await this.begin(ppg ? MUSE_PPG_PRESET : MUSE_PRESET, generation);
      } catch (error) {
        if (!ppg || generation !== this.generation) throw error;
        await deadline(transport.write('h'));
        dspEngine.start();
        this.counts.clear();
        ppg = false;
        await this.begin(MUSE_PRESET, generation);
      }
      if (generation !== this.generation) return;
      store.setStatus('streaming', ppg ? null : 'Modo EEG/IMU, sin pulso.');
      let keepalive = performance.now();
      this.monitorTimer = setInterval(() => {
        if (generation !== this.generation) return;
        const now = performance.now();
        if (EEG_CHANNELS.some((ch) => now - (this.counts.get(ch)?.time ?? 0) > 3000)) {
          void this.fail('Un canal dejó de enviar datos. Vuelve a conectar Muse.');
          return;
        }
        if (now - keepalive >= 10000) {
          keepalive = now;
          void deadline(transport.write('k')).catch(() =>
            this.fail('Muse dejó de responder. Vuelve a conectar.'),
          );
        }
      }, 500);
    } catch (error) {
      if (generation === this.generation)
        await this.fail(error instanceof Error ? error.message : 'No se pudo conectar Muse.');
    } finally {
      this.connecting = false;
    }
  }
  private async begin(preset: string, generation: number): Promise<void> {
    const transport = this.transport;
    if (!transport) throw new Error('Conexión interrumpida.');
    for (const command of [preset, 's', 'd']) {
      await deadline(transport.write(command));
      await sleep(50);
    }
    const until = performance.now() + 8000;
    while (generation === this.generation && performance.now() < until) {
      if (EEG_CHANNELS.every((ch) => (this.counts.get(ch)?.count || 0) >= 2)) return;
      await sleep(50);
    }
    throw new Error(
      'No llegaron datos nuevos de los cuatro canales. Revisa que otra app no use Muse.',
    );
  }
  private peripheral(uuid: string, value: string): void {
    try {
      const bytes = base64ToBytes(value),
        time = Date.now(),
        mono = performance.now();
      const store = useMuseStore.getState();
      if (uuid === MUSE_CHAR.BATTERY) {
        const battery = decodeBattery(bytes);
        store.setBattery(battery);
        dspEngine.pushSensor({
          stream: 'battery',
          sequence: battery.sequence,
          sampleIndex: 0,
          value: battery.percent,
          receivedAtMs: time,
          receivedMonotonicMs: mono,
        });
      } else if (uuid === MUSE_CHAR.PPG) {
        const packet = decodePpg(bytes, time);
        dspEngine.pushPpg(packet);
        packet.samples.forEach((value, sampleIndex) =>
          dspEngine.pushSensor({
            stream: 'ppg',
            sequence: packet.sequence,
            sampleIndex,
            value,
            receivedAtMs: time,
            receivedMonotonicMs: mono,
          }),
        );
      } else {
        const gyro = uuid === MUSE_CHAR.GYRO,
          packet = decodeMotion(bytes, gyro ? GYRO_DPS_PER_LSB : ACCEL_G_PER_LSB);
        packet.samples.forEach((axes, sampleIndex) =>
          dspEngine.pushSensor({
            stream: gyro ? 'gyro' : 'accel',
            sequence: packet.sequence,
            sampleIndex,
            axes,
            receivedAtMs: time,
            receivedMonotonicMs: mono,
          }),
        );
        const kind = gyro ? 'gyro' : 'accel';
        if (mono - this.lastMotion[kind] >= 100) {
          this.lastMotion[kind] = mono;
          const last = packet.samples[2];
          store.setMotion(gyro ? null : last, gyro ? last : null, time);
        }
      }
    } catch {
      void this.fail('Llegó un paquete de sensor inválido. Vuelve a conectar.');
    }
  }
  private async fail(message: string): Promise<void> {
    await this.disconnect();
    const store = useMuseStore.getState();
    if (!store.isRecording) store.setStatus('error', message);
  }
  async disconnect(): Promise<void> {
    ++this.generation;
    this.stopScan();
    if (this.monitorTimer) clearInterval(this.monitorTimer);
    this.monitorTimer = null;
    const transport = this.transport;
    this.transport = null;
    museSimulator.stop();
    dspEngine.stop();
    const store = useMuseStore.getState();
    let saveError: string | null = null;
    if (store.isRecording) {
      try {
        await recorder.stop();
      } catch {
        saveError =
          'No se pudo guardar la grabación. No cierres la página; revisa el almacenamiento.';
      }
    }
    try {
      if (transport) await deadline(transport.close(), 5000);
    } catch {
      /* Already disconnected. */
    }
    if (!saveError) store.reset();
    store.setStatus(saveError ? 'error' : 'idle', saveError);
  }
  async connectSimulator(): Promise<void> {
    if (
      this.connecting ||
      this.transport ||
      museSimulator.isRunning() ||
      useMuseStore.getState().isRecording
    )
      return;
    this.stopScan();
    const store = useMuseStore.getState();
    dspEngine.start('simulation');
    store.setSimulating(true);
    store.setDevice({ id: 'simulation', name: 'Datos simulados', rssi: null });
    store.setStatus('streaming');
    museSimulator.start();
  }
}
export const museClient = new MuseClient();

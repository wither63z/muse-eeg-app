import { fromByteArray } from 'base64-js';
import { MUSE_SERVICE_UUID } from '@/constants/muse';

/** Each connection owns its listeners. Disconnecting removes them before reconnecting. */
export class MuseWebBluetooth {
  device: BluetoothDevice | null = null;
  server: BluetoothRemoteGATTServer | null = null;
  private service: BluetoothRemoteGATTService | null = null;
  private generation = 0;
  private listeners: (() => void)[] = [];

  async scan(): Promise<void> {
    if (typeof navigator === 'undefined' || !navigator.bluetooth)
      throw new Error(
        'Este navegador no ofrece Bluetooth. Usa Chrome/Edge compatible o una compilación nativa.',
      );
    if (!globalThis.isSecureContext) throw new Error('Abre la aplicación con HTTPS o localhost.');
    this.device = await navigator.bluetooth.requestDevice({
      filters: [{ namePrefix: 'Muse' }],
      optionalServices: [MUSE_SERVICE_UUID],
    });
  }
  async connect(): Promise<void> {
    if (!this.device) await this.scan();
    if (!this.device?.gatt) throw new Error('No se seleccionó una diadema Bluetooth compatible.');
    const generation = ++this.generation;
    const server = await this.device.gatt.connect();
    if (generation !== this.generation) {
      server.disconnect();
      throw new Error('Conexión interrumpida.');
    }
    this.server = server;
    const service = await server.getPrimaryService(MUSE_SERVICE_UUID);
    if (generation !== this.generation) {
      server.disconnect();
      throw new Error('Conexión interrumpida.');
    }
    this.service = service;
  }
  async characteristics(): Promise<string[]> {
    if (!this.service) throw new Error('Muse no está conectado.');
    return (await this.service.getCharacteristics()).map((c) => c.uuid.toLowerCase());
  }
  onDisconnected(callback: () => void): void {
    if (!this.device) throw new Error('Muse no está seleccionado.');
    const device = this.device;
    device.addEventListener('gattserverdisconnected', callback);
    this.listeners.push(() => device.removeEventListener('gattserverdisconnected', callback));
  }
  async monitor(uuid: string, callback: (value: string) => void): Promise<void> {
    if (!this.service) throw new Error('Muse no está conectado.');
    const characteristic = await this.service.getCharacteristic(uuid);
    const listener = () => {
      const value = characteristic.value;
      if (value)
        callback(fromByteArray(new Uint8Array(value.buffer, value.byteOffset, value.byteLength)));
    };
    characteristic.addEventListener('characteristicvaluechanged', listener);
    this.listeners.push(() =>
      characteristic.removeEventListener('characteristicvaluechanged', listener),
    );
    await characteristic.startNotifications();
  }
  async write(uuid: string, bytes: Uint8Array): Promise<void> {
    if (!this.service) throw new Error('Muse no está conectado.');
    const characteristic = await this.service.getCharacteristic(uuid);
    const data = Uint8Array.from(bytes);
    if (characteristic.properties.write) await characteristic.writeValueWithResponse(data);
    else if (characteristic.properties.writeWithoutResponse)
      await characteristic.writeValueWithoutResponse(data);
    else throw new Error('El control de Muse no permite escribir comandos.');
  }
  disconnect(): void {
    this.generation++;
    this.listeners.splice(0).forEach((remove) => remove());
    this.device?.gatt?.disconnect();
    this.server = null;
    this.service = null;
  }
}
export const museWebBluetooth = new MuseWebBluetooth();

import { MUSE_SERVICE_UUID, MUSE_CHAR } from '@/constants/muse';
import { EegChannel } from '@/types/muse';

// Interfaz mínima compatible con la lógica de nuestro cliente
export class MuseWebBluetooth {
  public device: BluetoothDevice | null = null;
  public server: BluetoothRemoteGATTServer | null = null;

  async scan(): Promise<void> {
    try {
      this.device = await navigator.bluetooth.requestDevice({
        filters: [{ namePrefix: 'Muse' }],
        optionalServices: [MUSE_SERVICE_UUID],
      });
    } catch (e) {
      console.error('Web Bluetooth scan failed:', e);
      throw e;
    }
  }

  async connect(): Promise<void> {
    if (!this.device) {
      // Intentar forzar el escaneo si no hay dispositivo
      await this.scan();
    }
    if (!this.device) throw new Error('No device selected');

    // Limpiar servidor previo si existe
    this.server = null;
    this.server = await this.device.gatt!.connect();
  }

  async hasCharacteristic(uuid: string): Promise<boolean> {
    if (!this.server) throw new Error('Not connected');
    const service = await this.server.getPrimaryService(MUSE_SERVICE_UUID);
    const characteristics = await service.getCharacteristics();
    return characteristics.some((characteristic) => characteristic.uuid.toLowerCase() === uuid.toLowerCase());
  }

  async monitor(
    charUuid: string,
    callback: (error: Error | null, value: string | null) => void
  ): Promise<void> {
    if (!this.server) throw new Error('Not connected');
    const service = await this.server.getPrimaryService(MUSE_SERVICE_UUID);
    const characteristic = await service.getCharacteristic(charUuid);

    await characteristic.startNotifications();
    characteristic.addEventListener('characteristicvaluechanged', (event: any) => {
      const value = event.target.value as DataView;
      // Usar byteOffset y byteLength para obtener exactamente los bytes recibidos
      const bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
      const base64 = btoa(String.fromCharCode(...bytes));
      callback(null, base64);
    });
  }

  async write(charUuid: string, data: Uint8Array): Promise<void> {
    if (!this.server) throw new Error('Not connected');
    const service = await this.server.getPrimaryService(MUSE_SERVICE_UUID);
    const characteristic = await service.getCharacteristic(charUuid);
    await characteristic.writeValue(data.buffer as ArrayBuffer);
  }
}

export const museWebBluetooth = new MuseWebBluetooth();

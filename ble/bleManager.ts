import { BleManager } from 'react-native-ble-plx';

/**
 * Singleton BleManager — creado de forma perezosa.
 */
let bleManagerInstance: BleManager | null = null;

export function getBleManager(): BleManager {
  if (!bleManagerInstance) {
    bleManagerInstance = new BleManager();
  }
  return bleManagerInstance;
}

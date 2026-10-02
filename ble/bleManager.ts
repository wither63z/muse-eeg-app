import { Platform } from 'react-native';
import type { BleManager as BleManagerType } from 'react-native-ble-plx';
import { museWebBluetooth } from './museWebBluetooth';

/**
 * Singleton BleManager — creado de forma perezosa.
 */
let bleManagerInstance: any = null;

export function getBleManager(): any {
  if (Platform.OS === 'web') {
    return museWebBluetooth;
  }

  if (!bleManagerInstance) {
    const { BleManager } = require('react-native-ble-plx') as typeof import('react-native-ble-plx');
    bleManagerInstance = new BleManager();
  }
  return bleManagerInstance;
}

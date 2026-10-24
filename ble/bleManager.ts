import { Platform } from 'react-native';
import type { BleManager } from 'react-native-ble-plx';
let manager: BleManager | null = null;
/** Never import the native BLE implementation in a browser bundle. */
export function getBleManager(): BleManager | null {
  if (Platform.OS === 'web') return null;
  if (!manager) {
    const native = require('react-native-ble-plx') as typeof import('react-native-ble-plx');
    manager = new native.BleManager();
  }
  return manager;
}

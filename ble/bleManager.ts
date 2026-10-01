import { Platform } from 'react-native';

/**
 * Singleton BleManager — creado de forma perezosa.
 * En web, devuelve null ya que react-native-ble-plx no es compatible.
 */
let bleManagerInstance: any = null;

export function getBleManager(): any {
  if (Platform.OS === 'web') {
    return null;
  }

  if (!bleManagerInstance) {
    const { BleManager } = require('react-native-ble-plx');
    bleManagerInstance = new BleManager();
  }
  return bleManagerInstance;
}

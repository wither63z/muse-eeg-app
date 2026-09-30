import { Platform, PermissionsAndroid } from 'react-native';

/**
 * Asegura que los permisos BLE necesarios estén concedidos.
 * 
 * - iOS: el permiso lo pide el sistema al iniciar el BleManager → true
 * - Android >= 31: BLUETOOTH_SCAN + BLUETOOTH_CONNECT
 * - Android < 31: ACCESS_FINE_LOCATION
 * 
 * Devuelve true solo si todos están en GRANTED.
 */
export async function ensureBlePermissions(): Promise<boolean> {
  if (Platform.OS === 'ios') {
    return true;
  }

  const version = typeof Platform.Version === 'string' ? parseInt(Platform.Version, 10) : Platform.Version;

  if (version >= 31) {
    // Android 12+ (API 31+)
    const results = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    ]);

    return (
      results[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] === PermissionsAndroid.RESULTS.GRANTED &&
      results[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] === PermissionsAndroid.RESULTS.GRANTED
    );
  } else {
    // Android <= 11 (API <= 30)
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    );
    return result === PermissionsAndroid.RESULTS.GRANTED;
  }
}

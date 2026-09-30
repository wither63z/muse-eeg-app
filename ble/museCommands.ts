import { fromByteArray } from 'base64-js';

/**
 * Formato de comando Muse: [longitud = len(cmd)+1, ...bytes ASCII, 0x0A]
 * enviado en base64.
 */
export function encodeCommand(cmd: string): string {
  const bytes = new Uint8Array(cmd.length + 2);
  bytes[0] = cmd.length + 1;
  for (let i = 0; i < cmd.length; i++) {
    bytes[i + 1] = cmd.charCodeAt(i);
  }
  bytes[bytes.length - 1] = 0x0a;
  return fromByteArray(bytes);
}

export const CMD_HALT = 'h';
export const CMD_RESUME = 'd';
export const CMD_STATUS = 's';

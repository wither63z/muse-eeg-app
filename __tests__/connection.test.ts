import { fromByteArray } from 'base64-js';
import { MUSE_CHAR } from '@/constants/muse';
const mockState = {
  status: 'idle',
  errorMessage: null as string | null,
  isRecording: false,
  setStatus: jest.fn((status: string, error?: string) => {
    mockState.status = status;
    mockState.errorMessage = error || null;
  }),
  setDevice: jest.fn(),
  setDiscovered: jest.fn(),
  setBattery: jest.fn(),
  setMotion: jest.fn(),
  setSimulating: jest.fn(),
  reset: jest.fn(() => {
    mockState.status = 'idle';
    mockState.isRecording = false;
  }),
};
jest.mock('react-native', () => ({ Platform: { OS: 'web' } }));
jest.mock('@/store/useMuseStore', () => ({ useMuseStore: { getState: () => mockState } }));
jest.mock('@/recording/recorder', () => ({ recorder: { stop: jest.fn(async () => {}) } }));
jest.mock('@/dsp/dspEngine', () => ({
  dspEngine: {
    start: jest.fn(),
    stop: jest.fn(),
    pushEeg: jest.fn(),
    pushPpg: jest.fn(),
    pushSensor: jest.fn(),
  },
}));
import { MuseClient } from '@/ble/museClient';
import { museWebBluetooth } from '@/ble/museWebBluetooth';
import { dspEngine } from '@/dsp/dspEngine';

class Characteristic extends EventTarget {
  properties = { write: true, writeWithoutResponse: true, notify: true, indicate: false };
  value?: DataView;
  constructor(
    readonly uuid: string,
    private operations: string[],
    private command: (text: string) => void,
  ) {
    super();
  }
  async startNotifications() {
    this.operations.push('subscribe:' + this.uuid);
    return this;
  }
  async stopNotifications() {
    return this;
  }
  async writeValueWithResponse(value: Uint8Array) {
    this.command(String.fromCharCode(...value.slice(1, -1)));
  }
  async writeValueWithoutResponse(value: Uint8Array) {
    return this.writeValueWithResponse(value);
  }
  emit(sequence: number) {
    const bytes = new Uint8Array(20);
    bytes[0] = sequence >>> 8;
    bytes[1] = sequence & 255;
    this.value = new DataView(bytes.buffer);
    this.dispatchEvent(new Event('characteristicvaluechanged'));
  }
}

describe('real web transport with fixture GATT events', () => {
  let client: MuseClient;
  let operations: string[];
  let chars: Map<string, Characteristic>;
  let emitOnStart: boolean;
  let fallbackOnly: boolean;
  let selectedPreset: string;
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockState.reset();
    operations = [];
    emitOnStart = true;
    fallbackOnly = false;
    selectedPreset = '';
    chars = new Map();
    const command = (text: string) => {
      operations.push('write:' + text);
      if (text.startsWith('p')) selectedPreset = text;
      if (text === 'd' && emitOnStart && (!fallbackOnly || selectedPreset === 'p21'))
        for (const uuid of [MUSE_CHAR.TP9, MUSE_CHAR.AF7, MUSE_CHAR.AF8, MUSE_CHAR.TP10]) {
          chars.get(uuid)!.emit(1);
          chars.get(uuid)!.emit(2);
        }
    };
    for (const uuid of Object.values(MUSE_CHAR))
      chars.set(uuid, new Characteristic(uuid, operations, command));
    const device = Object.assign(new EventTarget(), {
      id: 'fixture-device',
      name: 'Muse-Fixture',
      gatt: {
        connected: false,
        async connect() {
          this.connected = true;
          return this;
        },
        disconnect() {
          this.connected = false;
          device.dispatchEvent(new Event('gattserverdisconnected'));
        },
        async getPrimaryService() {
          return {
            getCharacteristics: async () => [...chars.values()],
            getCharacteristic: async (uuid: string) => chars.get(uuid)!,
          };
        },
      },
    });
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { bluetooth: { requestDevice: jest.fn(async () => device) } },
    });
    Object.defineProperty(globalThis, 'isSecureContext', { configurable: true, value: true });
    museWebBluetooth.device = null;
    client = new MuseClient();
  });
  afterEach(async () => {
    await client.disconnect();
    jest.useRealTimers();
  });
  it('subscribes before resume, verifies four channels and does not duplicate listeners on reconnect', async () => {
    let pending = client.connect();
    await jest.advanceTimersByTimeAsync(500);
    await pending;
    expect(mockState.status).toBe('streaming');
    for (const uuid of [MUSE_CHAR.TP9, MUSE_CHAR.AF7, MUSE_CHAR.AF8, MUSE_CHAR.TP10])
      expect(operations.indexOf('subscribe:' + uuid)).toBeLessThan(operations.indexOf('write:d'));
    expect(operations).toContain('write:p50');
    expect(dspEngine.pushEeg).toHaveBeenCalledTimes(8);
    await client.disconnect();
    pending = client.connect();
    await jest.advanceTimersByTimeAsync(500);
    await pending;
    expect(dspEngine.pushEeg).toHaveBeenCalledTimes(16);
  });
  it('does not announce streaming with only three channels', async () => {
    emitOnStart = false;
    const pending = client.connect();
    await jest.advanceTimersByTimeAsync(500);
    for (const uuid of [MUSE_CHAR.TP9, MUSE_CHAR.AF7, MUSE_CHAR.AF8]) {
      chars.get(uuid)!.emit(1);
      chars.get(uuid)!.emit(2);
    }
    await jest.advanceTimersByTimeAsync(100);
    expect(mockState.status).toBe('discovering');
    chars.get(MUSE_CHAR.TP10)!.emit(1);
    chars.get(MUSE_CHAR.TP10)!.emit(2);
    await jest.advanceTimersByTimeAsync(100);
    await pending;
    expect(mockState.status).toBe('streaming');
  });
  it('falls back from p50 to p21 only when all-channel startup fails', async () => {
    fallbackOnly = true;
    const pending = client.connect();
    await jest.advanceTimersByTimeAsync(9000);
    await pending;
    expect(mockState.status).toBe('streaming');
    expect(operations).toContain('write:p21');
    expect(dspEngine.start).toHaveBeenCalledTimes(2);
  });
  it('a stalled channel stops the stream instead of showing a connected badge', async () => {
    const pending = client.connect();
    await jest.advanceTimersByTimeAsync(500);
    await pending;
    await jest.advanceTimersByTimeAsync(4000);
    expect(mockState.status).toBe('error');
    expect(mockState.errorMessage).toContain('canal');
  });
  it('closes a partially opened connection when service discovery fails', async () => {
    jest
      .spyOn(museWebBluetooth, 'characteristics')
      .mockRejectedValueOnce(new Error('Discovery fixture'));
    const close = jest.spyOn(museWebBluetooth, 'disconnect');
    await client.connect();
    expect(close).toHaveBeenCalled();
    expect(museWebBluetooth.server).toBeNull();
    expect(mockState.status).toBe('error');
    close.mockRestore();
  });
  it('does not reopen a browser GATT connection that finished after disconnect', async () => {
    await museWebBluetooth.scan();
    const gatt = museWebBluetooth.device!.gatt!;
    let release!: (server: BluetoothRemoteGATTServer) => void;
    jest.spyOn(gatt, 'connect').mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const pending = museWebBluetooth.connect();
    museWebBluetooth.disconnect();
    release(gatt);
    await expect(pending).rejects.toThrow('interrumpida');
    expect(museWebBluetooth.server).toBeNull();
  });
  it('does not request Bluetooth on an unsupported browser', async () => {
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {} });
    await client.connect();
    expect(mockState.status).toBe('error');
    expect(mockState.errorMessage).toContain('navegador');
  });
});

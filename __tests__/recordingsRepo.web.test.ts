import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import type { RecordingMeta } from '@/types/muse';
const meta = (id: string): RecordingMeta => ({
  id,
  fileName: `${id}.csv`,
  startedAtMs: 0,
  durationMs: 1000,
  rowCount: 1,
  sizeBytes: 10,
  uri: id,
});

describe('IndexedDB persistence and legacy migration', () => {
  let saved: Map<string, string>;
  beforeEach(() => {
    jest.resetModules();
    saved = new Map();
    Object.defineProperty(globalThis, 'indexedDB', { value: new IDBFactory(), configurable: true });
    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        getItem: (key: string) => saved.get(key) ?? null,
        setItem: (key: string, value: string) => {
          saved.set(key, value);
        },
      },
      configurable: true,
    });
  });
  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'localStorage');
  });
  it('commits full raw rows and survives a module reload without localStorage', async () => {
    const repo =
      require('@/recording/recordingsRepo.web') as typeof import('@/recording/recordingsRepo.web');
    await repo.saveWebSession('one', meta('one'), ['raw-one']);
    expect(saved.size).toBe(0);
    jest.resetModules();
    const reloaded =
      require('@/recording/recordingsRepo.web') as typeof import('@/recording/recordingsRepo.web');
    expect((await reloaded.list()).map((m) => m.id)).toEqual(['one']);
    const blobs: Blob[] = [];
    const create = URL.createObjectURL;
    URL.createObjectURL = (blob: Blob) => {
      blobs.push(blob);
      return 'blob:fixture';
    };
    try {
      await reloaded.exportCsv('one');
      expect(await blobs[0].text()).toContain('raw-one');
    } finally {
      URL.createObjectURL = create;
    }
  });
  it('migration preserves existing IDs and deletion does not resurrect legacy sessions', async () => {
    saved.set(
      'muse_recordings',
      JSON.stringify({
        one: { meta: meta('one'), data: ['old-header', 'legacy-one'] },
        two: { meta: meta('two'), data: ['old-header', 'legacy-two'] },
      }),
    );
    const repo =
      require('@/recording/recordingsRepo.web') as typeof import('@/recording/recordingsRepo.web');
    await repo.saveWebSession('one', meta('one'), ['new-one']);
    expect(await repo.list()).toHaveLength(2);
    await repo.deleteRecording('one');
    expect(saved.get('muse_recordings')).not.toContain('legacy-one');
    expect(saved.get('muse_recordings')).toContain('legacy-two');
    jest.resetModules();
    const reloaded =
      require('@/recording/recordingsRepo.web') as typeof import('@/recording/recordingsRepo.web');
    expect((await reloaded.list()).map((m) => m.id)).toEqual(['two']);
  });
  it('reports IndexedDB failure without falling back to metadata-only storage', async () => {
    Object.defineProperty(globalThis, 'indexedDB', {
      value: {
        open: () => {
          throw new Error('Quota fixture');
        },
      },
      configurable: true,
    });
    const repo =
      require('@/recording/recordingsRepo.web') as typeof import('@/recording/recordingsRepo.web');
    await expect(repo.saveWebSession('one', meta('one'), ['raw-one'])).rejects.toThrow(
      'Quota fixture',
    );
    expect(saved.size).toBe(0);
  });
});

import type { RecordingMeta } from '@/types/muse';

function meta(id: string): RecordingMeta {
  return { id, fileName: `${id}.csv`, startedAtMs: 0, durationMs: 1000, rowCount: 1, sizeBytes: 10, uri: id };
}

describe('web recording deletion', () => {
  const saved = new Map<string, string>();
  let failWrites = false;
  beforeEach(() => {
    jest.resetModules(); saved.clear(); failWrites = false;
    Object.defineProperty(globalThis, 'window', { value: {}, configurable: true });
    Object.defineProperty(globalThis, 'localStorage', { value: {
      getItem: (key: string) => saved.get(key) ?? null,
      setItem: (key: string, value: string) => {
        if (failWrites) throw new Error('Storage unavailable');
        saved.set(key, value);
      },
    }, configurable: true });
  });
  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'window');
    Reflect.deleteProperty(globalThis, 'localStorage');
  });
  it('deletes the selected session and preserves other CSV data after reload', async () => {
    const repo = require('@/recording/recordingsRepo.web') as typeof import('@/recording/recordingsRepo.web');
    repo.saveWebSession('one', meta('one'), ['row-one']);
    repo.saveWebSession('two', meta('two'), ['row-two']);
    await repo.deleteRecording('one');
    expect(saved.get('muse_recordings')).not.toContain('row-one');
    expect(saved.get('muse_recordings')).toContain('row-two');
    jest.resetModules();
    const reloaded = require('@/recording/recordingsRepo.web') as typeof import('@/recording/recordingsRepo.web');
    expect((await reloaded.list()).map((session) => session.id)).toEqual(['two']);
  });
  it('reports persistence failure without deleting data in memory or on disk', async () => {
    const repo = require('@/recording/recordingsRepo.web') as typeof import('@/recording/recordingsRepo.web');
    repo.saveWebSession('one', meta('one'), ['row-one']);
    const previous = saved.get('muse_recordings');
    failWrites = true;
    await expect(repo.deleteRecording('one')).rejects.toThrow('Storage unavailable');
    expect((await repo.list()).map((session) => session.id)).toEqual(['one']);
    expect(saved.get('muse_recordings')).toBe(previous);
  });
});

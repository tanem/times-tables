import { describe, expect, it } from 'vitest';
import { freshProgress, type Progress } from './model/progress';
import {
  BACKUP_KEY,
  PROGRESS_KEY,
  loadProgress,
  saveProgress,
} from './storage';

// An in-memory stand-in for localStorage.
function fakeStorage(entries: Record<string, string> = {}) {
  const store = new Map(Object.entries(entries));
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    entries: () => Object.fromEntries(store),
  };
}

const stored: Progress = {
  version: 1,
  tables: [8],
  facts: { '6x7': { level: 2, fast: 4, slow: 1, missed: 0 } },
  records: [],
};

describe('loadProgress', () => {
  it('starts fresh from an empty store and leaves no backup', () => {
    const storage = fakeStorage();
    expect(loadProgress(storage)).toEqual(freshProgress());
    expect(storage.entries()).toEqual({});
  });

  it('reads the stored document', () => {
    const storage = fakeStorage({ [PROGRESS_KEY]: JSON.stringify(stored) });
    expect(loadProgress(storage)).toEqual(stored);
  });

  it('backs up a corrupt document and starts fresh', () => {
    const storage = fakeStorage({ [PROGRESS_KEY]: '{"version":7}' });
    expect(loadProgress(storage)).toEqual(freshProgress());
    expect(storage.entries()[BACKUP_KEY]).toBe('{"version":7}');
  });

  it('overwrites an earlier backup', () => {
    const storage = fakeStorage({
      [PROGRESS_KEY]: 'not json',
      [BACKUP_KEY]: '{"version":7}',
    });
    loadProgress(storage);
    expect(storage.entries()[BACKUP_KEY]).toBe('not json');
  });

  it('starts fresh when the store cannot be read', () => {
    const storage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {},
    };
    expect(loadProgress(storage)).toEqual(freshProgress());
  });
});

describe('saveProgress', () => {
  it('writes the whole document so that a later load reads it back', () => {
    const storage = fakeStorage();
    saveProgress(storage, stored);
    expect(loadProgress(storage)).toEqual(stored);
  });

  it('ignores a write that throws', () => {
    const storage = {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota exceeded');
      },
    };
    expect(() => saveProgress(storage, stored)).not.toThrow();
  });
});

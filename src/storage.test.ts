import { describe, expect, it } from 'vitest';
import { freshProgress, type Progress } from './model/progress';
import {
  BACKUP_KEY,
  PROGRESS_KEY,
  eraseProgress,
  loadProgress,
  saveProgress,
  type ProgressStore,
} from './storage';

// A store held in memory, with its entries open to the test.
function memoryStore(entries: Record<string, string> = {}): {
  store: ProgressStore;
  items: Map<string, string>;
} {
  const items = new Map(Object.entries(entries));
  return {
    items,
    store: {
      getItem: (key) => items.get(key) ?? null,
      setItem: (key, value) => void items.set(key, value),
      removeItem: (key) => void items.delete(key),
    },
  };
}

// A document the version 1 build accepts: a table selection, some levels, a
// drill record and a speed run record.
const VERSION_1 = JSON.stringify({
  version: 1,
  tables: [6, 12],
  facts: {
    '6x7': { level: 4, fast: 12, slow: 3, missed: 2 },
    '8x12': { level: 2, fast: 3, slow: 1, missed: 1 },
  },
  records: [
    {
      mode: 'drill',
      at: '2026-01-01T09:00:00.000Z',
      tables: [6, 12],
      fast: 14,
      slow: 4,
      missed: 2,
      quit: false,
      time: null,
    },
    {
      mode: 'speed',
      at: '2026-01-02T09:00:00.000Z',
      tables: [6, 8, 12],
      fast: 30,
      slow: 2,
      missed: 1,
      quit: false,
      time: 161300,
    },
  ],
});

// A document the version 2 build accepts.
const VERSION_2 = JSON.stringify({
  version: 2,
  tables: [3, 7],
  facts: {
    '3x7': { level: 4, fast: 5, slow: 0, missed: 0 },
    '7x8': { level: 2, fast: 3, slow: 1, missed: 1 },
  },
  times: [1800, 2400],
  records: [
    {
      at: '2026-01-03T09:00:00.000Z',
      tables: [3, 7],
      fast: 18,
      slow: 1,
      missed: 1,
      quit: false,
      pace: 2100,
      known: 1,
      median: 1900,
    },
  ],
});

describe('loadProgress', () => {
  it('starts fresh on an empty store and writes no backup', () => {
    const { store, items } = memoryStore();
    expect(loadProgress(store)).toEqual(freshProgress());
    expect(items.has(BACKUP_KEY)).toBe(false);
  });

  it('reads back a version 3 document that was saved', () => {
    const { store, items } = memoryStore();
    const progress: Progress = {
      version: 3,
      tables: [3, 7],
      facts: { '3x7': { level: 4, best: 4, fast: 5, slow: 0, missed: 0 } },
      gems: 26,
      character: 'cat',
      times: [1800, 2400],
      records: [
        {
          at: '2026-01-03T09:00:00.000Z',
          tables: [3, 7],
          fast: 18,
          slow: 1,
          missed: 1,
          quit: false,
          pace: 2100,
          known: 1,
          median: 1900,
        },
      ],
    };
    saveProgress(store, progress);
    expect(loadProgress(store)).toEqual(progress);
    expect(items.has(BACKUP_KEY)).toBe(false);
  });

  it('starts fresh on a version 1 document and backs its text up unchanged', () => {
    const { store, items } = memoryStore({
      [PROGRESS_KEY]: VERSION_1,
      [BACKUP_KEY]: 'an earlier backup',
    });
    expect(loadProgress(store)).toEqual(freshProgress());
    expect(items.get(BACKUP_KEY)).toBe(VERSION_1);
  });

  it('migrates a version 2 document, writes it back as version 3 and writes no backup', () => {
    const { store, items } = memoryStore({ [PROGRESS_KEY]: VERSION_2 });
    const loaded = loadProgress(store);
    expect(loaded).toMatchObject({
      version: 3,
      tables: [3, 7],
      facts: {
        '3x7': { level: 4, best: 4, fast: 5, slow: 0, missed: 0 },
        '7x8': { level: 2, best: 2, fast: 3, slow: 1, missed: 1 },
      },
      gems: 6,
      character: 'dragon',
      times: [1800, 2400],
    });
    expect(JSON.parse(items.get(PROGRESS_KEY) ?? '')).toEqual(loaded);
    expect(items.has(BACKUP_KEY)).toBe(false);
  });

  it('carries on with the migrated document when writing it back throws', () => {
    const { store } = memoryStore({ [PROGRESS_KEY]: VERSION_2 });
    store.setItem = () => {
      throw new Error('storage is full');
    };
    expect(loadProgress(store)).toMatchObject({ version: 3, gems: 6 });
  });

  it('starts fresh on a version 2 document that fails validation and backs it up', () => {
    const text = JSON.stringify({ ...JSON.parse(VERSION_2), times: 'none' });
    const { store, items } = memoryStore({ [PROGRESS_KEY]: text });
    expect(loadProgress(store)).toEqual(freshProgress());
    expect(items.get(BACKUP_KEY)).toBe(text);
  });

  it('reports a document from a newer build and leaves it and the backup untouched', () => {
    const newer = JSON.stringify({ version: 4, learner: {} });
    const { store, items } = memoryStore({
      [PROGRESS_KEY]: newer,
      [BACKUP_KEY]: 'an earlier backup',
    });
    expect(loadProgress(store)).toBe('newer');
    expect(items.get(PROGRESS_KEY)).toBe(newer);
    expect(items.get(BACKUP_KEY)).toBe('an earlier backup');
  });
});

describe('eraseProgress', () => {
  it('clears gems, the chosen character and the highest levels with everything else', () => {
    const { store, items } = memoryStore({ [BACKUP_KEY]: 'an earlier backup' });
    saveProgress(store, {
      ...freshProgress(),
      facts: { '3x7': { level: 0, best: 4, fast: 5, slow: 0, missed: 1 } },
      gems: 26,
      character: 'cat',
    });
    expect(eraseProgress(store)).toEqual(freshProgress());
    expect(JSON.parse(items.get(PROGRESS_KEY) ?? '')).toEqual(freshProgress());
    expect(items.has(BACKUP_KEY)).toBe(false);
  });
});

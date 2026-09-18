import { freshProgress, parseProgress, type Progress } from './model/progress';

// The one key the progress document lives under, and the key a corrupt
// document is copied to before the app starts fresh.
export const PROGRESS_KEY = 'times-tables.progress';
export const BACKUP_KEY = 'times-tables.progress.backup';

// The part of localStorage the app uses. It is passed in because localStorage
// itself can be unavailable, in which case main.ts supplies an empty store.
export type ProgressStore = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

// Reads the document once, at launch. An empty store starts fresh. A corrupt
// document is copied to the backup key, overwriting any earlier backup, and
// the app starts fresh. Either happens silently.
export function loadProgress(store: ProgressStore): Progress {
  const text = store.getItem(PROGRESS_KEY);
  if (text === null) return freshProgress();
  const progress = parseProgress(text);
  if (progress) return progress;
  write(store, BACKUP_KEY, text);
  return freshProgress();
}

// Writes the whole document back. A write that throws is ignored and the
// in-memory state carries on.
export function saveProgress(store: ProgressStore, progress: Progress): void {
  write(store, PROGRESS_KEY, JSON.stringify(progress));
}

function write(store: ProgressStore, key: string, value: string): void {
  try {
    store.setItem(key, value);
  } catch {
    // Storage may be full or blocked; the in-memory state is what counts.
  }
}

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
  removeItem: (key: string) => void;
};

// Reads the document once, at launch. An empty store starts fresh. A version
// 2 document is migrated and written back as version 3 (ADR 0004). A corrupt
// document, a version 1 document included, is copied to the backup key,
// overwriting any earlier backup, and the app starts fresh. All of these
// happen silently. A document from a newer build reads as 'newer' and
// nothing is written: the caller must not save over it.
export function loadProgress(store: ProgressStore): Progress | 'newer' {
  const text = store.getItem(PROGRESS_KEY);
  if (text === null) return freshProgress();
  const read = parseProgress(text);
  if (read.kind === 'newer') return 'newer';
  if (read.kind === 'corrupt') {
    write(store, BACKUP_KEY, text);
    return freshProgress();
  }
  if (read.migrated) saveProgress(store, read.progress);
  return read.progress;
}

// Writes the whole document back. A write that throws is ignored and the
// in-memory state carries on.
export function saveProgress(store: ProgressStore, progress: Progress): void {
  write(store, PROGRESS_KEY, JSON.stringify(progress));
}

// Erases everything: the backup key is removed and a fresh document is
// written under the progress key. A store that throws is ignored, as
// saveProgress ignores it, and the fresh document is returned regardless.
export function eraseProgress(store: ProgressStore): Progress {
  try {
    store.removeItem(BACKUP_KEY);
  } catch {
    // Storage may be blocked; the in-memory state is what counts.
  }
  const fresh = freshProgress();
  saveProgress(store, fresh);
  return fresh;
}

function write(store: ProgressStore, key: string, value: string): void {
  try {
    store.setItem(key, value);
  } catch {
    // Storage may be full or blocked; the in-memory state is what counts.
  }
}

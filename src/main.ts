import './style.css';
import { renderStart } from './screens/start';
import { loadProgress, saveProgress, type ProgressStore } from './storage';

// localStorage itself can be unavailable, in which case the app runs on its
// in-memory state alone.
function browserStore(): ProgressStore {
  try {
    return window.localStorage;
  } catch {
    return { getItem: () => null, setItem: () => {} };
  }
}

// Asks the browser to keep the store, so that progress survives the
// device's own storage cleanup. A refusal changes nothing.
navigator.storage?.persist?.().catch(() => {});

const store = browserStore();
const progress = loadProgress(store);

const app = document.querySelector('#app');
if (app) {
  app.replaceChildren(
    renderStart({
      tables: progress.tables,
      onTablesChange: (tables) => {
        progress.tables = tables;
        saveProgress(store, progress);
      },
    }),
  );
}

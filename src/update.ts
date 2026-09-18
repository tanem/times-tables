// When a waiting service worker is applied. Applying reloads the page, so
// it happens on the Start screen alone: mid-drill or mid-run a reload would
// end the sitting and lose its record.

export type Updater = {
  // The plugin reports a worker waiting to take over.
  workerWaiting(): void;
  // The app has put a screen up; onStart is true for the Start screen alone.
  screenShown(onStart: boolean): void;
};

export function createUpdater(apply: () => void): Updater {
  let waiting = false;
  let onStart = false;
  let applied = false;

  // Applies the moment both hold: a worker is waiting and the Start screen
  // is the one showing. Applying reloads, so it is done once and no later
  // report can repeat it.
  function applyIfReady(): void {
    if (!waiting || !onStart || applied) return;
    applied = true;
    apply();
  }

  return {
    workerWaiting: () => {
      waiting = true;
      applyIfReady();
    },
    screenShown: (start) => {
      onStart = start;
      applyIfReady();
    },
  };
}

// When a service worker update is taken up. It comes in two steps: the app
// hands the waiting worker the go-ahead, and the page is loaded again once
// that worker has taken control. Both wait for the Start screen, per
// docs/adr/0001, because the reload would otherwise end a drill and lose its
// record. The takeover can also come of another tab of the app applying the
// update, so the reload waits whether or not this app was the one that
// applied.

export type Updater = {
  // The plugin reports a worker waiting to take over.
  workerWaiting(): void;
  // A new worker has taken control of the page, so the page is due a reload.
  workerTookOver(): void;
  // The app has put a screen up; onStart is true for the Start screen, and
  // for the screen shown for a newer document, which no drill can follow.
  screenShown(onStart: boolean): void;
};

export type UpdaterActions = {
  // Hands the waiting worker the go-ahead to take over.
  apply: () => void;
  // Loads the page again, onto the files the new worker serves.
  reload: () => void;
};

export function createUpdater({ apply, reload }: UpdaterActions): Updater {
  let waiting = false;
  let tookOver = false;
  let startShowing = false;
  let applied = false;
  let reloaded = false;

  // Applies the moment both hold: a worker is waiting and the Start screen
  // is the one showing. It is done once and no later report can repeat it.
  function applyIfReady(): void {
    if (!waiting || !startShowing || applied) return;
    applied = true;
    apply();
  }

  // Reloads the moment both hold: a worker has taken over and the Start
  // screen is the one showing. Done once, like the apply.
  function reloadIfReady(): void {
    if (!tookOver || !startShowing || reloaded) return;
    reloaded = true;
    reload();
  }

  return {
    workerWaiting: () => {
      waiting = true;
      applyIfReady();
    },
    workerTookOver: () => {
      tookOver = true;
      reloadIfReady();
    },
    screenShown: (onStart) => {
      startShowing = onStart;
      applyIfReady();
      reloadIfReady();
    },
  };
}

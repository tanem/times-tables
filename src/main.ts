import './style.css';
import { registerSW } from 'virtual:pwa-register';
import { buildInfo } from './build';
import {
  answer,
  correct,
  drillRecord,
  isComplete,
  present,
  quitDrill,
  startDrill,
  type Drill,
} from './model/drill';
import type { Table } from './model/facts';
import type { GotOutcome, Outcome } from './model/level';
import {
  addRecord,
  applyOutcome,
  correctOutcome,
  factLevel,
} from './model/progress';
import { random } from './random';
import { renderCard } from './screens/card';
import { renderEnd } from './screens/end';
import { renderFeedback } from './screens/feedback';
import { renderParent } from './screens/parent';
import { renderStart } from './screens/start';
import {
  eraseProgress,
  loadProgress,
  saveProgress,
  type ProgressStore,
} from './storage';
import { dayOf, timestamp, today } from './time';
import { createUpdater } from './update';

// localStorage itself can be unavailable, in which case the app runs on its
// in-memory state alone.
function browserStore(): ProgressStore {
  try {
    return window.localStorage;
  } catch {
    return { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  }
}

// Asks the browser to keep the store, so that progress survives the
// device's own storage cleanup. A refusal changes nothing.
navigator.storage?.persist?.().catch(() => {});

const store = browserStore();
let progress = loadProgress(store);

const app = document.querySelector('#app');

// A service worker update is taken up on the Start screen alone, per
// docs/adr/0001, so that neither half of it can end a drill.
const updater = createUpdater({
  // The returned updateSW only posts skip-waiting to the waiting worker; its
  // argument is ignored. The worker takes over a moment later, and the
  // reload below is what puts the new files on screen.
  apply: () => void updateSW(),
  reload: () => window.location.reload(),
});

// Registered in prompt mode with no banner. Without onNeedReload the plugin
// reloads the page itself the moment the worker takes over, which another
// tab of the app applying the update would do here in the middle of a
// drill; with it the reload is the updater's to time.
const updateSW = registerSW({
  onNeedRefresh: () => updater.workerWaiting(),
  onNeedReload: () => updater.workerTookOver(),
});

// Screens are swapped by in-app state: one screen at a time, no routing.
// onStart marks the Start screen, the one screen an update may reload on.
function show(screen: HTMLElement, { onStart = false } = {}): void {
  app?.replaceChildren(screen);
  updater.screenShown(onStart);
}

const levelOf = (key: string) => factLevel(progress, key);

function showStart(): void {
  show(
    renderStart({
      tables: progress.tables,
      onTablesChange: (tables) => {
        progress = { ...progress, tables };
        saveProgress(store, progress);
      },
      onPractise: beginDrill,
      onParents: showParent,
    }),
    { onStart: true },
  );
}

// The Parent view reads the document as it stands when a parent opens it.
// Erasing is the one change it can make; the fresh document it hands back
// replaces the one in play before the app returns to the Start screen.
function showParent(): void {
  show(
    renderParent({
      progress,
      today: today(),
      dayOf,
      build: buildInfo(),
      onBack: showStart,
      onErase: () => {
        progress = eraseProgress(store);
        showStart();
      },
    }),
  );
}

function beginDrill(tables: Table[]): void {
  showCard(startDrill(tables, levelOf, random), true);
}

function showCard(drill: Drill, entering: boolean): void {
  show(
    renderCard({
      presentation: drill.current,
      position: drill.answered + 1,
      entering,
      onAnswer: (outcome) => recordAnswer(drill, outcome),
      onQuit: () => endDrill(quitDrill(drill)),
    }),
  );
}

// The outcome moves the fact's level and counts at once and the whole
// document is written back before the feedback shows. The next fact is
// drawn when the feedback moves on, with the levels as they now are.
function recordAnswer(before: Drill, outcome: Outcome): void {
  progress = applyOutcome(progress, before.current.fact.key, outcome);
  saveProgress(store, progress);
  showFeedback(answer(before, outcome), outcome);
}

// A correction re-grades the answer just given as missed, in the document
// and the drill alike, and shows the missed feedback in place of the one
// that was up.
function correctAnswer(drill: Drill, outcome: GotOutcome): void {
  progress = correctOutcome(progress, drill.current.fact.key, outcome);
  saveProgress(store, progress);
  showFeedback(correct(drill), 'missed');
}

function showFeedback(drill: Drill, outcome: Outcome): void {
  show(
    renderFeedback({
      presentation: drill.current,
      outcome,
      nth: drill[outcome],
      streak: drill.streak,
      onAdvance: () => {
        if (isComplete(drill)) endDrill(drill);
        else showCard(present(drill, levelOf, random), false);
      },
      onCorrect:
        outcome === 'missed' ? undefined : () => correctAnswer(drill, outcome),
    }),
  );
}

// The drill record is written when the drill ends or is quit.
function endDrill(drill: Drill): void {
  progress = addRecord(progress, drillRecord(drill, timestamp()));
  saveProgress(store, progress);
  show(
    renderEnd({
      drill,
      onHome: showStart,
      onAgain: () => beginDrill(drill.tables),
    }),
  );
}

showStart();

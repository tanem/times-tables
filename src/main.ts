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
  personalBest,
  type CompletedRun,
} from './model/progress';
import {
  answerRun,
  cardOf,
  isRunComplete,
  speedRunRecord,
  startRun,
  type SpeedRun,
} from './model/speedrun';
import { random } from './random';
import { renderCard } from './screens/card';
import { renderCountdown } from './screens/countdown';
import { renderEnd } from './screens/end';
import { renderFeedback } from './screens/feedback';
import { renderParent } from './screens/parent';
import { renderReveal } from './screens/reveal';
import { renderRunCard } from './screens/runcard';
import { renderRunEnd } from './screens/runend';
import { renderStart } from './screens/start';
import {
  eraseProgress,
  loadProgress,
  saveProgress,
  type ProgressStore,
} from './storage';
import { dayOf, now, timestamp, today } from './time';
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

// A waiting service worker is applied on the Start screen alone, per
// docs/adr/0001, so that a reload cannot end a drill or a speed run.
const updater = createUpdater(() => {
  // The app stops taking taps before the update is applied: skip-waiting is
  // posted here and the reload follows once the new worker takes control, so
  // a tap in between could start a drill that the reload then ends.
  app?.setAttribute('inert', '');
  void updateSW();
});

// Registered in prompt mode with no banner: a waiting worker is reported to
// the updater, which decides when it is applied.
const updateSW = registerSW({
  onNeedRefresh: () => updater.workerWaiting(),
});

// Screens are swapped by in-app state: one screen at a time, no routing.
// onStart marks the Start screen, the one screen an update may reload on.
function show(screen: HTMLElement, onStart = false): void {
  app?.replaceChildren(screen);
  updater.screenShown(onStart);
}

const levelOf = (key: string) => factLevel(progress, key);

// The personal best in milliseconds, or null before any completed run.
const bestTime = () => personalBest(progress)?.time ?? null;

function showStart(): void {
  show(
    renderStart({
      tables: progress.tables,
      onTablesChange: (tables) => {
        progress = { ...progress, tables };
        saveProgress(store, progress);
      },
      onPractise: beginDrill,
      best: bestTime(),
      onSpeedRun: beginRun,
      onParents: showParent,
    }),
    true,
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

// The speed run in play, from the countdown to the last fact, and null at
// any other time. It is kept here so that hiding the app can quit it.
let runInPlay: SpeedRun | null = null;

// A speed run begins with the countdown, and its clock starts when the
// first fact appears.
function beginRun(): void {
  runInPlay = startRun(random);
  show(renderCountdown({ onDone: () => showRunCard(now()) }));
}

function showRunCard(startedAt: number): void {
  if (!runInPlay) return;
  show(
    renderRunCard({
      presentation: cardOf(runInPlay),
      startedAt,
      onAnswer: (outcome) => recordRunAnswer(startedAt, outcome),
      onQuit: quitRun,
    }),
  );
}

// The outcome moves the fact's level and counts as a drill answer does, and
// the document is written back before anything else shows. A got fact goes
// straight to the next one; a missed fact shows its answer first. The clock
// is read on the tap, before any of that, in case this is the last fact.
function recordRunAnswer(startedAt: number, outcome: Outcome): void {
  if (!runInPlay) return;
  const time = now() - startedAt;
  const presentation = cardOf(runInPlay);
  progress = applyOutcome(progress, presentation.fact.key, outcome);
  saveProgress(store, progress);
  runInPlay = answerRun(runInPlay, outcome, random);
  if (isRunComplete(runInPlay)) {
    endRun(speedRunRecord(runInPlay, timestamp(), time));
  } else if (outcome === 'missed') {
    show(
      renderReveal({
        presentation,
        startedAt,
        onDone: () => showRunCard(startedAt),
        onQuit: quitRun,
      }),
    );
  } else showRunCard(startedAt);
}

// The clock stops on the tap that gets the last fact. The record is written
// and the end screen compares the time with the best as it stood before.
function endRun(record: CompletedRun): void {
  runInPlay = null;
  const previousBest = bestTime();
  progress = addRecord(progress, record);
  saveProgress(store, progress);
  show(
    renderRunEnd({
      record,
      previousBest,
      onDone: showStart,
      onAgain: beginRun,
    }),
  );
}

// A quit keeps the level and count changes, leaves a record flagged quit
// with no time, and goes straight to the Start screen.
function quitRun(): void {
  if (!runInPlay) return;
  progress = addRecord(progress, speedRunRecord(runInPlay, timestamp(), null));
  saveProgress(store, progress);
  runInPlay = null;
  showStart();
}

// Hiding the app during the countdown or the run quits the run, so that the
// clock cannot be stopped by leaving.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') quitRun();
});

showStart();

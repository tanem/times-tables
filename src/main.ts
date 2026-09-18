import './style.css';
import {
  DRILL_LENGTH,
  answer,
  drillRecord,
  isComplete,
  present,
  quitDrill,
  startDrill,
  type Drill,
} from './model/drill';
import type { Table } from './model/facts';
import type { Outcome } from './model/level';
import { addRecord, applyOutcome, factLevel } from './model/progress';
import { random } from './random';
import { renderCard } from './screens/card';
import { renderEnd } from './screens/end';
import { renderFeedback } from './screens/feedback';
import { renderStart } from './screens/start';
import { loadProgress, saveProgress, type ProgressStore } from './storage';
import { timestamp } from './time';

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
let progress = loadProgress(store);

const app = document.querySelector('#app');

// Screens are swapped by in-app state: one screen at a time, no routing.
function show(screen: HTMLElement): void {
  app?.replaceChildren(screen);
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
    }),
  );
}

function beginDrill(tables: Table[]): void {
  showCard(startDrill(tables, levelOf, random), true);
}

function showCard(drill: Drill, entering: boolean): void {
  const presentation = drill.current;
  if (!presentation) return;
  show(
    renderCard({
      presentation,
      position: drill.answered + 1,
      length: DRILL_LENGTH,
      entering,
      onAnswer: (outcome) => grade(drill, outcome),
      onQuit: () => endDrill(quitDrill(drill)),
    }),
  );
}

// The outcome moves the fact's level and counts at once and the whole
// document is written back before the feedback shows.
function grade(before: Drill, outcome: Outcome): void {
  const presentation = before.current;
  if (!presentation) return;
  progress = applyOutcome(progress, presentation.fact.key, outcome);
  saveProgress(store, progress);
  const drill = answer(before, outcome);
  show(
    renderFeedback({
      presentation,
      outcome,
      nth: drill[outcome],
      streak: drill.streak,
      onAdvance: () => {
        if (isComplete(drill)) endDrill(drill);
        else showCard(present(drill, levelOf, random), false);
      },
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

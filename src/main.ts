import './style.css';
import { registerSW } from 'virtual:pwa-register';
import { buildInfo } from './build';
import {
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
import { gradeAnswer, paceOf } from './model/pace';
import {
  applyOutcome,
  badges,
  buy,
  chooseCharacter,
  chooseColour,
  chooseHat,
  factLevel,
  freshProgress,
  keepAnswerTime,
  knownCount,
  knownShare,
  ownedColours,
  ownedHats,
  recordDrill,
} from './model/progress';
import { random } from './random';
import { renderCard } from './screens/card';
import { renderEnd } from './screens/end';
import { renderFeedback } from './screens/feedback';
import { renderNeedsUpdate } from './screens/needs-update';
import { renderParent } from './screens/parent';
import { renderShop } from './screens/shop';
import { renderStart } from './screens/start';
import { mountSound } from './sound';
import {
  eraseProgress,
  loadProgress,
  saveProgress,
  type ProgressStore,
} from './storage';
import { dayOf, timestamp, today } from './time';
import { createUpdater } from './update';

// A store that holds nothing and keeps nothing.
const NO_STORE: ProgressStore = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

// localStorage itself can be unavailable, in which case the app runs on its
// in-memory state alone.
function browserStore(): ProgressStore {
  try {
    return window.localStorage;
  } catch {
    return NO_STORE;
  }
}

// Asks the browser to keep the store, so that progress survives the
// device's own storage cleanup. A refusal changes nothing.
navigator.storage?.persist?.().catch(() => {});

mountSound();

const loaded = loadProgress(browserStore());

// A document from a newer build is never written over (ADR 0004). The app
// then shows the one screen that says so, which has no way on, and runs on
// a store that keeps nothing, so no save can reach the newer document.
const store = loaded === 'newer' ? NO_STORE : browserStore();
let progress = loaded === 'newer' ? freshProgress() : loaded;

const app = document.querySelector('#app');

// A service worker update is taken up on the Start screen, per
// docs/adr/0001, or on the screen for a newer document, per docs/adr/0004,
// so that neither half of it can end a drill.
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
// reloadable marks the screens an update may reload on: the Start screen,
// and the screen for a newer document, where the update is what is needed.
function show(screen: HTMLElement, { reloadable = false } = {}): void {
  app?.replaceChildren(screen);
  updater.screenShown(reloadable);
}

const levelOf = (key: string) => factLevel(progress, key);

function showStart(): void {
  show(
    renderStart({
      tables: progress.tables,
      knownShare: (table) => knownShare(progress, table),
      badges: badges(progress),
      balance: progress.balance,
      earned: progress.earned,
      character: progress.character,
      hats: ownedHats(progress),
      hat: progress.hat,
      colours: progress.colours,
      ownedColours: (character) => ownedColours(progress, character),
      bond: progress.bond,
      onTablesChange: (tables) => {
        progress = { ...progress, tables };
        saveProgress(store, progress);
      },
      onCharacterChange: (character) => {
        progress = chooseCharacter(progress, character);
        saveProgress(store, progress);
      },
      onHatChange: (hat) => {
        progress = chooseHat(progress, hat);
        saveProgress(store, progress);
      },
      onColourChange: (character, colour) => {
        progress = chooseColour(progress, character, colour);
        saveProgress(store, progress);
      },
      onPractise: beginDrill,
      onShop: showShop,
      onParents: showParent,
    }),
    { reloadable: true },
  );
}

// The Shop reads the document as it stands when the learner opens it. Each
// purchase is saved at once, and the Shop stays up with what it bought.
function showShop(): void {
  show(
    renderShop({
      balance: progress.balance,
      owned: progress.owned,
      character: progress.character,
      hat: progress.hat,
      colours: progress.colours,
      onBuy: (id) => {
        progress = buy(progress, id);
        saveProgress(store, progress);
        return { balance: progress.balance, owned: progress.owned };
      },
      onBack: showStart,
    }),
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

// The document as the drill began. Recording the drill reads the badges and
// the unlocks between it and the document at the end, so a badge or
// character a migration or an earlier drill brought is never announced
// (ADR 0005).
let started = progress;

function beginDrill(tables: Table[]): void {
  started = progress;
  showCard(startDrill(tables, levelOf, random), true);
}

function showCard(drill: Drill, entering: boolean): void {
  show(
    renderCard({
      presentation: drill.current,
      position: drill.answered + 1,
      entering,
      onAnswer: (right, time) => recordAnswer(drill, right, time),
      onQuit: () => endDrill(quitDrill(drill)),
    }),
  );
}

// The answer is graded against the pace as it stood before it. The outcome
// moves the fact's level and counts at once and pays a gem if it took the
// fact to a new level (ADR 0004), a right answer's time joins the times pace
// is worked out from, and the whole document is written back before the
// feedback shows. The next fact is drawn when the feedback moves on, with
// the levels as they now are.
function recordAnswer(before: Drill, right: boolean, time: number): void {
  const outcome = gradeAnswer(right, time, paceOf(progress.times));
  const earnedBefore = progress.earned;
  progress = applyOutcome(progress, before.current.fact.key, outcome);
  if (right) progress = keepAnswerTime(progress, time);
  saveProgress(store, progress);
  showFeedback(
    answer(before, outcome, time),
    outcome,
    progress.earned > earnedBefore,
  );
}

function showFeedback(drill: Drill, outcome: Outcome, gem: boolean): void {
  show(
    renderFeedback({
      presentation: drill.current,
      outcome,
      character: progress.character,
      hat: progress.hat,
      colour: progress.colours[progress.character],
      nth: drill[outcome],
      streak: drill.streak,
      gem,
      onAdvance: () => {
        if (isComplete(drill)) endDrill(drill);
        else showCard(present(drill, levelOf, random), false);
      },
    }),
  );
}

// The drill record is written when the drill ends or is quit. Recording it
// pays the bonus for a drill faster than last time (ADR 0004) and band pay
// for the drill's band (ADR 0005), and hands back what it paid, the badges
// the drill's answers earned and the characters it unlocked, which the end
// screen shows.
function endDrill(drill: Drill): void {
  const record = drillRecord(
    drill,
    timestamp(),
    knownCount(progress),
    paceOf(progress.times),
  );
  const recorded = recordDrill(progress, record, started);
  progress = recorded.progress;
  saveProgress(store, progress);
  show(
    renderEnd({
      drill,
      character: progress.character,
      hat: progress.hat,
      colours: progress.colours,
      faster: recorded.faster,
      bandPay: recorded.bandPay,
      newBadges: recorded.newBadges,
      unlocks: recorded.unlocks,
      onHome: showStart,
      onAgain: () => beginDrill(drill.tables),
    }),
  );
}

if (loaded === 'newer') show(renderNeedsUpdate(), { reloadable: true });
else showStart();

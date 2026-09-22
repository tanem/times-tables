import type { Character } from '../model/characters';
import { bandOf, type Band, type Drill } from '../model/drill';
import { sound } from '../sound';
import { schedule } from '../time';
import {
  renderCharacter,
  renderConfetti,
  type Pose,
  type SparkleKind,
} from './character';

// How each band celebrates: what the character does, and what goes with
// it.
type Celebration = {
  pose: Pose;
  sparkles?: SparkleKind;
  confetti: boolean;
};

const CELEBRATIONS: Readonly<Record<Band, Celebration>> = {
  top: { pose: 'big-jump', confetti: true },
  middle: { pose: 'hop', sparkles: 'burst', confetti: false },
  low: { pose: 'wave', confetti: false },
};

// When the race starts and how long it runs, in milliseconds. Its words show
// as it ends.
const RACE_AT = 900;
const RACE_RUN = 2200;

// What the words say once the race has run.
const WORDS = 'Faster than last time!';

// When the dialog for a new character shows, in milliseconds: on the race's
// beat when there is no race, and this long after the words when there is,
// so that the improvement sweep has rung out.
const UNLOCK_AT = RACE_AT;
const UNLOCK_AFTER_WORDS = 1300;

// What the dialog says: its heading, and where the learner chooses the
// character, which is the Start screen that Home leads to.
const NEW_CHARACTER = 'New character!';
const WHERE_TO_CHOOSE = 'Tap it on the Home screen to play as it';

// The race between the learner's earlier self and today, and the words that
// follow it. The track is decorative, so a screen reader is left with the
// words alone; the two small figures in it are hidden with it, so that they
// do not answer to the name the celebrating character goes by. The track holds
// its place from the first render and the styles keep the words a line high
// while they are empty, so that Home and Go again never move under a finger.
// The words are a live region, and the bolt before them is not read out.
function renderMoment(character: Character): {
  moment: HTMLElement;
  sayWords: () => void;
} {
  const moment = document.createElement('div');
  moment.className = 'moment';

  const race = document.createElement('div');
  race.className = 'race';
  race.setAttribute('aria-hidden', 'true');
  for (const [lane, text] of [
    ['earlier', 'Last time'],
    ['today', 'Today'],
  ] as const) {
    const row = document.createElement('div');
    row.className = `lane ${lane}`;
    const label = document.createElement('span');
    label.className = 'lane-label';
    label.textContent = text;
    const runner = document.createElement('div');
    runner.className = 'runner';
    runner.append(renderCharacter({ character, pose: 'sit' }));
    row.append(label, runner);
    race.append(row);
  }
  const flag = document.createElement('span');
  flag.className = 'flag';
  flag.textContent = '🏁';
  race.append(flag);

  const words = document.createElement('p');
  words.className = 'moment-words';
  words.setAttribute('role', 'status');

  moment.append(race, words);
  return {
    moment,
    sayWords: () => {
      const bolt = document.createElement('span');
      bolt.setAttribute('aria-hidden', 'true');
      bolt.textContent = '⚡ ';
      words.append(bolt, WORDS);
    },
  };
}

// The dialog that announces a new character: the character jumping high in
// a burst of sparkles, its name and where to choose it, on a card over a backdrop
// that covers the screen. It does not switch character, and OK is its only
// way out. The backdrop is fixed over the screen, so nothing under it moves.
function renderUnlock(character: Character): {
  backdrop: HTMLElement;
  ok: HTMLButtonElement;
} {
  const backdrop = document.createElement('div');
  backdrop.className = 'backdrop';

  const dialog = document.createElement('div');
  dialog.className = 'unlock';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');

  const heading = document.createElement('h2');
  heading.id = 'unlock-heading';
  heading.textContent = NEW_CHARACTER;
  dialog.setAttribute('aria-labelledby', heading.id);

  const name = document.createElement('p');
  name.className = 'unlock-name';
  name.textContent = `The ${character}`;

  const where = document.createElement('p');
  where.className = 'unlock-where';
  where.textContent = WHERE_TO_CHOOSE;

  const ok = document.createElement('button');
  ok.type = 'button';
  ok.className = 'unlock-ok';
  ok.textContent = 'OK';
  ok.addEventListener('click', () => backdrop.remove());

  dialog.append(
    heading,
    renderCharacter({ character, pose: 'big-jump', sparkles: 'burst' }),
    name,
    where,
    ok,
  );
  backdrop.append(dialog);
  return { backdrop, ok };
}

export type EndOptions = {
  drill: Drill;
  character: Character;
  // Whether the drill was faster than last time, which the moment shows and
  // the bonus has already been paid for (ADR 0004).
  faster: boolean;
  // The character the drill's gems unlocked, if any, which the dialog
  // announces (ADR 0004).
  unlock: Character | null;
  onHome: () => void;
  onAgain: () => void;
};

// Builds the end screen: the character, a heading, the tally of fast, slow
// and missed, the best streak, then Home and Go again. The character
// celebrates by the drill's band, and a run up plays that is longer for a
// higher band. A drill faster than last time runs the race 0.9 seconds into
// the celebration, and the words, the proud character and the improvement
// sweep follow it. A new character is announced in a dialog with the
// fanfare, last of all.
export function renderEnd(options: EndOptions): HTMLElement {
  const { drill, character } = options;

  const screen = document.createElement('main');
  screen.className = 'end';

  const band = bandOf(drill);
  const celebration = CELEBRATIONS[band];
  sound.end(band);
  const figure = renderCharacter({ character, ...celebration });

  const heading = document.createElement('h1');
  heading.textContent = drill.quit
    ? 'Stopped early. Still counts!'
    : 'Drill done!';

  const tally = document.createElement('div');
  tally.className = 'tally';
  for (const [outcome, label] of [
    ['fast', 'Fast'],
    ['slow', 'Slow'],
    ['missed', 'Missed'],
  ] as const) {
    const item = document.createElement('p');
    item.className = `tally-item ${outcome}`;
    const count = document.createElement('b');
    count.textContent = String(drill[outcome]);
    item.append(count, ` ${label}`);
    tally.append(item);
  }

  const best = document.createElement('p');
  best.className = 'best';
  best.textContent = `Best streak: ${drill.bestStreak}`;

  const actions = document.createElement('div');
  actions.className = 'actions';

  // Leaving the screen takes the moment's timers with it, so that nothing of
  // it runs or sounds over the screen that follows.
  const pending: (() => void)[] = [];
  const leave = (go: () => void) => () => {
    for (const cancel of pending) cancel();
    go();
  };

  const home = document.createElement('button');
  home.type = 'button';
  home.className = 'action home';
  home.textContent = 'Home';
  home.addEventListener('click', leave(options.onHome));

  const again = document.createElement('button');
  again.type = 'button';
  again.className = 'action again';
  again.textContent = 'Go again';
  again.addEventListener('click', leave(options.onAgain));

  actions.append(home, again);
  screen.append(figure, heading, tally, best, actions);

  if (options.faster) {
    screen.classList.add('faster');
    const { moment, sayWords } = renderMoment(character);
    actions.before(moment);
    pending.push(
      schedule(() => moment.classList.add('go'), RACE_AT),
      schedule(() => {
        moment.classList.add('won');
        sayWords();
        figure.replaceWith(
          renderCharacter({ character, pose: 'proud', sparkles: 'breath' }),
        );
        sound.faster();
      }, RACE_AT + RACE_RUN),
    );
  }

  if (options.unlock) {
    const { backdrop, ok } = renderUnlock(options.unlock);
    const at = options.faster
      ? RACE_AT + RACE_RUN + UNLOCK_AFTER_WORDS
      : UNLOCK_AT;
    pending.push(
      schedule(() => {
        screen.append(backdrop);
        ok.focus();
        sound.unlock();
      }, at),
    );
  }

  if (celebration.confetti) screen.append(renderConfetti());
  return screen;
}

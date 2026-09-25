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

// How long after the words the dialog for a new character shows, in
// milliseconds, so that the improvement sweep has rung out. With no race it
// shows on the race's beat instead.
const DIALOG_AFTER_WORDS = 1300;

// What the dialog says: its heading, and where the learner chooses the
// character, which is the Start screen that Home leads to.
const NEW_CHARACTER = 'New character!';
const WHERE_TO_CHOOSE = 'Tap Home, then tap it to play as it';

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
// a burst of sparkles, its name and where to choose it. It does not switch
// character; OK closes it, as Escape does on a keyboard. It is the
// browser's own modal dialog, so it sits in the top layer over the screen
// and nothing under it moves or can be reached while it is open.
function renderUnlock(character: Character): {
  dialog: HTMLDialogElement;
  ok: HTMLButtonElement;
} {
  const dialog = document.createElement('dialog');
  dialog.className = 'unlock';

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
  ok.addEventListener('click', () => dialog.close());

  dialog.append(
    heading,
    renderCharacter({ character, pose: 'big-jump', sparkles: 'burst' }),
    name,
    where,
    ok,
  );
  return { dialog, ok };
}

export type EndOptions = {
  drill: Drill;
  character: Character;
  // Whether the drill was faster than last time, which the moment shows and
  // the bonus has already been paid for (ADR 0004).
  faster: boolean;
  // The characters the drill's gems unlocked, in unlock order, which a
  // dialog each announces (ADR 0005).
  unlocks: readonly Character[];
  onHome: () => void;
  onAgain: () => void;
};

// Builds the end screen: the character, a heading, the tally of fast, slow
// and missed, the best streak, then Home and Go again. The character
// celebrates by the drill's band, and a run up plays that is longer for a
// higher band. A drill faster than last time runs the race 0.9 seconds into
// the celebration, and the words, the proud character and the improvement
// sweep follow it. Each new character is announced in a dialog with the
// fanfare, last of all, the next one following the OK of the one before;
// leaving by Home or Go again before then brings the dialogs forward, and
// the leave follows the last OK, so that no unlock goes unannounced.
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
  // it runs or sounds over the screen that follows. Dialogs still to come
  // show instead, and the leave follows the last one's OK.
  const pending: (() => void)[] = [];
  let announce: ((onClose: () => void) => void) | null = null;
  const leave = (go: () => void) => () => {
    for (const cancel of pending) cancel();
    if (announce) announce(go);
    else go();
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

  if (options.unlocks.length > 0) {
    // Once closed by OK or Escape a dialog is taken away and the next
    // character's shows. After the last, what follows is the leave that
    // brought the dialogs forward, or focus back on Home, which is where
    // they said to go.
    const showFrom = (index: number, onClose: () => void): void => {
      const character = options.unlocks[index];
      if (!character) {
        onClose();
        return;
      }
      const { dialog, ok } = renderUnlock(character);
      dialog.addEventListener('close', () => {
        dialog.remove();
        showFrom(index + 1, onClose);
      });
      screen.append(dialog);
      dialog.showModal();
      ok.focus();
      sound.unlock();
    };
    announce = (onClose) => {
      announce = null;
      showFrom(0, onClose);
    };
    const at = options.faster
      ? RACE_AT + RACE_RUN + DIALOG_AFTER_WORDS
      : RACE_AT;
    pending.push(schedule(() => announce?.(() => home.focus()), at));
  }

  if (celebration.confetti) screen.append(renderConfetti());
  return screen;
}

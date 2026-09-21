import { bandOf, type Band, type Drill } from '../model/drill';
import { sound } from '../sound';
import { schedule } from '../time';
import {
  renderConfetti,
  renderDragon,
  type DragonPose,
  type SparkleKind,
} from './dragon';

// How each band celebrates: what the dragon does, and what goes with it.
type Celebration = {
  pose: DragonPose;
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

// The race between the learner's earlier self and today, and the words that
// follow it. The track is decorative, so a screen reader is left with the
// words alone; the two small dragons in it are hidden with it, so that they
// do not answer to the name the celebrating dragon goes by. The track holds
// its place from the first render and the styles keep the words a line high
// while they are empty, so that Home and Go again never move under a finger.
// The words are a live region, and the bolt before them is not read out.
function renderMoment(): { moment: HTMLElement; sayWords: () => void } {
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
    runner.append(renderDragon({ pose: 'sit' }));
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

export type EndOptions = {
  drill: Drill;
  // Whether the drill was faster than last time, which the moment shows and
  // the bonus has already been paid for (ADR 0004).
  faster: boolean;
  onHome: () => void;
  onAgain: () => void;
};

// Builds the end screen: the dragon, a heading, the tally of fast, slow and
// missed, the best streak, then Home and Go again. The dragon celebrates by
// the drill's band, and a run up plays that is longer for a higher band. A
// drill faster than last time runs the race 0.9 seconds into the
// celebration, and the words, the proud dragon and the improvement sweep
// follow it.
export function renderEnd(options: EndOptions): HTMLElement {
  const { drill } = options;

  const screen = document.createElement('main');
  screen.className = 'end';

  const band = bandOf(drill);
  const celebration = CELEBRATIONS[band];
  sound.end(band);
  const dragon = renderDragon(celebration);

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
  screen.append(dragon, heading, tally, best, actions);

  if (options.faster) {
    screen.classList.add('faster');
    const { moment, sayWords } = renderMoment();
    actions.before(moment);
    pending.push(
      schedule(() => moment.classList.add('go'), RACE_AT),
      schedule(() => {
        moment.classList.add('won');
        sayWords();
        dragon.replaceWith(renderDragon({ pose: 'proud', sparkles: 'breath' }));
        sound.faster();
      }, RACE_AT + RACE_RUN),
    );
  }

  if (celebration.confetti) screen.append(renderConfetti());
  return screen;
}

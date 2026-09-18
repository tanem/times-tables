import { DRILL_LENGTH, type Presentation } from '../model/drill';
import type { Outcome } from '../model/level';
import { now, onFrame, schedule } from '../time';

// How long the learner has to answer fast, in milliseconds.
const TIME_LIMIT = 3000;

export type CardOptions = {
  presentation: Presentation;
  // The number of this presentation in the drill, from 1.
  position: number;
  // Whether the card slides in, as the first card of a drill does.
  entering: boolean;
  onAnswer: (outcome: Outcome) => void;
  onQuit: () => void;
};

// Builds the card: the fact in its ordering, the 3-second bar beneath it,
// Missed and Got it in the thumb zone, and the quit cross and position in
// the top bar. Got it means fast until the bar drains and slow after. The
// answer is never shown.
export function renderCard(options: CardOptions): HTMLElement {
  const { presentation } = options;

  const screen = document.createElement('main');
  screen.className = options.entering ? 'card entering' : 'card';

  const top = document.createElement('header');
  top.className = 'top';

  const quit = document.createElement('button');
  quit.type = 'button';
  quit.className = 'quit';
  quit.setAttribute('aria-label', 'Quit');
  quit.textContent = '✕';

  const position = document.createElement('p');
  position.className = 'position';
  position.textContent = `${options.position} / ${DRILL_LENGTH}`;

  // Keeps the position centred by balancing the quit cross.
  const spacer = document.createElement('span');
  spacer.className = 'spacer';

  top.append(quit, position, spacer);

  const fact = document.createElement('h1');
  fact.className = 'fact';
  fact.textContent = `${presentation.x} × ${presentation.y}`;

  const bar = document.createElement('div');
  bar.className = 'bar';
  bar.setAttribute('role', 'progressbar');
  bar.setAttribute('aria-label', 'Time left');
  bar.setAttribute('aria-valuemin', '0');
  bar.setAttribute('aria-valuemax', '100');
  bar.setAttribute('aria-valuenow', '100');
  const fill = document.createElement('div');
  fill.className = 'fill';
  bar.append(fill);

  const caption = document.createElement('p');
  caption.className = 'caption';
  caption.textContent = 'Say it out loud';

  const answers = document.createElement('div');
  answers.className = 'answers';

  const missed = document.createElement('button');
  missed.type = 'button';
  missed.className = 'answer missed';
  missed.textContent = 'Missed';

  const got = document.createElement('button');
  got.type = 'button';
  got.className = 'answer fast';
  got.textContent = 'Got it';

  answers.append(missed, got);
  screen.append(top, fact, bar, caption, answers);

  // The bar measures wall-clock time from the card appearing. The frames
  // paint what is left, and a timer at the limit drains the bar even when
  // no frame lands on the limit. Once the limit has passed, Got it means
  // slow.
  const shownAt = now();
  const elapsed = () => now() - shownAt;
  const timeIsUp = () => elapsed() >= TIME_LIMIT;
  let drained = false;
  let cancelFrame = () => {};
  const paint = (left: number) => {
    fill.style.width = `${left * 100}%`;
    bar.setAttribute('aria-valuenow', String(Math.round(left * 100)));
  };
  const drain = () => {
    if (drained) return;
    drained = true;
    cancelFrame();
    // No time is left, and the bar shows it by refilling amber.
    bar.setAttribute('aria-valuenow', '0');
    fill.style.width = '100%';
    bar.classList.add('drained');
    got.classList.replace('fast', 'slow');
    caption.textContent = 'Time is up. Still say it, then tap.';
    caption.classList.add('warn');
  };
  const tick = () => {
    if (timeIsUp()) {
      drain();
      return;
    }
    paint(1 - elapsed() / TIME_LIMIT);
    cancelFrame = onFrame(tick);
  };
  cancelFrame = onFrame(tick);
  const cancelDrain = schedule(drain, TIME_LIMIT);

  let answered = false;
  const settle = (act: () => void) => {
    if (answered) return;
    answered = true;
    cancelFrame();
    cancelDrain();
    act();
  };
  got.addEventListener('click', () =>
    settle(() => options.onAnswer(timeIsUp() ? 'slow' : 'fast')),
  );
  missed.addEventListener('click', () =>
    settle(() => options.onAnswer('missed')),
  );
  quit.addEventListener('click', () => settle(options.onQuit));

  return screen;
}

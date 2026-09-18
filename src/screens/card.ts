import { DRILL_LENGTH, type Presentation } from '../model/drill';
import { TIME_LIMIT, timedOutcome, type Outcome } from '../model/level';
import { now, onFrame, schedule } from '../time';
import { cardFrame } from './cardframe';

export type CardOptions = {
  presentation: Presentation;
  // The number of this presentation in the drill, from 1.
  position: number;
  // Whether the card slides in, as the first card of a drill does.
  entering: boolean;
  onAnswer: (outcome: Outcome) => void;
  onQuit: () => void;
};

// Builds the drill card: the card frame with the position in the top bar
// and the 3-second bar beneath the fact. Got it means fast until the bar
// drains and slow after.
export function renderCard(options: CardOptions): HTMLElement {
  const position = document.createElement('p');
  position.className = 'position';
  position.textContent = `${options.position} / ${DRILL_LENGTH}`;

  // The bar measures wall-clock time from the card appearing. The frames
  // paint what is left, and a timer at the limit drains the bar even when
  // no frame lands on the limit. Once the limit has passed, Got it means
  // slow.
  const shownAt = now();
  const elapsed = () => now() - shownAt;
  let cancelFrame = () => {};
  let cancelDrain = () => {};
  const stop = () => {
    cancelFrame();
    cancelDrain();
  };

  const { screen, fact, caption, got } = cardFrame({
    presentation: options.presentation,
    entering: options.entering,
    middle: position,
    onGot: () => {
      stop();
      options.onAnswer(timedOutcome(true, elapsed()));
    },
    onMissed: () => {
      stop();
      options.onAnswer('missed');
    },
    onQuit: () => {
      stop();
      options.onQuit();
    },
  });

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
  fact.after(bar);

  let drained = false;
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
    if (elapsed() >= TIME_LIMIT) {
      drain();
      return;
    }
    paint(1 - elapsed() / TIME_LIMIT);
    cancelFrame = onFrame(tick);
  };
  cancelFrame = onFrame(tick);
  cancelDrain = schedule(drain, TIME_LIMIT);

  return screen;
}

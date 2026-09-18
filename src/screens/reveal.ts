import type { Presentation } from '../model/drill';
import { schedule } from '../time';
import { runClock } from './clock';

// How long the reveal holds, in milliseconds.
const HOLD = 1500;

export type RevealOptions = {
  presentation: Presentation;
  // The reading of the clock seam when the run started.
  startedAt: number;
  onDone: () => void;
  onQuit: () => void;
};

// Builds the miss reveal of a speed run: the missed fact with its answer in
// place of the card, under the same top bar, with the clock still running.
// It holds and then moves on by itself; a tap does not hurry it. A reveal
// taken off the page does not move on.
export function renderReveal(options: RevealOptions): HTMLElement {
  const { presentation } = options;

  const screen = document.createElement('main');
  screen.className = 'reveal';

  const top = document.createElement('header');
  top.className = 'top';

  const quit = document.createElement('button');
  quit.type = 'button';
  quit.className = 'quit';
  quit.setAttribute('aria-label', 'Quit');
  quit.textContent = '✕';
  quit.addEventListener('click', options.onQuit);

  // Keeps the clock centred by balancing the quit cross.
  const spacer = document.createElement('span');
  spacer.className = 'spacer';

  top.append(quit, runClock(options.startedAt), spacer);

  const sum = document.createElement('h1');
  sum.className = 'sum';
  sum.textContent = `${presentation.x} × ${presentation.y} = ${presentation.fact.product}`;

  screen.append(top, sum);

  schedule(() => {
    if (screen.isConnected) options.onDone();
  }, HOLD);

  return screen;
}

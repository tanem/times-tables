import { schedule } from '../time';

// How long each number of the countdown shows, in milliseconds.
const STEP = 1000;

export type CountdownOptions = {
  onDone: () => void;
};

// Builds the countdown before a speed run: 3, 2, 1, a second each, then
// done. A countdown taken off the page stops counting.
export function renderCountdown(options: CountdownOptions): HTMLElement {
  const screen = document.createElement('main');
  screen.className = 'countdown';

  const number = document.createElement('h1');
  number.setAttribute('aria-live', 'assertive');
  screen.append(number);

  const count = (left: number) => {
    number.textContent = String(left);
    schedule(() => {
      if (!screen.isConnected) return;
      if (left === 1) options.onDone();
      else count(left - 1);
    }, STEP);
  };
  count(3);

  return screen;
}

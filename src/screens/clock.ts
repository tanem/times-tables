import { formatTime } from '../model/speedrun';
import { now, onFrame } from '../time';

// Builds the run clock: the time since the run started, in tenths, painted
// on every frame. It stops by itself once its screen is off the page.
export function runClock(startedAt: number): HTMLElement {
  const clock = document.createElement('p');
  clock.className = 'clock';
  clock.setAttribute('role', 'timer');
  clock.setAttribute('aria-label', 'Time');

  const paint = () => {
    clock.textContent = formatTime(now() - startedAt);
  };
  const tick = () => {
    if (!clock.isConnected) return;
    paint();
    onFrame(tick);
  };
  paint();
  onFrame(tick);

  return clock;
}

import type { CompletedRun } from '../model/progress';
import { formatGap, formatTime } from '../model/speedrun';
import { renderConfetti, renderDragon } from './dragon';

export type RunEndOptions = {
  record: CompletedRun;
  // The personal best as it stood before this run, in milliseconds, or null
  // on a first completed run.
  previousBest: number | null;
  onDone: () => void;
  onAgain: () => void;
};

// What the end screen says of the time: a first completed run, a run faster
// than the best, or the gap to the best.
function runHeading(time: number, previousBest: number | null): string {
  if (previousBest === null) return 'Your first time!';
  if (time < previousBest) return 'New best!';
  return `${formatGap(time, previousBest)} off your best`;
}

// Builds the end screen of a completed speed run: the heading, the time
// large, the miss count, the best the run was up against small below, then
// Done and Run again.
export function renderRunEnd(options: RunEndOptions): HTMLElement {
  const { record, previousBest } = options;

  const screen = document.createElement('main');
  screen.className = 'end';

  // A first completed run and a new best get the loudest celebration in the
  // app; a slower run gets a warm wave.
  const best = previousBest === null || record.time < previousBest;
  const dragon = best
    ? renderDragon({ pose: 'proud', breath: true })
    : renderDragon({ pose: 'wave' });

  const heading = document.createElement('h1');
  heading.textContent = runHeading(record.time, previousBest);

  const time = document.createElement('p');
  time.className = 'time';
  time.textContent = formatTime(record.time);

  const misses = document.createElement('p');
  misses.className = 'misses';
  misses.textContent = `${record.missed} missed`;

  screen.append(dragon, heading, time, misses);

  if (previousBest !== null) {
    // After a faster run the best it beat is no longer the best.
    const label = record.time < previousBest ? 'Previous best' : 'Your best';
    const previous = document.createElement('p');
    previous.className = 'previous';
    previous.textContent = `${label} ${formatTime(previousBest)}`;
    screen.append(previous);
  }

  const actions = document.createElement('div');
  actions.className = 'actions';

  const done = document.createElement('button');
  done.type = 'button';
  done.className = 'action home';
  done.textContent = 'Done';
  done.addEventListener('click', options.onDone);

  const again = document.createElement('button');
  again.type = 'button';
  again.className = 'action again';
  again.textContent = 'Run again';
  again.addEventListener('click', options.onAgain);

  actions.append(done, again);
  screen.append(actions);
  if (best) screen.append(renderConfetti());
  return screen;
}

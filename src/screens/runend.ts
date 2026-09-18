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

// How a completed run stands against the personal best before it: the first
// completed run, a new best, or a slower run, with the best it was up
// against. A run that ties the best is a slower run.
type Standing =
  | { kind: 'first' }
  | { kind: 'new-best'; previousBest: number }
  | { kind: 'slower'; previousBest: number };

function standingOf(time: number, previousBest: number | null): Standing {
  if (previousBest === null) return { kind: 'first' };
  if (time < previousBest) return { kind: 'new-best', previousBest };
  return { kind: 'slower', previousBest };
}

// Builds the end screen of a completed speed run: the dragon, the heading,
// the time large, the miss count, the best the run was up against small
// below, then Done and Run again. After a first completed run or a new best
// the dragon stands proud and holds the pose, breathing sparkles, under
// confetti. After a slower run the dragon waves and the heading is the gap
// to the best.
export function renderRunEnd(options: RunEndOptions): HTMLElement {
  const { record } = options;
  const standing = standingOf(record.time, options.previousBest);

  const screen = document.createElement('main');
  screen.className = 'end';

  const dragon =
    standing.kind === 'slower'
      ? renderDragon({ pose: 'wave' })
      : renderDragon({ pose: 'proud', sparkles: 'breath' });

  const heading = document.createElement('h1');
  heading.textContent =
    standing.kind === 'first'
      ? 'Your first time!'
      : standing.kind === 'new-best'
        ? 'New best!'
        : `${formatGap(record.time, standing.previousBest)} off your best`;

  const time = document.createElement('p');
  time.className = 'time';
  time.textContent = formatTime(record.time);

  const misses = document.createElement('p');
  misses.className = 'misses';
  misses.textContent = `${record.missed} missed`;

  screen.append(dragon, heading, time, misses);

  if (standing.kind !== 'first') {
    // After a new best the best it beat is no longer the best.
    const label = standing.kind === 'new-best' ? 'Previous best' : 'Your best';
    const previous = document.createElement('p');
    previous.className = 'previous';
    previous.textContent = `${label} ${formatTime(standing.previousBest)}`;
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
  if (standing.kind !== 'slower') screen.append(renderConfetti());
  return screen;
}

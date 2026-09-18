import type { BuildInfo } from '../build';
import {
  bestLine,
  countsLine,
  gridRows,
  LEGEND,
  recentRows,
  weekLine,
  type DayOf,
} from '../model/report';
import type { Progress } from '../model/progress';
import { now, onFrame, type Day } from '../time';

export type ParentOptions = {
  progress: Progress;
  // The calendar day the screen opens on.
  today: Day;
  // Reads the local calendar day a stored timestamp falls on.
  dayOf: DayOf;
  build: BuildInfo;
  onBack: () => void;
  onErase: () => void;
};

const SVG_NS = 'http://www.w3.org/2000/svg';

// How long the erase control must be held before it fires.
const HOLD = 3000;

// The erase ring's radius and the stroke length it takes to go all the way
// round, in the SVG's own units.
const RING_RADIUS = 10;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

// Builds the erase ring: a plain track circle and a stroke circle whose
// dash offset renderErase moves from full circumference (empty) to zero
// (full) as the hold runs.
function renderRing(): { svg: SVGElement; setShare: (share: number) => void } {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'erase-ring');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = `
    <circle class="erase-ring-track" cx="12" cy="12" r="${RING_RADIUS}" />
    <circle class="erase-ring-fill" cx="12" cy="12" r="${RING_RADIUS}"
      stroke-dasharray="${RING_CIRCUMFERENCE}"
      stroke-dashoffset="${RING_CIRCUMFERENCE}" />
  `;
  const fill = svg.querySelector('.erase-ring-fill') as SVGElement;
  const setShare = (share: number) => {
    fill.style.strokeDashoffset = String(RING_CIRCUMFERENCE * (1 - share));
  };
  return { svg, setShare };
}

// Builds the press-and-hold erase control: a button labelled "Erase all
// progress" with the ring as its only decoration. Holding it for HOLD
// fires onErase exactly once; releasing early, the pointer leaving, or
// losing focus cancels and snaps the ring back to empty. A hold never
// picks up where an earlier one left off. The mouse, touch and keyboard
// (Space or Enter) all drive the same hold.
function renderErase(onErase: () => void): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'erase';

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'erase-button';

  const { svg: ring, setShare } = renderRing();
  const label = document.createElement('span');
  label.textContent = 'Erase all progress';
  button.append(ring, label);

  // The frame loop's own cancel, set while a hold is in progress and null
  // otherwise; cancel() below both stops it and resets the ring.
  let cancelFrame: (() => void) | null = null;

  function start(): void {
    if (cancelFrame) return;
    const startedAt = now();
    const tick = () => {
      if (!button.isConnected) {
        cancelFrame = null;
        return;
      }
      const elapsed = now() - startedAt;
      setShare(Math.min(elapsed / HOLD, 1));
      if (elapsed >= HOLD) {
        cancelFrame = null;
        onErase();
        return;
      }
      cancelFrame = onFrame(tick);
    };
    cancelFrame = onFrame(tick);
  }

  function cancel(): void {
    cancelFrame?.();
    cancelFrame = null;
    setShare(0);
  }

  button.addEventListener('pointerdown', (event) => {
    if (event.button === 0) start();
  });
  button.addEventListener('pointerup', cancel);
  button.addEventListener('pointercancel', cancel);
  button.addEventListener('pointerleave', cancel);
  // The iPad's long-press callout and text selection are not wanted here.
  button.addEventListener('contextmenu', (event) => event.preventDefault());
  button.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    if (event.key === ' ' || event.key === 'Enter') start();
  });
  button.addEventListener('keyup', cancel);
  button.addEventListener('blur', cancel);

  wrap.append(button);
  return wrap;
}

// Builds the fact grid: three rows of twelve cells, each a toggle button
// coloured and named by its level. Tapping a cell shows its lifetime counts
// in the given status line; tapping it again clears the line and tapping
// another replaces it.
function renderGrid(progress: Progress, status: HTMLElement): HTMLElement {
  const grid = document.createElement('div');
  grid.className = 'grid';

  let active: HTMLButtonElement | null = null;

  for (const row of gridRows(progress)) {
    const rowEl = document.createElement('div');
    rowEl.className = 'grid-row';
    rowEl.setAttribute('role', 'group');
    rowEl.setAttribute('aria-label', row.label);

    const label = document.createElement('span');
    label.className = 'row-label';
    label.textContent = row.label;
    label.setAttribute('aria-hidden', 'true');

    const cells = document.createElement('div');
    cells.className = 'cells';

    for (const cell of row.cells) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `cell level-${cell.level}`;
      button.textContent = cell.label;
      button.setAttribute('aria-label', cell.ariaLabel);
      button.setAttribute('aria-pressed', 'false');
      button.addEventListener('click', () => {
        if (active === button) {
          active.setAttribute('aria-pressed', 'false');
          active = null;
          status.textContent = '';
          return;
        }
        active?.setAttribute('aria-pressed', 'false');
        active = button;
        button.setAttribute('aria-pressed', 'true');
        status.textContent = countsLine(cell);
      });
      cells.append(button);
    }

    rowEl.append(label, cells);
    grid.append(rowEl);
  }

  return grid;
}

// The legend under the grid: the five levels, from new or missed to known,
// swatched in the grid's own colours. Plain divs, not a list: the recent
// list is the page's only list.
function renderLegend(): HTMLElement {
  const legend = document.createElement('div');
  legend.className = 'legend';

  for (const { level, label } of LEGEND) {
    const item = document.createElement('div');
    item.className = `legend-item level-${level}`;
    const swatch = document.createElement('span');
    swatch.className = 'swatch';
    swatch.setAttribute('role', 'img');
    swatch.setAttribute('aria-label', `Level ${level} colour`);
    const text = document.createElement('span');
    text.textContent = label;
    item.append(swatch, text);
    legend.append(item);
  }

  return legend;
}

// The recent list: the ten most recent drills and speed runs, newest
// first, or the empty state.
function renderRecent(
  progress: Progress,
  dayOf: DayOf,
  today: Day,
): HTMLElement {
  const rows = recentRows(progress.records, dayOf, today);
  if (rows.length === 0) {
    const empty = document.createElement('p');
    empty.textContent = 'No drills yet';
    return empty;
  }
  const list = document.createElement('ol');
  list.className = 'recent';
  for (const row of rows) {
    const item = document.createElement('li');
    item.textContent = row;
    list.append(item);
  }
  return list;
}

// Builds the Parent view: the fact grid with its legend and tap-for-
// counts, this week's practice, the recent list, the personal best, the
// press-and-hold erase control, and the build version in the foot.
// Read-only otherwise: plain typography, no dragon, and the erase ring is
// the screen's only animation.
export function renderParent(options: ParentOptions): HTMLElement {
  const { progress, today, dayOf, build } = options;

  const screen = document.createElement('main');
  screen.className = 'parent';

  const top = document.createElement('header');
  top.className = 'parent-top';

  const heading = document.createElement('h1');
  heading.textContent = 'Progress';

  const back = document.createElement('button');
  back.type = 'button';
  back.className = 'back';
  back.textContent = 'Back';
  back.addEventListener('click', options.onBack);

  top.append(heading, back);

  const status = document.createElement('p');
  status.className = 'counts';
  status.setAttribute('role', 'status');

  const grid = renderGrid(progress, status);
  const legend = renderLegend();

  const week = document.createElement('p');
  week.className = 'week';
  week.textContent = weekLine(progress.records, dayOf, today);

  const recentHeading = document.createElement('h2');
  recentHeading.textContent = 'Recent';
  const recent = renderRecent(progress, dayOf, today);

  const best = document.createElement('p');
  best.className = 'best';
  best.textContent = bestLine(progress, dayOf, today);

  const erase = renderErase(options.onErase);

  const foot = document.createElement('p');
  foot.className = 'foot';
  foot.textContent = `Version ${build.version} (${build.commit})`;

  screen.append(
    top,
    grid,
    legend,
    status,
    week,
    recentHeading,
    recent,
    best,
    erase,
    foot,
  );
  return screen;
}

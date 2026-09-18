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
import type { Day } from '../time';

export type ParentOptions = {
  progress: Progress;
  // The calendar day the screen opens on.
  today: Day;
  // Reads the local calendar day a stored timestamp falls on.
  dayOf: DayOf;
  build: BuildInfo;
  onBack: () => void;
};

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
// counts, this week's practice, the recent list, the personal best, and
// the build version in the foot. Read-only: plain typography, no dragon,
// no animation.
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
    foot,
  );
  return screen;
}

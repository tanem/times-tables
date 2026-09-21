import { DRILL_LENGTH } from '../model/drill';
import { TABLES, tablesList, type Table } from '../model/facts';
import { renderDragon } from './dragon';

export type StartOptions = {
  tables: readonly Table[];
  // The share of a table's facts at level 4, from 0 to 1, for its meter.
  knownShare: (table: Table) => number;
  // Called with the new selection, in table order, after every change.
  onTablesChange: (tables: Table[]) => void;
  // Called with the selection when the learner taps Practise.
  onPractise: (tables: Table[]) => void;
  onParents: () => void;
};

// The most tables the Practise caption lists by name; from one more it
// counts them.
const MOST_TABLES_LISTED = 3;

// What the Practise caption says for a selection: the drill's length and
// tables, or a prompt when nothing is on.
function practiseCaption(tables: readonly Table[]): string {
  if (tables.length === 0) return 'Pick a table to practise';
  if (tables.length === TABLES.length) {
    return `${DRILL_LENGTH} facts from all ${TABLES.length} tables`;
  }
  if (tables.length > MOST_TABLES_LISTED) {
    return `${DRILL_LENGTH} facts from ${tables.length} tables`;
  }
  return `${DRILL_LENGTH} facts from the ${tablesList(tables)}`;
}

function renderTile(name: string): HTMLButtonElement {
  const tile = document.createElement('button');
  tile.type = 'button';
  tile.className = 'tile';
  const label = document.createElement('span');
  label.textContent = name;
  tile.append(label);
  return tile;
}

// How well a table is known: a bar filled to the share, with no numbers. It
// is left out of the tile's name.
function renderMeter(share: number): HTMLElement {
  const meter = document.createElement('span');
  meter.className = 'meter';
  meter.setAttribute('aria-hidden', 'true');
  const fill = document.createElement('span');
  fill.style.width = `${share * 100}%`;
  meter.append(fill);
  return meter;
}

// Builds the Start screen. The dragon sits with the app's name at the top.
// The tiles keep the selection and the Practise button follows it. While
// nothing is on the screen nudges: the heading asks for a tap, the tiles
// pulse and the dragon waves.
export function renderStart(options: StartOptions): HTMLElement {
  const selected = new Set<Table>(options.tables);
  const selection = () => TABLES.filter((table) => selected.has(table));

  const screen = document.createElement('main');
  screen.className = 'start';

  const masthead = document.createElement('header');
  masthead.className = 'masthead';
  const title = document.createElement('h1');
  title.textContent = 'Times tables';
  masthead.append(title);

  const question = document.createElement('h2');
  question.id = 'which-tables';

  const tiles = document.createElement('div');
  tiles.className = 'tiles';
  tiles.setAttribute('role', 'group');
  tiles.setAttribute('aria-labelledby', question.id);

  const practise = document.createElement('button');
  practise.type = 'button';
  practise.className = 'practise';
  practise.textContent = 'Practise';
  practise.setAttribute('aria-describedby', 'practise-caption');
  practise.addEventListener('click', () => options.onPractise(selection()));

  const caption = document.createElement('p');
  caption.id = 'practise-caption';
  caption.className = 'caption';

  const tableTiles = new Map<Table, HTMLButtonElement>();
  // The twelfth cell, which fills the grid in both orientations.
  const all = renderTile('All');
  all.classList.add('all');

  // Reduced motion drops the wave, so the dragon sits and is named as
  // sitting.
  const nudgePose = window.matchMedia('(prefers-reduced-motion: reduce)')
    .matches
    ? 'sit'
    : 'beckon';

  // The dragon on screen, and whether the screen is nudging. Both are null
  // until the first update, which always draws them.
  let dragon: HTMLElement | null = null;
  let nudging: boolean | null = null;

  const update = () => {
    const tables = selection();
    for (const [table, tile] of tableTiles) {
      tile.setAttribute('aria-pressed', String(selected.has(table)));
    }
    all.setAttribute('aria-pressed', String(tables.length === TABLES.length));
    caption.textContent = practiseCaption(tables);
    practise.disabled = tables.length === 0;

    const nothingOn = tables.length === 0;
    if (nothingOn === nudging) return;
    nudging = nothingOn;
    question.textContent = nothingOn
      ? 'Tap the tables you want'
      : 'Which tables?';
    screen.classList.toggle('nudge', nothingOn);
    const next = renderDragon({ pose: nothingOn ? nudgePose : 'sit' });
    if (dragon) dragon.replaceWith(next);
    else masthead.prepend(next);
    dragon = next;
  };

  const changed = () => {
    update();
    options.onTablesChange(selection());
  };

  for (const table of TABLES) {
    const tile = renderTile(`${table}s`);
    tile.append(renderMeter(options.knownShare(table)));
    tile.addEventListener('click', () => {
      if (selected.has(table)) selected.delete(table);
      else selected.add(table);
      changed();
    });
    tableTiles.set(table, tile);
    tiles.append(tile);
  }

  // All switches every table on, or every table off when all are on.
  all.addEventListener('click', () => {
    const allOn = selection().length === TABLES.length;
    selected.clear();
    if (!allOn) for (const table of TABLES) selected.add(table);
    changed();
  });
  tiles.append(all);

  // A small text link, out of the way of the learner's own buttons, for a
  // parent to reach the Parent view on a plain tap.
  const parents = document.createElement('button');
  parents.type = 'button';
  parents.className = 'parents-link';
  parents.textContent = 'For parents';
  parents.addEventListener('click', options.onParents);

  update();
  screen.append(masthead, question, tiles, practise, caption, parents);
  return screen;
}

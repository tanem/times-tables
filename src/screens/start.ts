import {
  CHARACTERS,
  isUnlocked,
  UNLOCK_AT,
  type Character,
} from '../model/characters';
import { DRILL_LENGTH } from '../model/drill';
import { TABLES, tablesList, type Table } from '../model/facts';
import { renderCharacter } from './character';
import { renderGem } from './gem';

export type StartOptions = {
  tables: readonly Table[];
  // The share of a table's facts at level 4, from 0 to 1, for its meter.
  knownShare: (table: Table) => number;
  // The tables with a badge, which their tiles mark (ADR 0005).
  badges: readonly Table[];
  // The gems left to spend, which the corner shows, and the gems earned,
  // which the unlocks are read from (ADR 0005).
  balance: number;
  earned: number;
  character: Character;
  // Called with the new selection, in table order, after every change.
  onTablesChange: (tables: Table[]) => void;
  // Called with the character the learner tapped, one the earned total has
  // unlocked.
  onCharacterChange: (character: Character) => void;
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

// A badge, in the top right corner of its table's tile. The tile's name
// says so, so the mark itself is not read out.
function renderBadge(): HTMLElement {
  const badge = document.createElement('span');
  badge.className = 'badge';
  badge.setAttribute('aria-hidden', 'true');
  badge.textContent = '🏅';
  return badge;
}

// The balance, in the top right corner. The gem is a picture and the words
// say what it is.
function renderBalance(balance: number): HTMLElement {
  const line = document.createElement('p');
  line.className = 'gems';
  const count = document.createElement('b');
  count.textContent = String(balance);
  const word = document.createElement('span');
  word.className = 'gems-word';
  word.textContent = balance === 1 ? 'gem' : 'gems';
  line.append(renderGem(), count, ' ', word);
  return line;
}

function capitalised(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

// One character in the row: a small figure sitting still, pressed when it is
// the chosen one. A locked one is a grey silhouette with a lock and the
// earned total that unlocks it, and a tap on it does nothing. The button's
// name says which character it is, so the figure inside is hidden from a
// screen reader and does not answer to the masthead's name.
function renderPick(
  character: Character,
  earned: number,
  onPick: () => void,
): HTMLButtonElement {
  const unlocked = isUnlocked(character, earned);
  const name = capitalised(character);
  const pick = document.createElement('button');
  pick.type = 'button';
  pick.className = 'pick';
  const figure = renderCharacter({ character, pose: 'sit' });
  figure.setAttribute('aria-hidden', 'true');
  pick.append(figure);
  if (unlocked) {
    pick.setAttribute('aria-label', name);
    pick.addEventListener('click', onPick);
  } else {
    const needs = UNLOCK_AT[character];
    pick.classList.add('locked');
    pick.setAttribute('aria-label', `${name}, locked, ${needs} gems`);
    pick.setAttribute('aria-disabled', 'true');
    const lock = document.createElement('span');
    lock.className = 'lock';
    lock.setAttribute('aria-hidden', 'true');
    lock.textContent = `🔒 ${needs}`;
    pick.append(lock);
  }
  return pick;
}

// Builds the Start screen. The character sits with the app's name at the
// top, the row of characters under the name and the balance in the
// corner. The tiles keep the selection and the Practise button follows it.
// While nothing is on the screen nudges: the heading asks for a tap, the
// tiles pulse and the character waves.
export function renderStart(options: StartOptions): HTMLElement {
  const selected = new Set<Table>(options.tables);
  const selection = () => TABLES.filter((table) => selected.has(table));
  let character = options.character;

  const screen = document.createElement('main');
  screen.className = 'start';

  const masthead = document.createElement('header');
  masthead.className = 'masthead';
  const title = document.createElement('div');
  title.className = 'title';
  const name = document.createElement('h1');
  name.textContent = 'Times tables';

  const row = document.createElement('div');
  row.className = 'characters';
  row.setAttribute('role', 'group');
  row.setAttribute('aria-label', 'Your character');
  const picks = new Map<Character, HTMLButtonElement>();
  for (const candidate of CHARACTERS) {
    const pick = renderPick(candidate, options.earned, () => {
      if (candidate === character) return;
      character = candidate;
      drawCharacter();
      options.onCharacterChange(character);
    });
    picks.set(candidate, pick);
    row.append(pick);
  }

  title.append(name, row);
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

  // Reduced motion drops the wave, so the character sits and is named as
  // sitting.
  const nudgePose = window.matchMedia('(prefers-reduced-motion: reduce)')
    .matches
    ? 'sit'
    : 'beckon';

  // The character on the masthead, and whether the screen is nudging. Both
  // are null until the first update, which always draws them.
  let figure: HTMLElement | null = null;
  let nudging: boolean | null = null;

  // Draws the chosen character on the masthead, waving while the screen
  // nudges, and marks it as chosen in the row.
  const drawCharacter = () => {
    for (const [candidate, pick] of picks) {
      pick.setAttribute('aria-pressed', String(candidate === character));
    }
    const next = renderCharacter({
      character,
      pose: nudging ? nudgePose : 'sit',
    });
    if (figure) figure.replaceWith(next);
    else masthead.prepend(next);
    figure = next;
  };

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
    drawCharacter();
  };

  const changed = () => {
    update();
    options.onTablesChange(selection());
  };

  for (const table of TABLES) {
    const tile = renderTile(`${table}s`);
    tile.append(renderMeter(options.knownShare(table)));
    if (options.badges.includes(table)) {
      tile.setAttribute('aria-label', `${table}s, badge`);
      tile.append(renderBadge());
    }
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
  screen.append(
    renderBalance(options.balance),
    masthead,
    question,
    tiles,
    practise,
    caption,
    parents,
  );
  return screen;
}

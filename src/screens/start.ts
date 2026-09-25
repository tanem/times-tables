import { bondLevel, bondReading, type BondLevel } from '../model/bond';
import { itemOf, type HatId } from '../model/catalogue';
import {
  CHARACTERS,
  isUnlocked,
  UNLOCK_AT,
  type Character,
} from '../model/characters';
import { DRILL_LENGTH } from '../model/drill';
import { TABLES, tablesList, type Table } from '../model/facts';
import { renderBadge } from './badge';
import { renderCharacter, type Pose } from './character';
import { renderBalance } from './gem';
import { renderHat } from './hat';

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
  // The owned hats, in catalogue order, and the worn one, or none.
  hats: readonly HatId[];
  hat: HatId | null;
  // The finished drills done with each character, which its meter and its
  // pose on the masthead are read from.
  bond: Readonly<Record<Character, number>>;
  // Called with the new selection, in table order, after every change.
  onTablesChange: (tables: Table[]) => void;
  // Called with the character the learner tapped, one the earned total has
  // unlocked.
  onCharacterChange: (character: Character) => void;
  // Called with the hat the learner tapped, an owned one, or null for none.
  onHatChange: (hat: HatId | null) => void;
  // Called with the selection when the learner taps Practise.
  onPractise: (tables: Table[]) => void;
  onShop: () => void;
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

// A bar filled to the share, from 0 to 1.
function renderMeter(share: number): HTMLElement {
  const meter = document.createElement('span');
  meter.className = 'meter';
  const fill = document.createElement('span');
  fill.style.width = `${share * 100}%`;
  meter.append(fill);
  return meter;
}

// The pose the chosen character rests in on the masthead: sitting until its
// first bond pose opens, then the highest one open.
const BOND_POSES: Readonly<Record<BondLevel, Pose>> = {
  0: 'sit',
  1: 'wiggle',
  2: 'twirl',
  3: 'flip',
};

// How close the character's next bond pose is: a bar filled across the
// drills from the last threshold passed to the next, full once every pose
// is open. Its name says whose bond it is and its reading the drills done.
function renderBondMeter(character: Character, count: number): HTMLElement {
  const { from, to, now, share, full } = bondReading(count);
  const meter = renderMeter(share);
  meter.classList.add('bond-meter');
  meter.setAttribute('role', 'meter');
  meter.setAttribute('aria-label', `Bond with the ${character}`);
  meter.setAttribute('aria-valuemin', String(from));
  meter.setAttribute('aria-valuemax', String(to));
  meter.setAttribute('aria-valuenow', String(now));
  const drills = `${count} ${count === 1 ? 'drill' : 'drills'}`;
  meter.setAttribute(
    'aria-valuetext',
    full ? `${drills}, every pose open` : `${drills}, next pose at ${to}`,
  );
  return meter;
}

function capitalised(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

// One character in the row, pressed when it is the chosen one. An unlocked
// one's figure, a small one sitting still in the worn hat, is drawn by the
// row. A locked one is a grey silhouette with a lock and the
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
    pick.append(renderFigure(character, null), lock);
  }
  return pick;
}

// A small figure of the character sitting still, for a button whose name
// says which character it is: hidden from a screen reader, so that it does
// not answer to the masthead's name.
function renderFigure(character: Character, hat: HatId | null): HTMLElement {
  const figure = renderCharacter({ character, pose: 'sit', hat });
  figure.setAttribute('aria-hidden', 'true');
  return figure;
}

// One hat in the row of hats, or none for the button that takes the hat
// off, pressed when it is the worn one.
function renderHatPick(hat: HatId | null, onPick: () => void): HTMLElement {
  const pick = document.createElement('button');
  pick.type = 'button';
  pick.className = 'hat-pick';
  if (hat) {
    pick.setAttribute('aria-label', itemOf(hat).name);
    pick.append(renderHat(hat));
  } else {
    pick.setAttribute('aria-label', 'No hat');
    const none = document.createElement('span');
    none.className = 'no-hat';
    none.setAttribute('aria-hidden', 'true');
    none.textContent = '✕';
    pick.append(none);
  }
  pick.addEventListener('click', onPick);
  return pick;
}

// Builds the Start screen. The character is at the top with the app's name,
// in its highest open bond pose or sitting, over the meter of its bond; the
// row of characters is under the name, the row of owned hats under that once
// a hat is owned, the Shop in one corner and the balance in the other. The tiles keep the selection and the Practise button follows it.
// While nothing is on the screen nudges: the heading asks for a tap, the
// tiles pulse and the character waves.
export function renderStart(options: StartOptions): HTMLElement {
  const selected = new Set<Table>(options.tables);
  const selection = () => TABLES.filter((table) => selected.has(table));
  let character = options.character;
  let hat = options.hat;

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

  // The hats row: none, then each owned hat. It is left out until a hat is
  // owned, since none would be the only choice.
  const hatPicks = new Map<HatId | null, HTMLElement>();
  if (options.hats.length > 0) {
    const hats = document.createElement('div');
    hats.className = 'hats';
    hats.setAttribute('role', 'group');
    hats.setAttribute('aria-label', 'Your hat');
    for (const candidate of [null, ...options.hats]) {
      const pick = renderHatPick(candidate, () => {
        if (candidate === hat) return;
        hat = candidate;
        drawHat();
        drawCharacter();
        options.onHatChange(hat);
      });
      hatPicks.set(candidate, pick);
      hats.append(pick);
    }
    title.append(hats);
  }
  // The chosen character over the meter of its bond.
  const companion = document.createElement('div');
  companion.className = 'companion';
  masthead.append(companion, title);

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

  // Reduced motion drops the wave and the bond poses, so the character sits
  // and is named as sitting.
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Whether the screen is nudging: null until the first update, which always
  // draws the character.
  let nudging: boolean | null = null;

  // Dresses every unlocked character in the row in the worn hat, and marks
  // the hat as chosen in its row.
  const drawHat = () => {
    for (const [candidate, pick] of picks) {
      if (isUnlocked(candidate, options.earned)) {
        pick.replaceChildren(renderFigure(candidate, hat));
      }
    }
    for (const [candidate, pick] of hatPicks) {
      pick.setAttribute('aria-pressed', String(candidate === hat));
    }
  };

  // Draws the chosen character on the masthead in the worn hat over the
  // meter of its bond, waving while the screen nudges and in its bond pose
  // otherwise, and marks it as chosen in the row.
  const drawCharacter = () => {
    for (const [candidate, pick] of picks) {
      pick.setAttribute('aria-pressed', String(candidate === character));
    }
    const count = options.bond[character];
    const pose: Pose = still
      ? 'sit'
      : nudging
        ? 'beckon'
        : BOND_POSES[bondLevel(count)];
    companion.replaceChildren(
      renderCharacter({ character, pose, hat }),
      renderBondMeter(character, count),
    );
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
    // How well the table is known, with no numbers: the bar is left out of
    // the tile's name.
    const known = renderMeter(options.knownShare(table));
    known.setAttribute('aria-hidden', 'true');
    tile.append(known);
    // A badge sits in the tile's top right corner, and the tile's name
    // says so.
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

  // The way to the Shop, in the top left corner across from the balance.
  const shop = document.createElement('button');
  shop.type = 'button';
  shop.className = 'shop-link';
  const bag = document.createElement('span');
  bag.setAttribute('aria-hidden', 'true');
  bag.textContent = '🛍️';
  shop.append(bag, ' Shop');
  shop.addEventListener('click', options.onShop);

  drawHat();
  update();
  screen.append(
    shop,
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

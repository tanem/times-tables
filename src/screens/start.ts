import { DRILL_LENGTH } from '../model/drill';
import { FACTS, TABLES, type Table } from '../model/facts';
import { formatTime } from '../model/speedrun';
import { renderDragon } from './dragon';

export type StartOptions = {
  tables: readonly Table[];
  // Called with the new selection, in table order, after every toggle.
  onTablesChange: (tables: Table[]) => void;
  // Called with the selection when the learner taps Practise.
  onPractise: (tables: Table[]) => void;
  // The personal best in milliseconds, or null before any completed run.
  best: number | null;
  onSpeedRun: () => void;
  onParents: () => void;
};

// What the Practise caption says for a selection: the drill's length and
// tables, or a prompt when nothing is on.
function practiseCaption(tables: readonly Table[]): string {
  if (tables.length === 0) return 'Pick a table to practise';
  if (tables.length === TABLES.length) {
    return `${DRILL_LENGTH} facts from all three tables`;
  }
  const names = tables.map((table) => `${table}s`).join(' and ');
  return `${DRILL_LENGTH} facts from the ${names}`;
}

// Builds the Start screen. The dragon sits with the app's name at the top.
// The tiles keep the selection and the Practise button follows it. The
// Speed run button takes no notice of the selection and has the personal
// best beside it.
export function renderStart(options: StartOptions): HTMLElement {
  const selected = new Set<Table>(options.tables);
  const selection = () => TABLES.filter((table) => selected.has(table));

  const screen = document.createElement('main');
  screen.className = 'start';

  const masthead = document.createElement('header');
  masthead.className = 'masthead';
  const title = document.createElement('h1');
  title.textContent = 'Times tables';
  masthead.append(renderDragon({ pose: 'sit' }), title);

  const question = document.createElement('h2');
  question.id = 'which-tables';
  question.textContent = 'Which tables?';

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

  const update = () => {
    const tables = selection();
    caption.textContent = practiseCaption(tables);
    practise.disabled = tables.length === 0;
  };

  for (const table of TABLES) {
    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = 'tile';
    tile.textContent = `${table}s`;
    tile.setAttribute('aria-pressed', String(selected.has(table)));
    tile.addEventListener('click', () => {
      if (selected.has(table)) selected.delete(table);
      else selected.add(table);
      tile.setAttribute('aria-pressed', String(selected.has(table)));
      update();
      options.onTablesChange(selection());
    });
    tiles.append(tile);
  }

  const speed = document.createElement('div');
  speed.className = 'speed';

  const speedRun = document.createElement('button');
  speedRun.type = 'button';
  speedRun.className = 'speed-run';
  speedRun.textContent = 'Speed run';
  speedRun.setAttribute('aria-describedby', 'speed-run-caption');
  speedRun.addEventListener('click', options.onSpeedRun);

  const best = document.createElement('p');
  best.id = 'speed-run-caption';
  best.className = 'caption';
  best.textContent =
    options.best === null
      ? `all ${FACTS.length} facts, no best yet`
      : `Best ${formatTime(options.best)}`;

  speed.append(speedRun, best);

  // A small text link, out of the way of the learner's own buttons, for a
  // parent to reach the Progress screen on a plain tap.
  const parents = document.createElement('button');
  parents.type = 'button';
  parents.className = 'parents-link';
  parents.textContent = 'For parents';
  parents.addEventListener('click', options.onParents);

  update();
  screen.append(masthead, question, tiles, practise, caption, speed, parents);
  return screen;
}

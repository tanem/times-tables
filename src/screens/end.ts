import type { Drill } from '../model/drill';

export type EndOptions = {
  drill: Drill;
  onHome: () => void;
  onAgain: () => void;
};

// Builds the end screen: a heading, the tally of fast, slow and missed, the
// best streak, then Home and Go again.
export function renderEnd(options: EndOptions): HTMLElement {
  const { drill } = options;

  const screen = document.createElement('main');
  screen.className = 'end';

  const heading = document.createElement('h1');
  heading.textContent = drill.quit
    ? 'Stopped early. Still counts!'
    : 'Drill done!';

  const tally = document.createElement('div');
  tally.className = 'tally';
  for (const [outcome, label] of [
    ['fast', 'Fast'],
    ['slow', 'Slow'],
    ['missed', 'Missed'],
  ] as const) {
    const item = document.createElement('p');
    item.className = `tally-item ${outcome}`;
    const count = document.createElement('b');
    count.textContent = String(drill[outcome]);
    item.append(count, ` ${label}`);
    tally.append(item);
  }

  const best = document.createElement('p');
  best.className = 'best';
  best.textContent = `Best streak: ${drill.bestStreak}`;

  const actions = document.createElement('div');
  actions.className = 'actions';

  const home = document.createElement('button');
  home.type = 'button';
  home.className = 'action home';
  home.textContent = 'Home';
  home.addEventListener('click', options.onHome);

  const again = document.createElement('button');
  again.type = 'button';
  again.className = 'action again';
  again.textContent = 'Go again';
  again.addEventListener('click', options.onAgain);

  actions.append(home, again);
  screen.append(heading, tally, best, actions);
  return screen;
}

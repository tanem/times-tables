import type { Presentation } from '../model/drill';

export type CardFrameOptions = {
  presentation: Presentation;
  // Whether the card slides in, as the first card of a drill does.
  entering: boolean;
  // What sits in the middle of the top bar, opposite the quit cross.
  middle: HTMLElement;
  onGot: () => void;
  onMissed: () => void;
  onQuit: () => void;
};

export type CardFrame = {
  screen: HTMLElement;
  fact: HTMLElement;
  caption: HTMLElement;
  got: HTMLButtonElement;
};

// Builds the top bar of a card: the quit cross on the left and the given
// element in the middle.
export function topBar(middle: HTMLElement): {
  top: HTMLElement;
  quit: HTMLButtonElement;
} {
  const top = document.createElement('header');
  top.className = 'top';

  const quit = document.createElement('button');
  quit.type = 'button';
  quit.className = 'quit';
  quit.setAttribute('aria-label', 'Quit');
  quit.textContent = '✕';

  // Keeps the middle centred by balancing the quit cross.
  const spacer = document.createElement('span');
  spacer.className = 'spacer';

  top.append(quit, middle, spacer);
  return { top, quit };
}

// Builds what the drill card and the run card share: the quit cross in the
// top bar, the fact in its ordering, the caption, and Missed and Got it in
// the thumb zone. The answer is never shown. Only the first tap on Got it,
// Missed or the quit cross acts.
export function cardFrame(options: CardFrameOptions): CardFrame {
  const { presentation } = options;

  const screen = document.createElement('main');
  screen.className = options.entering ? 'card entering' : 'card';

  const { top, quit } = topBar(options.middle);

  const fact = document.createElement('h1');
  fact.className = 'fact';
  fact.textContent = `${presentation.x} × ${presentation.y}`;

  const caption = document.createElement('p');
  caption.className = 'caption';
  caption.textContent = 'Say it out loud';

  const answers = document.createElement('div');
  answers.className = 'answers';

  const missed = document.createElement('button');
  missed.type = 'button';
  missed.className = 'answer missed';
  missed.textContent = 'Missed';

  const got = document.createElement('button');
  got.type = 'button';
  got.className = 'answer fast';
  got.textContent = 'Got it';

  answers.append(missed, got);
  screen.append(top, fact, caption, answers);

  let settled = false;
  const settle = (act: () => void) => () => {
    if (settled) return;
    settled = true;
    act();
  };
  got.addEventListener('click', settle(options.onGot));
  missed.addEventListener('click', settle(options.onMissed));
  quit.addEventListener('click', settle(options.onQuit));

  return { screen, fact, caption, got };
}

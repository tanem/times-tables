import { DRILL_LENGTH, type Presentation } from '../model/drill';
import { answerTime } from '../model/pace';
import { now } from '../time';

// The most digits an answer can hold: no product of the tables is longer.
const MAX_DIGITS = 3;

export type CardOptions = {
  presentation: Presentation;
  // The number of this presentation in the drill, from 1.
  position: number;
  // Whether the card slides in, as the first card of a drill does.
  entering: boolean;
  // Whether the answer given was right, and how long the presentation took.
  onAnswer: (right: boolean, time: number) => void;
  onQuit: () => void;
};

// Builds the top bar of the card: the quit cross on the left and the
// position in the middle.
function topBar(position: HTMLElement): {
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

  // Keeps the position centred by balancing the quit cross.
  const spacer = document.createElement('span');
  spacer.className = 'spacer';

  top.append(quit, position, spacer);
  return { top, quit };
}

// Builds one key of the pad. Keys act on the press, not the release, so that
// a finger that slides a little still types. Only a touch or the main mouse
// button presses a key. A click carrying no pointer press of its own
// (detail 0) is a keyboard activation of the focused key, which acts too.
function padKey(
  label: string,
  className: string,
  act: () => void,
): HTMLButtonElement {
  const key = document.createElement('button');
  key.type = 'button';
  key.className = className;
  key.textContent = label;
  key.addEventListener('pointerdown', (event) => {
    if (event.button === 0) act();
  });
  key.addEventListener('click', (event) => {
    if (event.detail === 0) act();
  });
  return key;
}

// Builds the drill card: the fact with the slot the typed digits land on and
// a 3 × 4 phone pad, under the fact in portrait and beside it in landscape.
// The answer is never shown. Enter grades the answer and ends the answer
// time; a wrong answer is missed at once. Only the first of Enter, "I don't
// know" and the quit cross acts.
export function renderCard(options: CardOptions): HTMLElement {
  const { presentation } = options;

  const screen = document.createElement('main');
  screen.className = options.entering ? 'card entering' : 'card';

  const position = document.createElement('p');
  position.className = 'position';
  position.textContent = `${options.position} / ${DRILL_LENGTH}`;
  const { top, quit } = topBar(position);

  const fact = document.createElement('h1');
  fact.className = 'fact';
  fact.textContent = `${presentation.x} × ${presentation.y}`;

  const slot = document.createElement('div');
  slot.className = 'slot';
  slot.setAttribute('role', 'status');
  slot.setAttribute('aria-label', 'Your answer');

  const dontKnow = document.createElement('button');
  dontKnow.type = 'button';
  dontKnow.className = 'dont-know';
  dontKnow.textContent = "I don't know";

  // The clock starts as the card is built and stops on Enter, so the answer
  // time covers the typing as well as the recall.
  const shownAt = now();
  let typed = '';
  // A card built while the app is in the background, as the feedback's hold
  // can do, only ever sees the app come back, so it starts out backgrounded.
  let backgrounded = document.visibilityState === 'hidden';
  let settled = false;

  const paint = () => {
    slot.textContent = typed;
    enter.disabled = typed === '';
  };

  // The card settles once, on an answer, on giving up or on the quit cross,
  // and stops watching for the app leaving as it does.
  const settle = (act: () => void) => {
    if (settled) return;
    settled = true;
    document.removeEventListener('visibilitychange', onHidden);
    act();
  };

  const finish = (right: boolean) =>
    settle(() =>
      options.onAnswer(right, answerTime(now() - shownAt, backgrounded)),
    );

  const type = (digit: string) => {
    if (settled || typed.length >= MAX_DIGITS) return;
    typed += digit;
    paint();
  };

  const remove = () => {
    if (settled) return;
    typed = typed.slice(0, -1);
    paint();
  };

  // The typed answer is read as a number, so that a leading zero does not
  // make a right answer wrong.
  const submit = () => {
    if (settled || typed === '') return;
    finish(Number(typed) === presentation.fact.product);
  };

  const del = padKey('⌫', 'key delete', remove);
  del.setAttribute('aria-label', 'Delete');
  const enter = padKey('✓', 'key enter', submit);
  enter.setAttribute('aria-label', 'Enter');

  const pad = document.createElement('div');
  pad.className = 'pad';
  for (const digit of '123456789') {
    pad.append(padKey(digit, 'key', () => type(digit)));
  }
  pad.append(
    del,
    padKey('0', 'key', () => type('0')),
    enter,
  );

  // "I don't know" and the quit cross are not keypad keys: they act on a
  // tap, so that a finger grazing one on its way to the pad does not give up
  // or leave the drill.
  dontKnow.addEventListener('click', () => finish(false));
  quit.addEventListener('click', () => settle(options.onQuit));

  // A presentation the app went to the background during is timed at the
  // cap, whatever the clock says (ADR 0002).
  const onHidden = () => {
    if (document.visibilityState === 'hidden') backgrounded = true;
  };
  document.addEventListener('visibilitychange', onHidden);

  const question = document.createElement('div');
  question.className = 'question';
  question.append(fact, slot, dontKnow);

  const body = document.createElement('div');
  body.className = 'card-body';
  body.append(question, pad);

  screen.append(top, body);
  paint();
  return screen;
}

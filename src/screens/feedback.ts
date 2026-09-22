import type { Character } from '../model/characters';
import type { Presentation } from '../model/drill';
import type { Outcome } from '../model/level';
import { sound } from '../sound';
import { schedule } from '../time';
import { renderCharacter, type Pose } from './character';

// The words for each outcome, shown in turn.
const WORDS: Readonly<Record<Outcome, readonly string[]>> = {
  fast: ['Fast!', 'Zoom!', 'Yes!'],
  slow: ['Got there!', 'You got it', 'Nice'],
  missed: ['Next time', 'Tricky one', 'Keep going'],
};

// What the character does for each outcome.
const POSES: Readonly<Record<Outcome, Pose>> = {
  fast: 'jump',
  slow: 'nod',
  missed: 'shrug',
};

// How long the feedback holds before moving on by itself, in milliseconds.
const HOLD: Readonly<Record<Outcome, number>> = {
  fast: 2000,
  slow: 2000,
  missed: 2500,
};

// The word for the nth outcome of its kind in a drill, counting from 1.
function feedbackWord(outcome: Outcome, nth: number): string {
  const words = WORDS[outcome];
  return words[(nth - 1) % words.length] ?? '';
}

export type FeedbackOptions = {
  presentation: Presentation;
  outcome: Outcome;
  character: Character;
  // How many of this outcome the drill has had, this one included.
  nth: number;
  // Consecutive fast outcomes, this one included.
  streak: number;
  onAdvance: () => void;
};

// Builds the feedback screen: the fact with its answer, the character, a word,
// and the streak from two fast answers in a row, with a sound for the
// outcome. It holds for a moment, and a tap anywhere moves on at once.
export function renderFeedback(options: FeedbackOptions): HTMLElement {
  const { presentation, outcome } = options;

  const screen = document.createElement('main');
  screen.className = `feedback ${outcome}`;

  const sum = document.createElement('h1');
  sum.className = 'sum';
  sum.textContent = `${presentation.x} × ${presentation.y} = ${presentation.fact.product}`;

  const word = document.createElement('p');
  word.className = 'word';
  word.textContent = feedbackWord(outcome, options.nth);

  // After a right answer the character stands between the sum and the
  // word, the biggest thing on screen. After a miss the styles put it small
  // in the top corner and the sum is the biggest thing.
  const figure = renderCharacter({
    character: options.character,
    pose: POSES[outcome],
    sparkles: outcome === 'fast' ? 'burst' : undefined,
  });
  screen.append(sum, figure, word);

  if (outcome === 'fast' && options.streak >= 2) {
    const streak = document.createElement('p');
    streak.className = 'streak';
    const flame = document.createElement('span');
    flame.setAttribute('aria-hidden', 'true');
    flame.textContent = '🔥';
    streak.append(flame, ` ${options.streak} in a row`);
    screen.append(streak);
  }

  // A fast answer sounds a step higher for each answer in the streak.
  if (outcome === 'fast') sound.fast(options.streak);
  else sound[outcome]();

  const hint = document.createElement('p');
  hint.className = 'hint';
  hint.textContent = 'Tap to go on';
  screen.append(hint);

  // The screen leaves once, by the hold or by a tap.
  let left = false;
  const advance = () => {
    if (left) return;
    left = true;
    cancel();
    options.onAdvance();
  };
  const cancel = schedule(advance, HOLD[outcome]);

  // Enter on the card acts on the press, so the release of that same touch
  // lands a click here the moment the screen goes up. A tap moves on only
  // once this screen has seen the press behind it.
  let pressed = false;
  screen.addEventListener('pointerdown', () => {
    pressed = true;
  });
  screen.addEventListener('click', () => {
    if (pressed) advance();
  });

  return screen;
}

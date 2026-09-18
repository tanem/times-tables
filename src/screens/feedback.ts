import type { Presentation } from '../model/drill';
import type { Outcome } from '../model/level';
import { schedule } from '../time';

// The words for each outcome, shown in turn.
const WORDS: Readonly<Record<Outcome, readonly string[]>> = {
  fast: ['Fast!', 'Zoom!', 'Yes!'],
  slow: ['Got there!', 'You got it', 'Nice'],
  missed: ['Next time', 'Tricky one', 'Keep going'],
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
  // How many of this outcome the drill has had, this one included.
  nth: number;
  // Consecutive fast outcomes, this one included.
  streak: number;
  onAdvance: () => void;
};

// Builds the feedback screen: the fact with its answer, a word, and the
// streak from two fast answers in a row. It holds for a moment, and a tap
// anywhere moves on at once.
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

  screen.append(sum, word);

  if (outcome === 'fast' && options.streak >= 2) {
    const streak = document.createElement('p');
    streak.className = 'streak';
    const flame = document.createElement('span');
    flame.setAttribute('aria-hidden', 'true');
    flame.textContent = '🔥';
    streak.append(flame, ` ${options.streak} in a row`);
    screen.append(streak);
  }

  const hint = document.createElement('p');
  hint.className = 'hint';
  hint.textContent = 'Tap to go on';
  screen.append(hint);

  let advanced = false;
  const advance = () => {
    if (advanced) return;
    advanced = true;
    cancel();
    options.onAdvance();
  };
  const cancel = schedule(advance, HOLD[outcome]);
  screen.addEventListener('click', advance);

  return screen;
}

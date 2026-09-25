import type { ColourId, HatId } from '../model/catalogue';
import type { Character } from '../model/characters';
import type { Presentation } from '../model/drill';
import type { Outcome } from '../model/level';
import { sound } from '../sound';
import { schedule } from '../time';
import { renderCharacter, type Pose } from './character';
import { renderGem } from './gem';

// The words for each outcome, shown in turn.
const WORDS: Readonly<Record<Outcome, readonly string[]>> = {
  fast: ['Fast!', 'Zoom!', 'Yes!'],
  slow: ['Got there!', 'You got it', 'Nice'],
  missed: ['Next time', 'Tricky one', 'Keep going'],
};

// What the character does for each outcome, but for a fast answer once
// the backflip is owned, which plays the backflip in place of the jump.
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

// How long after the feedback shows the gem it paid shows, in milliseconds:
// once the fast answer's sound has rung, so that the chime follows it.
const GEM_AT = 300;

// The word for the nth outcome of its kind in a drill, counting from 1.
function feedbackWord(outcome: Outcome, nth: number): string {
  const words = WORDS[outcome];
  return words[(nth - 1) % words.length] ?? '';
}

export type FeedbackOptions = {
  presentation: Presentation;
  outcome: Outcome;
  character: Character;
  // The worn hat, or none, and the character's colour, a variant or none
  // for its own.
  hat: HatId | null;
  colour: ColourId | null;
  // How many of this outcome the drill has had, this one included.
  nth: number;
  // Consecutive fast outcomes, this one included.
  streak: number;
  // Whether the answer paid a gem (ADR 0004), which only a fast one can.
  gem: boolean;
  // Whether the learner owns the backflip, which a fast answer then plays
  // in place of the jump.
  backflip: boolean;
  onAdvance: () => void;
};

// The line for the gem an answer paid, under the word. It is empty, and so
// says nothing to a screen reader, until the gem shows; it keeps a line's
// height meanwhile, so nothing under it moves. Every fast feedback has the
// line, filled or not, so the character and the word sit in the same place
// whether or not the answer paid.
function renderGemPaid(): { line: HTMLElement; show: () => void } {
  const line = document.createElement('p');
  line.className = 'gem-paid';
  line.setAttribute('role', 'status');
  return {
    line,
    show: () => {
      line.append(renderGem(), '+1 gem');
      line.classList.add('shown');
    },
  };
}

// Builds the feedback screen: the fact with its answer, the character, a word,
// and the streak from two fast answers in a row, with a sound for the
// outcome. An answer that paid a gem shows it under the word 0.3 seconds
// in, with the chime, once the fast answer's sound has rung. It holds for a
// moment, and a tap anywhere moves on at once, taking a gem still to show
// with it.
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
    pose: outcome === 'fast' && options.backflip ? 'backflip' : POSES[outcome],
    hat: options.hat,
    colour: options.colour,
    sparkles: outcome === 'fast' ? 'burst' : undefined,
  });
  screen.append(sum, figure, word);

  // Leaving the screen takes a gem still to show with it, so that its chime
  // does not sound over the card that follows.
  let cancelGem = () => {};
  if (outcome === 'fast') {
    const { line, show } = renderGemPaid();
    screen.append(line);
    if (options.gem) {
      cancelGem = schedule(() => {
        show();
        sound.gem();
      }, GEM_AT);
    }
  }

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
    cancelGem();
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

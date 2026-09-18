import type { Presentation } from '../model/drill';
import { timedOutcome, type Outcome } from '../model/level';
import { now } from '../time';
import { cardFrame } from './cardframe';
import { runClock } from './clock';

export type RunCardOptions = {
  presentation: Presentation;
  // The reading of the clock seam when the run started.
  startedAt: number;
  onAnswer: (outcome: Outcome) => void;
  onQuit: () => void;
};

// Builds the run card: the card frame with the run clock in the top bar, no
// bar and no position. The answer is timed against the limit from the card
// appearing without showing it, so Got it never turns amber.
export function renderRunCard(options: RunCardOptions): HTMLElement {
  const shownAt = now();
  const { screen } = cardFrame({
    presentation: options.presentation,
    entering: false,
    middle: runClock(options.startedAt),
    onGot: () => options.onAnswer(timedOutcome(true, now() - shownAt)),
    onMissed: () => options.onAnswer('missed'),
    onQuit: options.onQuit,
  });
  return screen;
}

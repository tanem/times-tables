import { schedule } from '../time';

// What the dragon is doing. Each pose is a CSS animation that plays once,
// except sit, which bobs for as long as it is on screen, beckon, which waves
// every few seconds with a rest between, and proud, which the dragon moves
// into and holds.
export type DragonPose =
  | 'sit'
  | 'jump'
  | 'nod'
  | 'shrug'
  | 'big-jump'
  | 'hop'
  | 'wave'
  | 'beckon'
  | 'proud';

// What each pose is called, for a learner who cannot see it.
const LABELS: Readonly<Record<DragonPose, string>> = {
  sit: 'The dragon',
  jump: 'The dragon jumps',
  nod: 'The dragon nods',
  shrug: 'The dragon shrugs',
  'big-jump': 'The dragon jumps high',
  hop: 'The dragon hops',
  wave: 'The dragon waves',
  beckon: 'The dragon waves',
  proud: 'The dragon stands proud',
};

const SVG_NS = 'http://www.w3.org/2000/svg';

// The dragon, facing the learner, drawn back to front. The right wing and
// arm are the left ones mirrored, each inside a plain group that carries the
// mirror so that the CSS animations can transform the part itself.
const WING =
  '<path class="wing" fill="#ff9f5a" stroke="#d9773a" stroke-width="3" stroke-linejoin="round" d="M66 124 C52 100 32 84 12 82 C17 94 19 103 29 110 C23 113 21 120 25 128 C34 123 41 125 47 132 C52 129 59 130 66 136 Z"/>';
const ARM =
  '<ellipse cx="60" cy="140" rx="10" ry="18" fill="#4cb87a" stroke="#2f8f5b" stroke-width="3" transform="rotate(14 60 140)"/>';
const MIRROR = 'transform="translate(200 0) scale(-1 1)"';
const DRAGON = `
  <g>${WING}</g>
  <g ${MIRROR}>${WING}</g>
  <path fill="#4cb87a" stroke="#2f8f5b" stroke-width="3" stroke-linejoin="round" d="M134 170 C166 178 190 160 182 132 L191 130 L177 114 L168 134 L176 133 C180 150 164 160 140 152 Z"/>
  <ellipse cx="76" cy="186" rx="19" ry="9" fill="#4cb87a" stroke="#2f8f5b" stroke-width="3"/>
  <ellipse cx="124" cy="186" rx="19" ry="9" fill="#4cb87a" stroke="#2f8f5b" stroke-width="3"/>
  <ellipse cx="100" cy="146" rx="46" ry="43" fill="#4cb87a" stroke="#2f8f5b" stroke-width="3"/>
  <ellipse cx="100" cy="154" rx="29" ry="30" fill="#ffe8a3"/>
  <path fill="none" stroke="#e8c877" stroke-width="3" stroke-linecap="round" d="M80 146 Q100 154 120 146 M77 160 Q100 168 123 160 M82 173 Q100 180 118 173"/>
  <g class="arm-left">${ARM}</g>
  <g ${MIRROR}><g class="arm-right">${ARM}</g></g>
  <g class="head">
    <path fill="#ff9f5a" stroke="#d9773a" stroke-width="3" stroke-linejoin="round" d="M86 40 L93 22 L100 36 L107 22 L114 40 Z"/>
    <path fill="#ffe8a3" stroke="#e8c877" stroke-width="3" stroke-linejoin="round" d="M64 50 Q58 28 70 20 Q80 32 80 44 Z"/>
    <path fill="#ffe8a3" stroke="#e8c877" stroke-width="3" stroke-linejoin="round" d="M136 50 Q142 28 130 20 Q120 32 120 44 Z"/>
    <ellipse cx="100" cy="76" rx="47" ry="40" fill="#4cb87a" stroke="#2f8f5b" stroke-width="3"/>
    <ellipse cx="100" cy="92" rx="30" ry="18" fill="#7fd6a4"/>
    <circle cx="66" cy="88" r="7" fill="#ff9aa2" opacity="0.7"/>
    <circle cx="134" cy="88" r="7" fill="#ff9aa2" opacity="0.7"/>
    <circle cx="80" cy="64" r="12" fill="#ffffff" stroke="#2f8f5b" stroke-width="2"/>
    <circle cx="120" cy="64" r="12" fill="#ffffff" stroke="#2f8f5b" stroke-width="2"/>
    <circle cx="82" cy="65" r="6.5" fill="#2b2d42"/>
    <circle cx="118" cy="65" r="6.5" fill="#2b2d42"/>
    <circle cx="84.5" cy="62.5" r="2.2" fill="#ffffff"/>
    <circle cx="120.5" cy="62.5" r="2.2" fill="#ffffff"/>
    <circle cx="91" cy="86" r="2.5" fill="#2f8f5b"/>
    <circle cx="109" cy="86" r="2.5" fill="#2f8f5b"/>
    <path fill="none" stroke="#2b2d42" stroke-width="3" stroke-linecap="round" d="M86 96 Q100 108 114 96"/>
  </g>
`;

// How long sparkles stay before they are taken away, in milliseconds. The
// styles have the last sparkle faded by then.
const SPARKLES_STAY = 1300;

// How many pieces of confetti fall, and how long the confetti stays before
// it is taken away, in milliseconds. The slowest piece has fallen by then.
const CONFETTI_COUNT = 24;
const CONFETTI_STAY = 2400;

// How the dragon's sparkles fly: a burst all round it, or a breath out to
// one side.
export type SparkleKind = 'burst' | 'breath';

// Where a sparkle ends up from the middle of the dragon, as fractions of the
// dragon's size.
type Offset = { dx: number; dy: number };

type Sparkles = {
  // What the sparkles are called, for a learner who cannot see them.
  label: string;
  count: number;
  // Where sparkle i of count ends up.
  offset: (i: number, count: number) => Offset;
};

const SPARKLES: Readonly<Record<SparkleKind, Sparkles>> = {
  // Evenly round the dragon from straight up, wider than tall and lifted a
  // little so that each sparkle ends clear of it.
  burst: {
    label: 'Sparkles',
    count: 5,
    offset: (i, count) => {
      const angle = (i / count - 0.25) * Math.PI * 2;
      return { dx: Math.cos(angle) * 0.8, dy: Math.sin(angle) * 0.6 - 0.1 };
    },
  },
  // Out to one side and up, each later sparkle a little higher and the
  // distances mixed. Like the confetti's pieces, the sparkles are spread by
  // their index and not at random.
  breath: {
    label: 'Sparkle breath',
    count: 6,
    offset: (i, count) => ({
      dx: 0.45 + (((i * 5) % count) / count) * 0.6,
      dy: -0.1 - (i / count) * 0.3,
    }),
  },
};

// Sparkles flying out from the middle of the dragon, where its mouth is.
// They take themselves away once they have faded.
function renderSparkles(kind: SparkleKind): HTMLElement {
  const { label, count, offset } = SPARKLES[kind];
  const sparkles = document.createElement('div');
  sparkles.className = 'sparkles';
  sparkles.setAttribute('role', 'img');
  sparkles.setAttribute('aria-label', label);
  for (let i = 0; i < count; i++) {
    const { dx, dy } = offset(i, count);
    const sparkle = document.createElement('span');
    sparkle.className = 'sparkle';
    sparkle.style.setProperty('--i', String(i));
    sparkle.style.setProperty('--dx', dx.toFixed(3));
    sparkle.style.setProperty('--dy', dy.toFixed(3));
    sparkles.append(sparkle);
  }
  schedule(() => sparkles.remove(), SPARKLES_STAY);
  return sparkles;
}

export type DragonOptions = {
  pose: DragonPose;
  // The sparkles the dragon gives off, if any.
  sparkles?: SparkleKind;
};

// Builds the dragon in the given pose, inside a box the screen's styles
// size and place.
export function renderDragon(options: DragonOptions): HTMLElement {
  const stage = document.createElement('div');
  stage.className = 'dragon-stage';

  const dragon = document.createElementNS(SVG_NS, 'svg');
  dragon.setAttribute('class', `dragon ${options.pose}`);
  dragon.setAttribute('viewBox', '0 0 200 200');
  dragon.setAttribute('role', 'img');
  dragon.setAttribute('aria-label', LABELS[options.pose]);
  dragon.innerHTML = DRAGON;

  stage.append(dragon);
  if (options.sparkles) stage.append(renderSparkles(options.sparkles));
  return stage;
}

// Builds the confetti, falling once over the whole screen. The pieces are
// spread by their index, not at random, so that a celebration draws nothing
// from the drill's random numbers. The confetti takes itself away once it
// has fallen.
export function renderConfetti(): HTMLElement {
  const confetti = document.createElement('div');
  confetti.className = 'confetti';
  confetti.setAttribute('role', 'img');
  confetti.setAttribute('aria-label', 'Confetti');
  for (let i = 0; i < CONFETTI_COUNT; i++) {
    const piece = document.createElement('span');
    piece.className = `piece colour-${i % 4}`;
    piece.style.left = `${(i * 41 + 7) % 100}%`;
    piece.style.animationDelay = `${((i * 7) % 10) * 0.04}s`;
    piece.style.animationDuration = `${1.2 + ((i * 3) % 8) * 0.1}s`;
    confetti.append(piece);
  }
  schedule(() => confetti.remove(), CONFETTI_STAY);
  return confetti;
}

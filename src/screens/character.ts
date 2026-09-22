import type { Character } from '../model/characters';
import { schedule } from '../time';

// What the character is doing. Each pose is a CSS animation that plays once,
// except sit, which bobs for as long as it is on screen, beckon, which waves
// every few seconds with a rest between, and proud, which the character
// moves into and holds.
export type Pose =
  | 'sit'
  | 'jump'
  | 'nod'
  | 'shrug'
  | 'big-jump'
  | 'hop'
  | 'wave'
  | 'beckon'
  | 'proud';

// What each pose is called, after the character's name, for a learner who
// cannot see it.
const DOING: Readonly<Record<Pose, string>> = {
  sit: '',
  jump: ' jumps',
  nod: ' nods',
  shrug: ' shrugs',
  'big-jump': ' jumps high',
  hop: ' hops',
  wave: ' waves',
  beckon: ' waves',
  proud: ' stands proud',
};

const SVG_NS = 'http://www.w3.org/2000/svg';

// Every character is drawn on the same 200 × 200 box, facing the learner,
// back to front, with the same moving parts under the same class names:
// head, arm-left, arm-right and wing. The styles animate the parts, so every
// pose plays on every character. A character without wings flaps its ears,
// or whatever stands in for them.

const MIRROR = 'transform="translate(200 0) scale(-1 1)"';

type Colours = { fill: string; stroke: string; belly: string };

// Both of a part: the left one as drawn and the right one mirrored. The
// mirror sits on a plain group so that the styles can transform the part
// itself. A right class replaces the part's own, for the arms.
function pair(part: string, rightClass?: string): string {
  const right = rightClass
    ? part.replace(/class="[^"]*"/, `class="${rightClass}"`)
    : part;
  return `<g>${part}</g><g ${MIRROR}>${right}</g>`;
}

// A part that flaps when the character jumps, as the dragon's wings do.
function flaps(part: string): string {
  return `<g class="wing">${part}</g>`;
}

function arms({ fill, stroke }: Colours, rx = 10, ry = 18): string {
  return pair(
    `<g class="arm-left"><ellipse cx="60" cy="140" rx="${rx}" ry="${ry}" fill="${fill}" stroke="${stroke}" stroke-width="3" transform="rotate(14 60 140)"/></g>`,
    'arm-right',
  );
}

function feet({ fill, stroke }: Colours): string {
  return `
    <ellipse cx="76" cy="186" rx="19" ry="9" fill="${fill}" stroke="${stroke}" stroke-width="3"/>
    <ellipse cx="124" cy="186" rx="19" ry="9" fill="${fill}" stroke="${stroke}" stroke-width="3"/>`;
}

function body({ fill, stroke, belly }: Colours): string {
  return `
    <ellipse cx="100" cy="146" rx="46" ry="43" fill="${fill}" stroke="${stroke}" stroke-width="3"/>
    <ellipse cx="100" cy="154" rx="29" ry="30" fill="${belly}"/>`;
}

function skull({ fill, stroke }: Colours): string {
  return `<ellipse cx="100" cy="76" rx="47" ry="40" fill="${fill}" stroke="${stroke}" stroke-width="3"/>`;
}

function eyes(stroke: string): string {
  return `
    <circle cx="80" cy="64" r="12" fill="#ffffff" stroke="${stroke}" stroke-width="2"/>
    <circle cx="120" cy="64" r="12" fill="#ffffff" stroke="${stroke}" stroke-width="2"/>
    <circle cx="82" cy="65" r="6.5" fill="#2b2d42"/>
    <circle cx="118" cy="65" r="6.5" fill="#2b2d42"/>
    <circle cx="84.5" cy="62.5" r="2.2" fill="#ffffff"/>
    <circle cx="120.5" cy="62.5" r="2.2" fill="#ffffff"/>`;
}

const CHEEKS = `
  <circle cx="66" cy="88" r="7" fill="#ff9aa2" opacity="0.7"/>
  <circle cx="134" cy="88" r="7" fill="#ff9aa2" opacity="0.7"/>`;

// A tail as a stroked curve with an outline.
function tail({ fill, stroke }: Colours, d: string): string {
  return `
    <path fill="none" stroke="${stroke}" stroke-width="18" stroke-linecap="round" d="${d}"/>
    <path fill="none" stroke="${fill}" stroke-width="12" stroke-linecap="round" d="${d}"/>`;
}

function dragon(): string {
  const colours = { fill: '#4cb87a', stroke: '#2f8f5b', belly: '#ffe8a3' };
  const wing =
    '<path class="wing" fill="#ff9f5a" stroke="#d9773a" stroke-width="3" stroke-linejoin="round" d="M66 124 C52 100 32 84 12 82 C17 94 19 103 29 110 C23 113 21 120 25 128 C34 123 41 125 47 132 C52 129 59 130 66 136 Z"/>';
  return `
    ${pair(wing)}
    <path fill="${colours.fill}" stroke="${colours.stroke}" stroke-width="3" stroke-linejoin="round" d="M134 170 C166 178 190 160 182 132 L191 130 L177 114 L168 134 L176 133 C180 150 164 160 140 152 Z"/>
    ${feet(colours)}${body(colours)}
    <path fill="none" stroke="#e8c877" stroke-width="3" stroke-linecap="round" d="M80 146 Q100 154 120 146 M77 160 Q100 168 123 160 M82 173 Q100 180 118 173"/>
    ${arms(colours)}
    <g class="head">
      <path fill="#ff9f5a" stroke="#d9773a" stroke-width="3" stroke-linejoin="round" d="M86 40 L93 22 L100 36 L107 22 L114 40 Z"/>
      <path fill="#ffe8a3" stroke="#e8c877" stroke-width="3" stroke-linejoin="round" d="M64 50 Q58 28 70 20 Q80 32 80 44 Z"/>
      <path fill="#ffe8a3" stroke="#e8c877" stroke-width="3" stroke-linejoin="round" d="M136 50 Q142 28 130 20 Q120 32 120 44 Z"/>
      ${skull(colours)}
      <ellipse cx="100" cy="92" rx="30" ry="18" fill="#7fd6a4"/>
      ${CHEEKS}${eyes(colours.stroke)}
      <circle cx="91" cy="86" r="2.5" fill="${colours.stroke}"/>
      <circle cx="109" cy="86" r="2.5" fill="${colours.stroke}"/>
      <path fill="none" stroke="#2b2d42" stroke-width="3" stroke-linecap="round" d="M86 96 Q100 108 114 96"/>
    </g>`;
}

function cat(): string {
  const colours = { fill: '#f7a552', stroke: '#c9722a', belly: '#fff1d6' };
  const ear = `
    <path fill="${colours.fill}" stroke="${colours.stroke}" stroke-width="3" stroke-linejoin="round" d="M60 56 L56 14 L92 40 Z"/>
    <path fill="#ff9aa2" d="M64 46 L62 26 L80 40 Z"/>`;
  const whiskers = `<path fill="none" stroke="${colours.stroke}" stroke-width="2" stroke-linecap="round" d="M40 82 L62 86 M40 94 L62 92"/>`;
  return `
    ${tail(colours, 'M136 172 C172 178 190 150 176 116')}
    ${feet(colours)}${body(colours)}${arms(colours)}
    <g class="head">
      ${pair(flaps(ear))}
      ${skull(colours)}
      <ellipse cx="100" cy="92" rx="24" ry="15" fill="${colours.belly}"/>
      ${CHEEKS}${eyes(colours.stroke)}
      ${pair(whiskers)}
      <path fill="#ff7a8a" d="M94 84 L106 84 L100 91 Z"/>
      <path fill="none" stroke="#2b2d42" stroke-width="3" stroke-linecap="round" d="M88 98 Q94 104 100 96 Q106 104 112 98"/>
    </g>`;
}

function robot(): string {
  const colours = { fill: '#9fb4cc', stroke: '#5b7391', belly: '#e3edf7' };
  const arm = `<rect class="arm-left" x="44" y="118" width="18" height="44" rx="9" fill="${colours.fill}" stroke="${colours.stroke}" stroke-width="3"/>`;
  const bolt = `<rect x="44" y="64" width="10" height="22" rx="4" fill="#ffc93c" stroke="#d99a00" stroke-width="2"/>`;
  return `
    <rect x="60" y="176" width="32" height="18" rx="7" fill="${colours.fill}" stroke="${colours.stroke}" stroke-width="3"/>
    <rect x="108" y="176" width="32" height="18" rx="7" fill="${colours.fill}" stroke="${colours.stroke}" stroke-width="3"/>
    <rect x="58" y="106" width="84" height="78" rx="18" fill="${colours.fill}" stroke="${colours.stroke}" stroke-width="3"/>
    <rect x="74" y="124" width="52" height="40" rx="9" fill="${colours.belly}" stroke="${colours.stroke}" stroke-width="2"/>
    <circle cx="87" cy="138" r="5" fill="#de5a52"/>
    <circle cx="100" cy="138" r="5" fill="#ffc93c"/>
    <circle cx="113" cy="138" r="5" fill="#2f9e44"/>
    <path stroke="${colours.stroke}" stroke-width="3" stroke-linecap="round" d="M84 153 H116"/>
    ${pair(arm, 'arm-right')}
    <g class="head">
      <path stroke="${colours.stroke}" stroke-width="4" stroke-linecap="round" d="M100 36 V16"/>
      <circle cx="100" cy="13" r="7" fill="#de5a52" stroke="#a83c36" stroke-width="2"/>
      ${pair(flaps(bolt))}
      <rect x="54" y="36" width="92" height="76" rx="20" fill="${colours.fill}" stroke="${colours.stroke}" stroke-width="3"/>
      <circle cx="80" cy="66" r="13" fill="#21314a"/>
      <circle cx="120" cy="66" r="13" fill="#21314a"/>
      <circle cx="80" cy="66" r="7" fill="#6fe3ff"/>
      <circle cx="120" cy="66" r="7" fill="#6fe3ff"/>
      <circle cx="82.5" cy="63.5" r="2.2" fill="#ffffff"/>
      <circle cx="122.5" cy="63.5" r="2.2" fill="#ffffff"/>
      <rect x="80" y="90" width="40" height="12" rx="6" fill="#21314a"/>
      <path stroke="#6fe3ff" stroke-width="2" d="M90 91 V101 M100 91 V101 M110 91 V101"/>
    </g>`;
}

function owl(): string {
  const colours = { fill: '#b07c55', stroke: '#7a5234', belly: '#f6e3c5' };
  const wings = { ...colours, fill: '#8d5f3e' };
  const talons = { ...colours, fill: '#f2a33a', stroke: '#c47a1c' };
  const tuft = `<path fill="${colours.fill}" stroke="${colours.stroke}" stroke-width="3" stroke-linejoin="round" d="M62 52 L54 18 L88 40 Z"/>`;
  return `
    ${feet(talons)}${body(colours)}
    <path fill="none" stroke="#e0c08f" stroke-width="3" stroke-linecap="round" d="M84 142 l6 6 l6 -6 M104 142 l6 6 l6 -6 M94 158 l6 6 l6 -6 M84 172 l6 6 l6 -6 M104 172 l6 6 l6 -6"/>
    ${arms(wings, 14, 26)}
    <g class="head">
      ${pair(flaps(tuft))}
      ${skull(colours)}
      <circle cx="80" cy="68" r="19" fill="${colours.belly}" stroke="${colours.stroke}" stroke-width="2"/>
      <circle cx="120" cy="68" r="19" fill="${colours.belly}" stroke="${colours.stroke}" stroke-width="2"/>
      <circle cx="81" cy="69" r="9" fill="#2b2d42"/>
      <circle cx="119" cy="69" r="9" fill="#2b2d42"/>
      <circle cx="84.5" cy="65.5" r="3" fill="#ffffff"/>
      <circle cx="122.5" cy="65.5" r="3" fill="#ffffff"/>
      <path fill="#f2a33a" stroke="#c47a1c" stroke-width="2" stroke-linejoin="round" d="M92 84 L108 84 L100 100 Z"/>
    </g>`;
}

function unicorn(): string {
  const colours = { fill: '#ffffff', stroke: '#b3a9d9', belly: '#ffe3f1' };
  const ear = `<path fill="${colours.fill}" stroke="${colours.stroke}" stroke-width="3" stroke-linejoin="round" d="M64 50 Q56 26 68 16 Q82 30 82 44 Z"/>`;
  return `
    ${tail({ ...colours, fill: '#ff8fc7', stroke: '#c95fa0' }, 'M138 170 C172 176 188 150 178 120')}
    ${feet({ ...colours, fill: '#c9b8f0', stroke: '#8f7cc9' })}
    ${body(colours)}${arms(colours)}
    <g class="head">
      <path fill="#ffc93c" stroke="#d99a00" stroke-width="3" stroke-linejoin="round" d="M100 0 L89 42 L111 42 Z"/>
      <path fill="none" stroke="#d99a00" stroke-width="2" d="M96 16 L105 22 M93 28 L108 34"/>
      ${pair(flaps(ear))}
      <circle cx="58" cy="60" r="14" fill="#b58cf0"/>
      <circle cx="52" cy="82" r="13" fill="#ff8fc7"/>
      <circle cx="58" cy="104" r="11" fill="#6fcbff"/>
      ${skull(colours)}
      <circle cx="76" cy="40" r="12" fill="#ff8fc7"/>
      <circle cx="92" cy="36" r="10" fill="#b58cf0"/>
      <ellipse cx="100" cy="94" rx="27" ry="16" fill="${colours.belly}"/>
      ${CHEEKS}${eyes(colours.stroke)}
      <path fill="none" stroke="#2b2d42" stroke-width="2" stroke-linecap="round" d="M68 54 L63 49 M132 54 L137 49"/>
      <circle cx="92" cy="90" r="2.5" fill="#c95fa0"/>
      <circle cx="108" cy="90" r="2.5" fill="#c95fa0"/>
      <path fill="none" stroke="#2b2d42" stroke-width="3" stroke-linecap="round" d="M90 99 Q100 107 110 99"/>
    </g>`;
}

function monster(): string {
  const colours = { fill: '#a57be8', stroke: '#6b41b0', belly: '#e2d3fa' };
  const wing = `<path class="wing" fill="#ff8fc7" stroke="#c95fa0" stroke-width="3" stroke-linejoin="round" d="M66 126 C54 106 38 96 20 96 C25 106 27 112 35 117 C30 120 29 126 33 132 C40 128 46 130 51 136 C55 133 61 134 66 138 Z"/>`;
  const horn = `<path fill="#fff1d6" stroke="#d9b877" stroke-width="3" stroke-linejoin="round" d="M66 48 Q54 30 60 14 Q78 24 82 42 Z"/>`;
  return `
    ${pair(wing)}
    ${feet(colours)}${body(colours)}
    <circle cx="84" cy="176" r="4" fill="#c9b0f2"/>
    <circle cx="118" cy="170" r="5" fill="#c9b0f2"/>
    ${arms(colours)}
    <g class="head">
      ${pair(horn)}
      ${skull(colours)}
      <circle cx="62" cy="70" r="5" fill="#8a5dd6"/>
      <circle cx="140" cy="62" r="4" fill="#8a5dd6"/>
      <circle cx="100" cy="62" r="21" fill="#ffffff" stroke="${colours.stroke}" stroke-width="2"/>
      <circle cx="102" cy="64" r="11" fill="#2b2d42"/>
      <circle cx="106" cy="60" r="3.5" fill="#ffffff"/>
      <path fill="#4a2a80" stroke="#2b2d42" stroke-width="3" stroke-linejoin="round" d="M74 92 Q100 118 126 92 Z"/>
      <path fill="#ffffff" d="M86 94 L92 102 L98 94 Z M104 94 L110 102 L116 94 Z"/>
    </g>`;
}

const ART: Readonly<Record<Character, () => string>> = {
  dragon,
  cat,
  robot,
  owl,
  unicorn,
  monster,
};

// How long sparkles stay before they are taken away, in milliseconds. The
// styles have the last sparkle faded by then.
const SPARKLES_STAY = 1300;

// How many pieces of confetti fall, and how long the confetti stays before
// it is taken away, in milliseconds. The slowest piece has fallen by then.
const CONFETTI_COUNT = 24;
const CONFETTI_STAY = 2400;

// How the character's sparkles fly: a burst all round it, or a breath out
// to one side.
export type SparkleKind = 'burst' | 'breath';

// Where a sparkle ends up from the middle of the character, as fractions of
// the character's size.
type Offset = { dx: number; dy: number };

type Sparkles = {
  // What the sparkles are called, for a learner who cannot see them.
  label: string;
  count: number;
  // Where sparkle i of count ends up.
  offset: (i: number, count: number) => Offset;
};

const SPARKLES: Readonly<Record<SparkleKind, Sparkles>> = {
  // Evenly round the character from straight up, wider than tall and lifted
  // a little so that each sparkle ends clear of it.
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

// Sparkles flying out from the middle of the character, where its mouth is.
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

export type CharacterOptions = {
  character: Character;
  pose: Pose;
  // The sparkles the character gives off, if any.
  sparkles?: SparkleKind;
};

// Builds the character in the given pose, inside a box the screen's styles
// size and place.
export function renderCharacter(options: CharacterOptions): HTMLElement {
  const stage = document.createElement('div');
  stage.className = 'character-stage';

  const figure = document.createElementNS(SVG_NS, 'svg');
  figure.setAttribute('class', `character ${options.pose}`);
  figure.setAttribute('viewBox', '0 0 200 200');
  figure.setAttribute('role', 'img');
  figure.setAttribute(
    'aria-label',
    `The ${options.character}${DOING[options.pose]}`,
  );
  figure.innerHTML = ART[options.character]();

  stage.append(figure);
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

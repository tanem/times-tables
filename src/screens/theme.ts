import type { ThemeId } from '../model/catalogue';

// The colours the stylesheet reads, each as a custom property of the same
// name: --paper, --ink and the rest.
export type Colour =
  // The page, and the text on it: body text and the quieter captions.
  | 'paper'
  | 'ink'
  | 'muted'
  // The tiles, the outlined buttons and the digits typed on the card.
  | 'tile'
  // The buttons that go on, and the darker edge under Enter.
  | 'go'
  | 'go-edge'
  // The three outcomes.
  | 'fast'
  | 'slow'
  | 'missed'
  // The empty part of a meter and the rules and outlines.
  | 'track'
  | 'sparkle'
  // The fill of the meter under the character on the Start screen.
  | 'bond'
  // The words beside a gem paid, on the feedback and the end screen, and a
  // price in the Shop.
  | 'gem-paid'
  // The face of a key, a tile, an item and an outlined button, and of a key
  // while it is pressed.
  | 'surface'
  | 'pressed'
  // The face of a chosen pick or item.
  | 'chosen'
  // The chip the balance and a character's lock sit on.
  | 'gem-bg'
  // The text and the marks on a filled tile or button.
  | 'on-fill';

// One set of the app's colours. A dark scheme also tells the browser to
// draw its own controls dark, and the stylesheet to light up what it draws
// in black.
export type Palette = {
  scheme: 'light' | 'dark';
  colours: Record<Colour, `#${string}`>;
};

// The default colours, which the Parent view always keeps, and each
// theme's. Every text colour keeps at least the contrast the default gives
// it on each background it sits on, or 4.5:1 (theme.test.ts). A theme added
// to the catalogue needs its palette here.
export const PALETTES: Record<'default' | ThemeId, Palette> = {
  default: {
    scheme: 'light',
    colours: {
      paper: '#fffaf0',
      ink: '#2b2d42',
      muted: '#6b7280',
      tile: '#4c6ef5',
      go: '#2f9e44',
      'go-edge': '#237a34',
      fast: '#2f9e44',
      slow: '#e39a1e',
      missed: '#de5a52',
      track: '#dce2f0',
      sparkle: '#ffc93c',
      bond: '#e64980',
      'gem-paid': '#a86f00',
      surface: '#ffffff',
      pressed: '#eef1fb',
      chosen: '#e7ecff',
      'gem-bg': '#fff3cf',
      'on-fill': '#ffffff',
    },
  },
  // Sea blues and teals on a pale sea.
  ocean: {
    scheme: 'light',
    colours: {
      paper: '#e6f4f8',
      ink: '#0c2d3d',
      muted: '#4a6473',
      tile: '#0268a0',
      go: '#0b7a6a',
      'go-edge': '#075a4e',
      fast: '#0b7a6a',
      slow: '#b76a00',
      missed: '#c23d2e',
      track: '#bcdde8',
      sparkle: '#ffd43b',
      bond: '#d6336c',
      'gem-paid': '#8a5800',
      surface: '#ffffff',
      pressed: '#e3f1f7',
      chosen: '#d3ebf5',
      'gem-bg': '#fff1c9',
      'on-fill': '#ffffff',
    },
  },
  // Pale stars and planets on a night sky.
  space: {
    scheme: 'dark',
    colours: {
      paper: '#151a3b',
      ink: '#eef1ff',
      muted: '#aab2dd',
      tile: '#9db0ff',
      go: '#5fd08a',
      'go-edge': '#3a9e62',
      fast: '#5fd08a',
      slow: '#ffb454',
      missed: '#ff8a80',
      track: '#39407a',
      sparkle: '#ffe066',
      bond: '#ff7eb6',
      'gem-paid': '#ffc94d',
      surface: '#222961',
      pressed: '#2d3575',
      chosen: '#353e86',
      'gem-bg': '#3a3360',
      'on-fill': '#151a3b',
    },
  },
};

// Sets the theme's colours on an element, for it and everything in it: the
// default's for null. On the document's root it colours the whole app.
export function applyTheme(element: HTMLElement, theme: ThemeId | null): void {
  const { scheme, colours } = PALETTES[theme ?? 'default'];
  for (const [colour, value] of Object.entries(colours)) {
    element.style.setProperty(`--${colour}`, value);
  }
  element.style.colorScheme = scheme;
  element.dataset.scheme = scheme;
}

// A small picture of a theme: its page with a tile and a button on it, in
// its own colours, hidden from a screen reader since the button it sits on
// names the theme.
export function renderSwatch(theme: ThemeId | null): HTMLElement {
  const swatch = document.createElement('span');
  swatch.className = 'swatch-theme';
  swatch.setAttribute('aria-hidden', 'true');
  applyTheme(swatch, theme);
  const tile = document.createElement('span');
  tile.className = 'swatch-tile';
  const go = document.createElement('span');
  go.className = 'swatch-go';
  swatch.append(tile, go);
  return swatch;
}

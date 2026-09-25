import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CATALOGUE } from '../model/catalogue';
import { PALETTES, type Token } from './theme';

// The relative luminance of a #rrggbb colour, as WCAG 2 defines it.
function luminance(hex: string): number {
  const linear = (at: number) => {
    const channel = parseInt(hex.slice(at, at + 2), 16) / 255;
    return channel <= 0.03928
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(1) + 0.7152 * linear(3) + 0.0722 * linear(5);
}

// The contrast ratio between two colours, from 1 to 21.
function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

// Every colour of text the stylesheet sets, each on every background the
// stylesheet puts it on.
const TEXT_ON: readonly [text: Token, background: Token][] = [
  ['ink', 'paper'],
  ['muted', 'paper'],
  ['tile', 'paper'],
  ['gem-paid', 'paper'],
  ['fast', 'paper'],
  ['slow', 'paper'],
  ['missed', 'paper'],
  ['ink', 'surface'],
  ['muted', 'surface'],
  ['tile', 'surface'],
  ['gem-paid', 'surface'],
  ['go', 'surface'],
  ['ink', 'chosen'],
  ['muted', 'chosen'],
  ['gem-paid', 'chosen'],
  ['go', 'chosen'],
  ['ink', 'gem-bg'],
  ['on-fill', 'tile'],
  ['on-fill', 'go'],
  ['on-fill', 'muted'],
];

// The ratio WCAG AA asks of body text.
const AA = 4.5;

describe('PALETTES', () => {
  it('has a palette for the default and for each theme in the catalogue', () => {
    const themes = CATALOGUE.filter((item) => item.kind === 'theme');
    expect(Object.keys(PALETTES).sort()).toEqual(
      ['default', ...themes.map((item) => item.id)].sort(),
    );
  });

  it("matches the stylesheet's :root, which colours the page before the app runs", () => {
    const sheet = readFileSync(
      new URL('../style.css', import.meta.url),
      'utf8',
    );
    const root = /:root \{([^}]*)\}/.exec(sheet)?.[1] ?? '';
    const declared = new Map(
      [...root.matchAll(/--([a-z-]+): (#[0-9a-f]{6});/g)].map(
        ([, token, value]) => [token, value],
      ),
    );
    for (const [token, value] of Object.entries(PALETTES.default.colours)) {
      expect(declared.get(token), token).toBe(value);
    }
  });

  it('gives every colour as #rrggbb', () => {
    for (const palette of Object.values(PALETTES)) {
      for (const value of Object.values(palette.colours)) {
        expect(value).toMatch(/^#[0-9a-f]{6}$/);
      }
    }
  });

  // A theme may keep a pair the default keeps under AA, but never lower.
  it.each(Object.keys(PALETTES))(
    'keeps text in %s at least as legible as the default, or at AA',
    (theme) => {
      const { colours } = PALETTES[theme as keyof typeof PALETTES];
      const plain = PALETTES.default.colours;
      for (const [text, background] of TEXT_ON) {
        const floor = Math.min(contrast(plain[text], plain[background]), AA);
        const ratio = contrast(colours[text], colours[background]);
        expect(ratio, `${text} on ${background}`).toBeGreaterThanOrEqual(floor);
      }
    },
  );
});

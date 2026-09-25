import { describe, expect, it } from 'vitest';
import { CATALOGUE, CROWN, isItemId, itemOf, SET } from './catalogue';

describe('the catalogue', () => {
  it('lists hats at 40 and the crown, colour variants at 25, themes at 60, then the pose at 100, in kind order', () => {
    const prices = CATALOGUE.map(({ kind, price }) => [kind, price]);
    expect(prices).toEqual([
      ['hat', 40],
      ['hat', 40],
      ['hat', 40],
      ['hat', 40],
      ['hat', 40],
      ['hat', 40],
      ['hat', null],
      ['colour', 25],
      ['colour', 25],
      ['colour', 25],
      ['colour', 25],
      ['theme', 60],
      ['theme', 60],
      ['pose', 100],
    ]);
  });

  it('gives every item its own id', () => {
    const ids = CATALOGUE.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has two colour variants each for the dragon and the cat', () => {
    const owners = CATALOGUE.flatMap((item) =>
      item.kind === 'colour' ? [item.character] : [],
    );
    expect(owners).toEqual(['dragon', 'dragon', 'cat', 'cat']);
  });

  it('has the ocean and space themes', () => {
    const themes = CATALOGUE.filter((item) => item.kind === 'theme');
    expect(themes.map((item) => item.id)).toEqual(['ocean', 'space']);
  });
});

describe('the set and the crown', () => {
  it('makes the set of the six hats that have a price', () => {
    expect(SET).toHaveLength(6);
    for (const id of SET) {
      expect(itemOf(id)).toMatchObject({ kind: 'hat', price: 40 });
    }
  });

  it('makes the crown a hat with no price, outside the set', () => {
    expect(itemOf(CROWN)).toMatchObject({ kind: 'hat', price: null });
    expect(SET).not.toContain(CROWN);
  });
});

describe('isItemId', () => {
  it('accepts every id in the catalogue', () => {
    expect(CATALOGUE.every((item) => isItemId(item.id))).toBe(true);
  });

  it('refuses anything else', () => {
    expect(isItemId('jetpack')).toBe(false);
    expect(isItemId(40)).toBe(false);
    expect(isItemId(null)).toBe(false);
  });
});

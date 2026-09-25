import { describe, expect, it } from 'vitest';
import {
  CHARACTERS,
  isCharacter,
  isUnlocked,
  newUnlocks,
  UNLOCK_AT,
} from './characters';

describe('the characters', () => {
  it('are the dragon, then the five that unlock, in unlock order', () => {
    expect(CHARACTERS).toEqual([
      'dragon',
      'cat',
      'robot',
      'owl',
      'unicorn',
      'monster',
    ]);
  });

  it('unlock at 25, 60, 110, 170 and 240 gems, the dragon from the start', () => {
    expect(UNLOCK_AT).toEqual({
      dragon: 0,
      cat: 25,
      robot: 60,
      owl: 110,
      unicorn: 170,
      monster: 240,
    });
  });
});

describe('isCharacter', () => {
  it('accepts each of the six', () => {
    expect(CHARACTERS.every(isCharacter)).toBe(true);
  });

  it('refuses anything else', () => {
    expect(isCharacter('fox')).toBe(false);
    expect(isCharacter(0)).toBe(false);
    expect(isCharacter(undefined)).toBe(false);
  });
});

describe('isUnlocked', () => {
  it('has the dragon unlocked with no gems', () => {
    expect(isUnlocked('dragon', 0)).toBe(true);
  });

  it('unlocks a character once the gem total is at least its unlock total', () => {
    expect(isUnlocked('cat', 24)).toBe(false);
    expect(isUnlocked('cat', 25)).toBe(true);
    expect(isUnlocked('monster', 239)).toBe(false);
    expect(isUnlocked('monster', 240)).toBe(true);
  });
});

describe('newUnlocks', () => {
  it('names the character the total unlocked as it rose', () => {
    expect(newUnlocks(24, 25)).toEqual(['cat']);
    expect(newUnlocks(168, 170)).toEqual(['unicorn']);
    expect(newUnlocks(239, 261)).toEqual(['monster']);
  });

  it('names nothing when the total crossed no unlock total', () => {
    expect(newUnlocks(0, 24)).toEqual([]);
    expect(newUnlocks(25, 44)).toEqual([]);
    expect(newUnlocks(59, 59)).toEqual([]);
    expect(newUnlocks(300, 302)).toEqual([]);
  });

  it('does not name a character unlocked before the total rose', () => {
    expect(newUnlocks(25, 30)).toEqual([]);
    expect(newUnlocks(0, 0)).toEqual([]);
  });

  // Band pay and badge pay let a drill cross two unlock totals (ADR 0005).
  it('names every character the total crossed, in unlock order', () => {
    expect(newUnlocks(24, 60)).toEqual(['cat', 'robot']);
    expect(newUnlocks(0, 240)).toEqual([
      'cat',
      'robot',
      'owl',
      'unicorn',
      'monster',
    ]);
  });
});

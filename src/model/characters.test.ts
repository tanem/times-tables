import { describe, expect, it } from 'vitest';
import {
  CHARACTERS,
  isCharacter,
  isUnlocked,
  newUnlock,
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

describe('newUnlock', () => {
  it('names the character the total unlocked as it rose', () => {
    expect(newUnlock(24, 25)).toBe('cat');
    expect(newUnlock(168, 170)).toBe('unicorn');
    expect(newUnlock(239, 261)).toBe('monster');
  });

  it('names nothing when the total crossed no unlock total', () => {
    expect(newUnlock(0, 24)).toBe(null);
    expect(newUnlock(25, 44)).toBe(null);
    expect(newUnlock(59, 59)).toBe(null);
    expect(newUnlock(300, 302)).toBe(null);
  });

  it('does not name a character unlocked before the total rose', () => {
    expect(newUnlock(25, 30)).toBe(null);
    expect(newUnlock(0, 0)).toBe(null);
  });

  // A drill cannot pay enough to cross two unlock totals (ADR 0004), and the
  // highest is named should it ever happen.
  it('names the highest when the total crossed more than one', () => {
    expect(newUnlock(0, 60)).toBe('robot');
  });
});

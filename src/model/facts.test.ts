import { describe, expect, it } from 'vitest';
import { FACTS, factKey, pool, type Table } from './facts';

describe('factKey', () => {
  it('puts the smaller factor first', () => {
    expect(factKey(7, 6)).toBe('6x7');
    expect(factKey(6, 7)).toBe('6x7');
    expect(factKey(12, 8)).toBe('8x12');
  });
});

describe('FACTS', () => {
  it('holds 33 facts', () => {
    expect(FACTS).toHaveLength(33);
  });

  it('gives every fact its own key', () => {
    const keys = FACTS.map((fact) => fact.key);
    expect(new Set(keys).size).toBe(33);
  });

  it('pairs one factor from a table with a factor from 1 to 12', () => {
    for (const fact of FACTS) {
      const tables = [fact.a, fact.b].filter((factor) =>
        [6, 8, 12].includes(factor),
      );
      expect(tables.length).toBeGreaterThanOrEqual(1);
      for (const factor of [fact.a, fact.b]) {
        expect(factor).toBeGreaterThanOrEqual(1);
        expect(factor).toBeLessThanOrEqual(12);
      }
      expect(fact.a).toBeLessThanOrEqual(fact.b);
    }
  });

  it('holds each overlap fact once', () => {
    const keys = FACTS.map((fact) => fact.key);
    for (const key of ['6x8', '6x12', '8x12']) {
      expect(keys.filter((other) => other === key)).toEqual([key]);
    }
  });

  it('keys 6 x 7 as 6x7 with the product 42', () => {
    expect(FACTS.find((fact) => fact.key === '6x7')).toEqual({
      key: '6x7',
      a: 6,
      b: 7,
      product: 42,
    });
  });
});

describe('pool', () => {
  const sizes: ReadonlyArray<readonly [readonly Table[], number]> = [
    [[6], 12],
    [[8], 12],
    [[12], 12],
    [[6, 8], 23],
    [[6, 12], 23],
    [[8, 12], 23],
    [[6, 8, 12], 33],
  ];

  for (const [tables, size] of sizes) {
    it(`holds ${size} facts for the ${tables.join(' and ')} tables`, () => {
      expect(pool(tables)).toHaveLength(size);
    });
  }

  it('holds the overlap fact once for a pair of tables', () => {
    const keys = pool([6, 8]).map((fact) => fact.key);
    expect(keys.filter((key) => key === '6x8')).toEqual(['6x8']);
  });

  it('ignores the order the tables were given in', () => {
    expect(pool([8, 6])).toEqual(pool([6, 8]));
  });

  it('holds no facts for no tables', () => {
    expect(pool([])).toEqual([]);
  });
});

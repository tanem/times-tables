// The tables, from the 2s to the 12s. There is no 1s table.
export type Table = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

// One multiplication pair, unordered: the key and the factors put the smaller
// factor first.
export type Fact = {
  readonly key: string;
  readonly a: number;
  readonly b: number;
  readonly product: number;
};

export const TABLES = [
  2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
] as const satisfies readonly Table[];

// Tables listed with "and" before the last: "6s", "6s and 8s", "6s, 8s and
// 12s".
export function tablesList(tables: readonly Table[]): string {
  const names = tables.map((table) => `${table}s`);
  const last = names.at(-1) ?? '';
  return names.length < 2
    ? last
    : `${names.slice(0, -1).join(', ')} and ${last}`;
}

// The two factors of a pair, smaller first.
function ordered(a: number, b: number): [number, number] {
  return a <= b ? [a, b] : [b, a];
}

// The key of a pair whose factors are already ordered.
function keyOf(smaller: number, larger: number): string {
  return `${smaller}x${larger}`;
}

// The key of the fact both orderings of a pair share.
export function factKey(a: number, b: number): string {
  return keyOf(...ordered(a, b));
}

function buildFacts(): readonly Fact[] {
  const facts: Fact[] = [];
  for (let a = 1; a <= 12; a++) {
    for (let b = a; b <= 12; b++) {
      // 1 x 1 is in no table.
      if (b === 1) continue;
      facts.push({ key: keyOf(a, b), a, b, product: a * b });
    }
  }
  return facts;
}

// Every fact of the eleven tables: each unordered pair from 1 to 12 except
// 1 x 1, by the smaller factor and then the larger.
export const FACTS: readonly Fact[] = buildFacts();

// The facts of the given tables, each fact once and in FACTS order, so that
// the order the tables were chosen in does not show. No tables gives no
// facts.
export function pool(tables: readonly Table[]): readonly Fact[] {
  const chosen = new Set<number>(tables);
  return FACTS.filter((fact) => chosen.has(fact.a) || chosen.has(fact.b));
}

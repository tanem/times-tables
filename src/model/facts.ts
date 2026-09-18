// The three tables the app practises.
export type Table = 6 | 8 | 12;

// One multiplication pair, unordered: the key and the factors put the smaller
// factor first.
export type Fact = {
  readonly key: string;
  readonly a: number;
  readonly b: number;
  readonly product: number;
};

export const TABLES = [6, 8, 12] as const satisfies readonly Table[];

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

function fact(table: Table, other: number): Fact {
  const [a, b] = ordered(table, other);
  return { key: keyOf(a, b), a, b, product: a * b };
}

function buildFacts(): readonly Fact[] {
  const facts: Fact[] = [];
  const seen = new Set<string>();
  for (const table of TABLES) {
    for (let other = 1; other <= 12; other++) {
      const next = fact(table, other);
      // An overlap fact, such as 6 x 8, belongs to two tables but enters the
      // set once.
      if (seen.has(next.key)) continue;
      seen.add(next.key);
      facts.push(next);
    }
  }
  return facts;
}

// Every fact of the three tables, in table order and then by the other
// factor.
export const FACTS: readonly Fact[] = buildFacts();

// The facts of the given tables, each fact once and in FACTS order, so that
// the order the tables were chosen in does not show. No tables gives no
// facts.
export function pool(tables: readonly Table[]): readonly Fact[] {
  const chosen = new Set<number>(tables);
  return FACTS.filter((fact) => chosen.has(fact.a) || chosen.has(fact.b));
}

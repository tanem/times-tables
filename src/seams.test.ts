import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = fileURLToPath(new URL('.', import.meta.url));

// The two seam modules, and the tests, are allowed to name the globals.
const ALLOWED = ['random.ts', 'time.ts'];

const FORBIDDEN = [
  /Math\.random/,
  /\bsetTimeout\b/,
  /\bsetInterval\b/,
  /\brequestAnimationFrame\b/,
  /\bcancelAnimationFrame\b/,
  /performance\.now/,
  /\bDate\b/,
];

function modulesOutsideTheSeams(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...modulesOutsideTheSeams(path));
      continue;
    }
    if (!entry.name.endsWith('.ts')) continue;
    if (entry.name.endsWith('.test.ts')) continue;
    if (ALLOWED.includes(entry.name)) continue;
    found.push(path);
  }
  return found;
}

describe('the random and time seams', () => {
  it('are the only modules that touch randomness, timers and the clock', () => {
    const offences: string[] = [];
    for (const path of modulesOutsideTheSeams(SRC)) {
      const source = readFileSync(path, 'utf8');
      for (const pattern of FORBIDDEN) {
        if (pattern.test(source)) {
          offences.push(`${path.slice(SRC.length)} matches ${pattern.source}`);
        }
      }
    }
    expect(offences).toEqual([]);
  });
});

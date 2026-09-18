import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = fileURLToPath(new URL('.', import.meta.url));

// The two seam modules, by their path under src/, and the tests are the only
// places allowed to name the globals.
const SEAM_MODULES = ['random.ts', 'time.ts'];

const FORBIDDEN = [
  /Math\.random/,
  /\bsetTimeout\b/,
  /\bsetInterval\b/,
  /\brequestAnimationFrame\b/,
  /\bcancelAnimationFrame\b/,
  /performance\.now/,
  /\bDate\b/,
];

// The paths, relative to src/, of every module the seams cover.
function modulesOutsideTheSeams(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...modulesOutsideTheSeams(path));
      continue;
    }
    const module = relative(SRC, path);
    if (!module.endsWith('.ts')) continue;
    if (module.endsWith('.test.ts')) continue;
    if (SEAM_MODULES.includes(module)) continue;
    found.push(module);
  }
  return found;
}

describe('the random and time seams', () => {
  it('are the only modules that touch randomness, timers and the clock', () => {
    const offences: string[] = [];
    for (const module of modulesOutsideTheSeams(SRC)) {
      const source = readFileSync(join(SRC, module), 'utf8');
      for (const pattern of FORBIDDEN) {
        if (pattern.test(source)) {
          offences.push(`${module} matches ${pattern.source}`);
        }
      }
    }
    expect(offences).toEqual([]);
  });
});

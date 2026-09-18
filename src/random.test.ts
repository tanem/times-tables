import { afterEach, describe, expect, it, vi } from 'vitest';
import { random } from './random';

describe('random', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reads the replacement installed after the module loaded', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.25);
    expect(random()).toBe(0.25);
  });
});

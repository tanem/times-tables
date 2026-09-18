import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { schedule, timestamp } from './time';

describe('schedule', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('runs the callback once the wait has passed', () => {
    let runs = 0;
    schedule(() => {
      runs += 1;
    }, 3000);

    vi.advanceTimersByTime(2999);
    expect(runs).toBe(0);

    vi.advanceTimersByTime(1);
    expect(runs).toBe(1);
  });

  it('does not run a cancelled callback', () => {
    let runs = 0;
    const cancel = schedule(() => {
      runs += 1;
    }, 3000);

    cancel();
    vi.advanceTimersByTime(3000);
    expect(runs).toBe(0);
  });
});

describe('timestamp', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reads the current time', () => {
    vi.setSystemTime('2026-01-01T09:00:00.000Z');
    expect(timestamp()).toBe('2026-01-01T09:00:00.000Z');
  });
});

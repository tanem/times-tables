import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dayOf, schedule, timestamp, today } from './time';

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

describe('dayOf', () => {
  it('reads a late-evening local time as that same local day', () => {
    const stamp = new Date(2026, 8, 15, 23, 30).toISOString();
    expect(dayOf(stamp).date).toBe(15);
    expect(dayOf(stamp).month).toBe(8);
  });

  it('gives consecutive days ordinals one apart across a month end', () => {
    const last = dayOf(new Date(2026, 8, 30, 23, 0).toISOString());
    const first = dayOf(new Date(2026, 9, 1, 0, 0).toISOString());
    expect(first.ordinal - last.ordinal).toBe(1);
  });

  it('gives a DST-safe difference across a clock change', () => {
    // The UK moves its clocks back an hour at the end of October 2026.
    const before = dayOf(new Date(2026, 9, 24, 12, 0).toISOString());
    const after = dayOf(new Date(2026, 9, 26, 12, 0).toISOString());
    expect(after.ordinal - before.ordinal).toBe(2);
  });
});

describe('today', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reads the current local day', () => {
    vi.setSystemTime(new Date(2026, 8, 15, 23, 30));
    expect(today()).toEqual({ ordinal: 20711, weekday: 2, date: 15, month: 8 });
  });
});

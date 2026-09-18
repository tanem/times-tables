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
  // Stubbing TZ makes Node re-read the zone, so a UTC timestamp reads as a
  // different local day than it would in the machine's own zone. The
  // default here is a zone behind UTC; one test below overrides it to a
  // zone ahead of UTC.
  beforeEach(() => {
    vi.stubEnv('TZ', 'America/New_York');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('reads a UTC early morning as the previous evening in a zone behind UTC', () => {
    // 2026-09-16T03:30:00.000Z is 23:30 on 15 Sep in America/New_York.
    const day = dayOf('2026-09-16T03:30:00.000Z');
    expect(day.date).toBe(15);
    expect(day.month).toBe(8);
    expect(day.weekday).toBe(2);
  });

  it('reads a UTC evening as the next morning in a zone ahead of UTC', () => {
    vi.stubEnv('TZ', 'Asia/Tokyo');
    // 2026-09-14T16:00:00.000Z is 01:00 on 15 Sep in Asia/Tokyo.
    expect(dayOf('2026-09-14T16:00:00.000Z').date).toBe(15);
  });

  it('gives consecutive days ordinals one apart across a month end', () => {
    // 2026-10-01T03:00:00.000Z is 23:00 on 30 Sep, and
    // 2026-10-01T04:00:00.000Z is 00:00 on 1 Oct, both in
    // America/New_York.
    const last = dayOf('2026-10-01T03:00:00.000Z');
    const first = dayOf('2026-10-01T04:00:00.000Z');
    expect(first.ordinal - last.ordinal).toBe(1);
  });

  it('gives a two-day difference across a clock change', () => {
    // Clocks go back an hour between these two days in this zone.
    const before = dayOf('2026-10-31T16:00:00.000Z'); // local noon
    const after = dayOf('2026-11-02T17:00:00.000Z'); // local noon
    expect(after.ordinal - before.ordinal).toBe(2);
  });
});

describe('today', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubEnv('TZ', 'America/New_York');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it('reads the current local day', () => {
    // 2026-09-16T03:30:00.000Z is 23:30 on 15 Sep in America/New_York.
    vi.setSystemTime('2026-09-16T03:30:00.000Z');
    expect(today()).toEqual({ ordinal: 20711, weekday: 2, date: 15, month: 8 });
  });
});

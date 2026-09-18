import { describe, expect, it } from 'vitest';
import { createUpdater } from './update';

// An updater over counters, so that a test reads how many times it applied
// and reloaded.
function tracked() {
  const calls = { applied: 0, reloaded: 0 };
  const updater = createUpdater({
    apply: () => calls.applied++,
    reload: () => calls.reloaded++,
  });
  return { updater, calls };
}

describe('createUpdater', () => {
  it('applies a worker that waits while the Start screen is showing', () => {
    const { updater, calls } = tracked();

    updater.screenShown(true);
    updater.workerWaiting();

    expect(calls.applied).toBe(1);
  });

  it('holds a worker that waits during a drill until the Start screen shows', () => {
    const { updater, calls } = tracked();

    updater.screenShown(false);
    updater.workerWaiting();
    expect(calls.applied).toBe(0);

    updater.screenShown(true);
    expect(calls.applied).toBe(1);
  });

  it('applies once, however many times the worker and the screen are reported', () => {
    const { updater, calls } = tracked();

    updater.screenShown(true);
    updater.workerWaiting();
    updater.workerWaiting();
    updater.screenShown(false);
    updater.screenShown(true);

    expect(calls.applied).toBe(1);
  });

  it('holds a worker reported before the first screen goes up', () => {
    const { updater, calls } = tracked();

    updater.workerWaiting();
    expect(calls.applied).toBe(0);

    updater.screenShown(true);
    expect(calls.applied).toBe(1);
  });

  it('reloads at once when a worker takes over while the Start screen shows', () => {
    const { updater, calls } = tracked();

    updater.screenShown(true);
    updater.workerTookOver();

    expect(calls.reloaded).toBe(1);
  });

  it('holds the reload of a worker that takes over during a drill', () => {
    const { updater, calls } = tracked();

    updater.screenShown(false);
    updater.workerTookOver();
    expect(calls.reloaded).toBe(0);

    updater.screenShown(true);
    expect(calls.reloaded).toBe(1);
  });

  it('reloads once, however many times the takeover and the screen are reported', () => {
    const { updater, calls } = tracked();

    updater.screenShown(true);
    updater.workerTookOver();
    updater.workerTookOver();
    updater.screenShown(false);
    updater.screenShown(true);

    expect(calls.reloaded).toBe(1);
  });

  // Another tab of the app can apply the update, which takes the worker over
  // in this tab as well. This tab never applied, and still waits for its own
  // Start screen before reloading.
  it('holds the reload of a takeover this app never applied', () => {
    const { updater, calls } = tracked();

    updater.screenShown(false);
    updater.workerTookOver();
    expect(calls).toEqual({ applied: 0, reloaded: 0 });

    updater.screenShown(true);
    expect(calls).toEqual({ applied: 0, reloaded: 1 });
  });

  it('applies and then reloads over the course of one update', () => {
    const { updater, calls } = tracked();

    updater.screenShown(true);
    updater.workerWaiting();
    expect(calls).toEqual({ applied: 1, reloaded: 0 });

    updater.workerTookOver();
    expect(calls).toEqual({ applied: 1, reloaded: 1 });
  });

  it('holds the reload when the learner starts a drill between the apply and the takeover', () => {
    const { updater, calls } = tracked();

    updater.screenShown(true);
    updater.workerWaiting();
    expect(calls.applied).toBe(1);

    updater.screenShown(false);
    updater.workerTookOver();
    expect(calls.reloaded).toBe(0);

    updater.screenShown(true);
    expect(calls.reloaded).toBe(1);
  });
});

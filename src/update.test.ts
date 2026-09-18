import { describe, expect, it } from 'vitest';
import { createUpdater } from './update';

describe('createUpdater', () => {
  it('applies a worker that waits while the Start screen is showing', () => {
    let applied = 0;
    const updater = createUpdater(() => applied++);

    updater.screenShown(true);
    updater.workerWaiting();

    expect(applied).toBe(1);
  });

  it('holds a worker that waits during a drill until the Start screen shows', () => {
    let applied = 0;
    const updater = createUpdater(() => applied++);

    updater.screenShown(false);
    updater.workerWaiting();
    expect(applied).toBe(0);

    updater.screenShown(true);
    expect(applied).toBe(1);
  });

  it('applies once, however many times the worker and the screen are reported', () => {
    let applied = 0;
    const updater = createUpdater(() => applied++);

    updater.screenShown(true);
    updater.workerWaiting();
    updater.workerWaiting();
    updater.screenShown(false);
    updater.screenShown(true);

    expect(applied).toBe(1);
  });

  it('holds a worker reported before the first screen goes up', () => {
    let applied = 0;
    const updater = createUpdater(() => applied++);

    updater.workerWaiting();
    expect(applied).toBe(0);

    updater.screenShown(true);
    expect(applied).toBe(1);
  });
});

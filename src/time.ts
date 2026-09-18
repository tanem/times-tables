// The app's only access to the clock, the timers and animation frames, so
// that a test can drive all of them from outside the app.

export function now(): number {
  return performance.now();
}

export function timestamp(): string {
  return new Date().toISOString();
}

// Runs the callback after ms milliseconds; the returned function cancels it.
export function schedule(callback: () => void, ms: number): () => void {
  const handle = setTimeout(callback, ms);
  return () => clearTimeout(handle);
}

// Runs the callback on the next animation frame; the returned function
// cancels it.
export function onFrame(callback: () => void): () => void {
  const handle = requestAnimationFrame(callback);
  return () => cancelAnimationFrame(handle);
}

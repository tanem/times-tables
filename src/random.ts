// Math.random is read at call time, not captured at import time, so a
// replacement installed before the app loads is the one that gets used.
export function random(): number {
  return Math.random();
}

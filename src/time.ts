// The app's only access to the clock, the timers and animation frames, so
// that a test can drive all of them from outside the app.

// A calendar day in the device's local time zone. ordinal is a whole-day
// count, fit for subtracting two days; weekday is 0 to 6 with Sunday 0;
// month is 0 to 11.
export type Day = {
  ordinal: number;
  weekday: number;
  date: number;
  month: number;
};

const DAY_MS = 86400000;

function dayFrom(date: Date): Day {
  return {
    ordinal: Math.floor(
      Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS,
    ),
    weekday: date.getDay(),
    date: date.getDate(),
    month: date.getMonth(),
  };
}

// The local calendar day a stored ISO timestamp falls on.
export function dayOf(timestamp: string): Day {
  return dayFrom(new Date(timestamp));
}

// The local calendar day now.
export function today(): Day {
  return dayFrom(new Date());
}

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

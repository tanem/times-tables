// The build's own version and short commit, injected at build time by
// vite.config.ts's define. Read here alone, so the rest of the app takes it
// as a plain value.
export type BuildInfo = {
  version: string;
  commit: string;
};

export function buildInfo(): BuildInfo {
  return { version: __APP_VERSION__, commit: __COMMIT__ };
}

import { renderDragon } from './dragon';

// Builds the one screen a build shows when the stored document is from a
// newer build (ADR 0004). There is no way on from it: no drill starts and
// nothing is saved, so the document is left as the newer build wrote it.
export function renderNeedsUpdate(): HTMLElement {
  const screen = document.createElement('main');
  screen.className = 'needs-update';

  const heading = document.createElement('h1');
  heading.textContent = 'This app needs an update';

  const advice = document.createElement('p');
  advice.textContent = 'Close the app and open it again.';

  screen.append(renderDragon({ pose: 'sit' }), heading, advice);
  return screen;
}

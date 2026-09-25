import { now, onFrame } from '../time';

const SVG_NS = 'http://www.w3.org/2000/svg';

// How long the erase control must be held before it fires, in milliseconds.
const HOLD = 3000;

// The longest gap allowed between frames before a hold is treated as
// released, in milliseconds. The device sleeping or the app going to the
// background can stall frames for far longer than this without ever
// firing a pointerup or pointercancel; without this, the first frame after
// such a stall would see the whole gap as held time and could complete the
// erase on its own.
const STALL = 500;

// What the note under the control says: how to erase, and everything that
// goes, bought items and badges included.
const ERASE_NOTE =
  'Hold for three seconds to erase every table, fact, drill, gem, badge and bought item.';

// The erase ring's radius and the stroke length it takes to go all the way
// round, in the SVG's own units.
const RING_RADIUS = 10;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

// Builds the erase ring: a plain track circle and a stroke circle whose
// dash offset renderErase moves from full circumference (empty) to zero
// (full) as the hold runs.
function renderRing(): { svg: SVGElement; setShare: (share: number) => void } {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'erase-ring');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = `
    <circle class="erase-ring-track" cx="12" cy="12" r="${RING_RADIUS}" />
    <circle class="erase-ring-fill" cx="12" cy="12" r="${RING_RADIUS}"
      stroke-dasharray="${RING_CIRCUMFERENCE}"
      stroke-dashoffset="${RING_CIRCUMFERENCE}" />
  `;
  const fill = svg.querySelector('.erase-ring-fill') as SVGElement;
  const setShare = (share: number) => {
    fill.style.strokeDashoffset = String(RING_CIRCUMFERENCE * (1 - share));
  };
  return { svg, setShare };
}

// Builds the press-and-hold erase control: a button labelled "Erase all
// progress" with the ring as its only decoration. Holding it for HOLD
// fires onErase exactly once. Releasing early, the pointer leaving the
// control, losing focus, or a stalled run of frames (the device sleeping or
// the app going to the background) all cancel and snap the ring back to
// empty. A hold never picks up where an earlier one left off. The mouse,
// touch and keyboard (Space or Enter) all drive the same hold; a touch
// pointer's own position is checked against the control on every move,
// since a touch pointer stays captured by the control it went down on and
// raises no pointerleave.
export function renderErase(onErase: () => void): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'erase';

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'erase-button';

  const { svg: ring, setShare } = renderRing();
  const label = document.createElement('span');
  label.textContent = 'Erase all progress';
  button.append(ring, label);

  // The frame loop's own cancel, set while a hold is in progress and null
  // otherwise; cancel() below both stops it and resets the ring.
  let cancelFrame: (() => void) | null = null;

  function start(): void {
    if (cancelFrame) return;
    const startedAt = now();
    let lastFrameAt = startedAt;
    const tick = () => {
      if (!button.isConnected) {
        cancelFrame = null;
        return;
      }
      const at = now();
      if (at - lastFrameAt > STALL) {
        cancel();
        return;
      }
      lastFrameAt = at;
      const elapsed = at - startedAt;
      setShare(Math.min(elapsed / HOLD, 1));
      if (elapsed >= HOLD) {
        cancelFrame = null;
        onErase();
        return;
      }
      cancelFrame = onFrame(tick);
    };
    cancelFrame = onFrame(tick);
  }

  function cancel(): void {
    cancelFrame?.();
    cancelFrame = null;
    setShare(0);
  }

  // A touch pointer is captured by the control it went down on, so
  // pointerleave does not fire for a finger that slides off while held.
  // Checking the pointer's own position against the control on every move
  // catches that slide, for touch and the mouse alike.
  function withinBounds(event: PointerEvent): boolean {
    const box = button.getBoundingClientRect();
    return (
      event.clientX >= box.left &&
      event.clientX <= box.right &&
      event.clientY >= box.top &&
      event.clientY <= box.bottom
    );
  }

  button.addEventListener('pointerdown', (event) => {
    if (event.button === 0) start();
  });
  button.addEventListener('pointermove', (event) => {
    if (cancelFrame && !withinBounds(event)) cancel();
  });
  button.addEventListener('pointerup', cancel);
  button.addEventListener('pointercancel', cancel);
  button.addEventListener('pointerleave', cancel);
  // The iPad's long-press callout and text selection are not wanted here.
  button.addEventListener('contextmenu', (event) => event.preventDefault());
  button.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    if (event.key === ' ' || event.key === 'Enter') start();
  });
  button.addEventListener('keyup', cancel);
  button.addEventListener('blur', cancel);

  // What goes, and how, under the control. It describes the button, whose
  // name stays the action alone.
  const note = document.createElement('p');
  note.id = 'erase-note';
  note.className = 'erase-note';
  note.textContent = ERASE_NOTE;
  button.setAttribute('aria-describedby', note.id);

  wrap.append(button, note);
  return wrap;
}

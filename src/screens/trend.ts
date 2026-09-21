import {
  earlyLine,
  PACE_NOTE,
  trendChart,
  trendFigures,
  type DayOf,
  type TrendChart,
  type TrendFigure,
} from '../model/report';
import type { Progress } from '../model/progress';
import type { Day } from '../time';

const SVG = 'http://www.w3.org/2000/svg';

// The chart's own coordinates. The svg stretches to the page width, so only
// their proportions show.
const WIDTH = 600;
const HEIGHT = 170;

// The room kept above the highest point for the marks' labels.
const HEADROOM = 34;

// The three figures, each a group named by its label: the value now over
// the value four weeks ago.
function renderFigures(figures: readonly TrendFigure[]): HTMLElement {
  const row = document.createElement('div');
  row.className = 'figures';

  for (const { label, now, then } of figures) {
    const figure = document.createElement('div');
    figure.className = 'figure';
    figure.setAttribute('role', 'group');
    figure.setAttribute('aria-label', label);

    const labelEl = document.createElement('span');
    labelEl.className = 'figure-label';
    labelEl.textContent = label;
    labelEl.setAttribute('aria-hidden', 'true');

    const nowEl = document.createElement('span');
    nowEl.className = 'figure-now';
    nowEl.textContent = now;

    const thenEl = document.createElement('span');
    thenEl.className = 'figure-then';
    thenEl.textContent = then;

    figure.append(labelEl, nowEl, thenEl);
    row.append(figure);
  }

  return row;
}

// The line of pace with a dashed mark where tables were switched on, and
// the captions under it.
function renderChart(chart: TrendChart): HTMLElement[] {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', `0 0 ${WIDTH} ${HEIGHT}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Pace drill by drill');

  for (const mark of chart.marks) {
    const x = (mark.x * WIDTH).toFixed(1);
    const line = document.createElementNS(SVG, 'line');
    line.setAttribute('x1', x);
    line.setAttribute('y1', '0');
    line.setAttribute('x2', x);
    line.setAttribute('y2', `${HEIGHT}`);
    svg.append(line);
  }

  const path = document.createElementNS(SVG, 'path');
  path.setAttribute(
    'd',
    chart.points
      .map((point, index) => {
        const x = (point.x * WIDTH).toFixed(1);
        const y = (HEIGHT - point.y * (HEIGHT - HEADROOM)).toFixed(1);
        return `${index === 0 ? 'M' : 'L'}${x} ${y}`;
      })
      .join(' '),
  );
  svg.append(path);

  const box = document.createElement('div');
  box.className = 'chart';
  box.append(svg);

  // Labels alternate between two rows so that marks close together do not
  // overlap, and one near the right edge sits to the left of its mark.
  chart.marks.forEach((mark, index) => {
    const label = document.createElement('span');
    label.className = 'chart-mark';
    label.textContent = mark.label;
    label.style.top = `${(index % 2) * 15}px`;
    if (mark.x > 0.8) {
      label.classList.add('chart-mark-left');
      label.style.right = `${(1 - mark.x) * 100}%`;
    } else {
      label.style.left = `${mark.x * 100}%`;
    }
    box.append(label);
  });

  const axis = document.createElement('div');
  axis.className = 'chart-axis';
  for (const caption of [chart.span, chart.highest, 'Today']) {
    const span = document.createElement('span');
    span.textContent = caption;
    axis.append(span);
  }

  return [box, axis];
}

// The trend at the top of the Parent view: the early line while there is
// one, the figures from the first drill, the chart once there is a line to
// draw, and the note on what pace is.
export function renderTrend(
  progress: Progress,
  dayOf: DayOf,
  today: Day,
): HTMLElement[] {
  const parts: HTMLElement[] = [];

  const early = earlyLine(progress);
  if (early !== null) {
    const line = document.createElement('p');
    line.className = 'early';
    line.textContent = early;
    parts.push(line);
  }

  const figures = trendFigures(progress.records, dayOf, today);
  if (figures.length === 0) return parts;
  parts.push(renderFigures(figures));

  const chart = trendChart(progress.records, dayOf, today);
  if (chart) parts.push(...renderChart(chart));

  const note = document.createElement('p');
  note.className = 'note';
  note.textContent = PACE_NOTE;
  parts.push(note);

  return parts;
}

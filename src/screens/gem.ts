const SVG_NS = 'http://www.w3.org/2000/svg';

// A blue faceted gem on a 32 × 32 box: the table, a lighter crown and the
// facet lines.
const GEM = `
  <path fill="#6fcbff" stroke="#2f86c9" stroke-width="2" stroke-linejoin="round" d="M9 6 H23 L29 13.5 L16 28 L3 13.5 Z"/>
  <path fill="#c5ecff" d="M9 6 H23 L20 13.5 H12 Z"/>
  <path fill="none" stroke="#2f86c9" stroke-width="1.2" stroke-linejoin="round" d="M3 13.5 H29 M9 6 L12 13.5 L16 28 L20 13.5 L23 6"/>`;

// Builds the gem, sized by the styles and hidden from a screen reader: the
// words beside it say what it is.
export function renderGem(): SVGSVGElement {
  const gem = document.createElementNS(SVG_NS, 'svg');
  gem.setAttribute('class', 'gem');
  gem.setAttribute('viewBox', '0 0 32 32');
  gem.setAttribute('aria-hidden', 'true');
  gem.innerHTML = GEM;
  return gem;
}

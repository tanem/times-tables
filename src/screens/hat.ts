import { itemOf, type HatId } from '../model/catalogue';

const SVG_NS = 'http://www.w3.org/2000/svg';

// Every hat is drawn once, on the characters' shared 200 × 200 box, with
// the middle of its brim at (100, 44), which sits on the top of every
// character's head. The character puts the hat in its head part, so that
// every pose carries it.
const HATS: Readonly<Record<HatId, string>> = {
  'party-hat': `
    <g transform="rotate(8 100 44)">
      <path fill="#ff7aa8" stroke="#c93a6a" stroke-width="3" stroke-linejoin="round" d="M76 46 L100 -6 L124 46 Q100 54 76 46 Z"/>
      <circle cx="94" cy="30" r="4" fill="#ffc93c"/>
      <circle cx="108" cy="36" r="4" fill="#6fcbff"/>
      <circle cx="102" cy="14" r="3.5" fill="#6fcbff"/>
      <path fill="none" stroke="#ffc93c" stroke-width="4" stroke-linecap="round" d="M78 44 Q100 52 122 44"/>
      <circle cx="100" cy="-8" r="8" fill="#ffc93c" stroke="#d99a00" stroke-width="2"/>
    </g>`,
  'top-hat': `
    <rect x="76" y="-2" width="48" height="46" rx="5" fill="#3a3d5c" stroke="#1e2033" stroke-width="3"/>
    <rect x="76" y="26" width="48" height="10" fill="#de5a52"/>
    <path fill="none" stroke="#5a5e85" stroke-width="3" stroke-linecap="round" d="M84 4 V22"/>
    <ellipse cx="100" cy="44" rx="38" ry="7" fill="#3a3d5c" stroke="#1e2033" stroke-width="3"/>`,
  'wizard-hat': `
    <path fill="#6f5ee0" stroke="#4a3aa8" stroke-width="3" stroke-linejoin="round" d="M72 44 C84 28 92 8 118 -10 C110 10 116 28 128 44 Z"/>
    <path fill="#ffc93c" d="M98 20 L100.5 26 L107 26 L102 30 L104 36 L98 32.5 L92 36 L94 30 L89 26 L95.5 26 Z"/>
    <circle cx="111" cy="10" r="2.5" fill="#ffc93c"/>
    <circle cx="116" cy="34" r="2" fill="#ffc93c"/>
    <ellipse cx="100" cy="44" rx="44" ry="8" fill="#5b4bc4" stroke="#4a3aa8" stroke-width="3"/>`,
  'cowboy-hat': `
    <path fill="#c98f5d" stroke="#8a5a32" stroke-width="3" stroke-linejoin="round" d="M72 44 Q70 12 86 8 Q100 16 114 8 Q130 12 128 44 Z"/>
    <path fill="#6b3f1f" d="M71 32 Q100 38 129 32 L129 42 Q100 48 71 42 Z"/>
    <path fill="#b07c4f" stroke="#8a5a32" stroke-width="3" stroke-linejoin="round" d="M48 34 Q54 50 100 50 Q146 50 152 34 Q144 44 100 42 Q56 44 48 34 Z"/>`,
  'pirate-hat': `
    <path fill="#2b2d42" stroke="#15161f" stroke-width="3" stroke-linejoin="round" d="M54 48 Q56 18 80 16 Q100 0 120 16 Q144 18 146 48 Q100 36 54 48 Z"/>
    <path fill="none" stroke="#ffc93c" stroke-width="3" stroke-linecap="round" d="M58 45 Q100 34 142 45"/>
    <circle cx="100" cy="22" r="7" fill="#ffffff"/>
    <circle cx="97.5" cy="21" r="1.8" fill="#2b2d42"/>
    <circle cx="102.5" cy="21" r="1.8" fill="#2b2d42"/>
    <path fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" d="M90 30 L110 40 M110 30 L90 40"/>`,
  'bobble-hat': `
    <path fill="#de5a52" stroke="#a83c36" stroke-width="3" stroke-linejoin="round" d="M66 44 Q64 6 100 6 Q136 6 134 44 Z"/>
    <path fill="none" stroke="#ffffff" stroke-width="5" d="M68 22 Q100 14 132 22"/>
    <rect x="62" y="34" width="76" height="16" rx="8" fill="#fff1d6" stroke="#a83c36" stroke-width="3"/>
    <path fill="none" stroke="#e0c9a0" stroke-width="2" d="M74 37 V47 M86 37 V47 M98 37 V47 M110 37 V47 M122 37 V47"/>
    <circle cx="100" cy="2" r="10" fill="#fff1d6" stroke="#a83c36" stroke-width="3"/>`,
  crown: `
    <path fill="#ffc93c" stroke="#d99a00" stroke-width="3" stroke-linejoin="round" d="M68 48 L66 14 L84 30 L100 6 L116 30 L134 14 L132 48 Q100 42 68 48 Z"/>
    <circle cx="66" cy="12" r="4" fill="#ffc93c" stroke="#d99a00" stroke-width="2"/>
    <circle cx="100" cy="4" r="4" fill="#ffc93c" stroke="#d99a00" stroke-width="2"/>
    <circle cx="134" cy="12" r="4" fill="#ffc93c" stroke="#d99a00" stroke-width="2"/>
    <circle cx="100" cy="36" r="5" fill="#de5a52"/>
    <circle cx="82" cy="39" r="3.5" fill="#6fcbff"/>
    <circle cx="118" cy="39" r="3.5" fill="#6fcbff"/>`,
};

// The hat's drawing, to go inside a character's head part.
export function hatArt(hat: HatId): string {
  return `<g class="hat">${HATS[hat]}</g>`;
}

// How a hat is named after a character's name: "in a party hat".
export function wearing(hat: HatId): string {
  return ` in a ${itemOf(hat).name.toLowerCase()}`;
}

// Builds a hat on its own, framed on its brim and crown, sized by the
// styles and hidden from a screen reader: what carries it says which hat
// it is.
export function renderHat(hat: HatId): SVGSVGElement {
  const figure = document.createElementNS(SVG_NS, 'svg');
  figure.setAttribute('class', 'hat-alone');
  figure.setAttribute('viewBox', '44 -22 112 84');
  figure.setAttribute('aria-hidden', 'true');
  figure.innerHTML = hatArt(hat);
  return figure;
}

// Builds a table's badge: a medal, sized by the styles and hidden from a
// screen reader, since the name of what carries it says so.
export function renderBadge(): HTMLElement {
  const badge = document.createElement('span');
  badge.className = 'badge';
  badge.setAttribute('aria-hidden', 'true');
  badge.textContent = '🏅';
  return badge;
}

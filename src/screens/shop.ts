import {
  CATALOGUE,
  CROWN,
  SET,
  type HatId,
  type Item,
  type ItemId,
  type ItemKind,
} from '../model/catalogue';
import type { Character } from '../model/characters';
import { sound } from '../sound';
import { renderCharacter, renderConfetti } from './character';
import { renderBalance, renderGem } from './gem';
import { renderHat } from './hat';

// The kinds of item the Shop sells so far, in catalogue order, with the
// heading of each. The rest of the catalogue goes on sale as the app gains
// the art and the choosing that each kind needs.
const ON_SALE: readonly { kind: ItemKind; heading: string }[] = [
  { kind: 'hat', heading: 'Hats' },
];

// What the line under the items says with nothing chosen yet.
const PROMPT = 'Tap a hat to try it on';

// What the line says once owning every hat of the set has earned the crown.
const SET_DONE = 'You have every hat. The crown is yours!';

// What the owned items and the balance are after a purchase.
export type Bought = { balance: number; owned: readonly ItemId[] };

export type ShopOptions = {
  balance: number;
  owned: readonly ItemId[];
  // The chosen character, which tries on the chosen hat, and the hat it
  // wears until one is chosen.
  character: Character;
  hat: HatId | null;
  // Buys the item and hands back the balance and the owned items after,
  // which are as they were when the purchase could not be made.
  onBuy: (id: ItemId) => Bought;
  onBack: () => void;
};

function gems(count: number): string {
  return `${count} ${count === 1 ? 'gem' : 'gems'}`;
}

// What an item's tile says under its name, and after it in the tile's name
// for a screen reader: owned, its price, or for the crown what earns it.
function status(item: Item, owned: boolean): string {
  if (owned) return 'Owned';
  if (item.price === null) return 'Every hat';
  return String(item.price);
}

function tileName(item: Item, owned: boolean): string {
  if (owned) return `${item.name}, owned`;
  if (item.price === null) return `${item.name}, earned by every hat`;
  return `${item.name}, ${gems(item.price)}`;
}

// Builds the Shop: the balance in the corner, the chosen character, then the
// items of each kind on sale in catalogue order, each with its price or
// marked as owned, and under them the line for the chosen item. A tap
// chooses an item and a hat is tried on the character; only the Buy button
// on that line buys, and it is disabled while the balance is short. A
// purchase stays on the Shop. The one that completes the set earns the
// crown too, and the Shop celebrates it with the crown on the character.
export function renderShop(options: ShopOptions): HTMLElement {
  let { balance } = options;
  let owned = [...options.owned];
  let chosen: ItemId | null = null;

  const screen = document.createElement('main');
  screen.className = 'shop';

  const top = document.createElement('header');
  top.className = 'shop-top';
  const back = document.createElement('button');
  back.type = 'button';
  back.className = 'back';
  back.textContent = 'Back';
  back.addEventListener('click', options.onBack);
  const heading = document.createElement('h1');
  heading.textContent = 'Shop';
  top.append(back, heading);

  let balanceLine = renderBalance(balance);

  let figure = renderCharacter({
    character: options.character,
    pose: 'sit',
    hat: options.hat,
  });

  // The character in the given pose wearing the chosen hat, or, with no hat
  // chosen, the one it wears.
  const drawCharacter = (celebrating = false) => {
    const item = CATALOGUE.find((entry) => entry.id === chosen);
    const next = renderCharacter({
      character: options.character,
      pose: celebrating ? 'big-jump' : 'sit',
      hat: item?.kind === 'hat' ? item.id : options.hat,
      sparkles: celebrating ? 'burst' : undefined,
    });
    figure.replaceWith(next);
    figure = next;
  };

  const tiles = new Map<ItemId, HTMLButtonElement>();
  const sections = ON_SALE.map(({ kind, heading: text }) => {
    const section = document.createElement('section');
    section.className = 'shelf';
    const title = document.createElement('h2');
    title.id = `shelf-${kind}`;
    title.textContent = text;
    const items = document.createElement('div');
    items.className = 'items';
    items.setAttribute('role', 'group');
    items.setAttribute('aria-labelledby', title.id);
    for (const item of CATALOGUE.filter((entry) => entry.kind === kind)) {
      const tile = document.createElement('button');
      tile.type = 'button';
      tile.className = 'item';
      tile.addEventListener('click', () => {
        chosen = item.id;
        update();
        drawCharacter();
      });
      tiles.set(item.id, tile);
      items.append(tile);
    }
    section.append(title, items);
    return section;
  });

  // The line for the chosen item: its name, and Buy with the price, or why
  // it cannot be bought.
  const line = document.createElement('div');
  line.className = 'buy-line';
  const said = document.createElement('p');
  said.className = 'buy-said';
  said.setAttribute('role', 'status');
  const buy = document.createElement('button');
  buy.type = 'button';
  buy.className = 'buy';
  line.append(said, buy);

  // Draws each tile's price or owned mark, and the line for the chosen
  // item.
  const update = () => {
    for (const item of CATALOGUE) {
      const tile = tiles.get(item.id);
      if (!tile) continue;
      const isOwned = owned.includes(item.id);
      tile.setAttribute('aria-label', tileName(item, isOwned));
      tile.setAttribute('aria-pressed', String(item.id === chosen));
      tile.classList.toggle('owned', isOwned);
      const price = document.createElement('span');
      price.className = 'item-price';
      if (!isOwned && item.price !== null) price.append(renderGem());
      price.append(status(item, isOwned));
      const name = document.createElement('span');
      name.className = 'item-name';
      name.textContent = item.name;
      tile.replaceChildren(
        ...(item.kind === 'hat' ? [renderHat(item.id)] : []),
        name,
        price,
      );
    }

    const item = CATALOGUE.find((entry) => entry.id === chosen);
    buy.hidden = true;
    if (!item) {
      said.textContent = PROMPT;
    } else if (owned.includes(item.id)) {
      said.textContent =
        item.id === CROWN ? SET_DONE : `You own the ${item.name.toLowerCase()}`;
    } else if (item.price === null) {
      said.textContent = `Own all ${SET.length} hats to earn the ${item.name.toLowerCase()}`;
    } else {
      const short = item.price - balance;
      said.textContent = short > 0 ? `${gems(short)} more to go` : item.name;
      buy.hidden = false;
      buy.disabled = short > 0;
      buy.replaceChildren(`Buy for ${item.price}`, renderGem());
      buy.setAttribute('aria-label', `Buy for ${gems(item.price)}`);
    }
  };

  buy.addEventListener('click', () => {
    if (chosen === null) return;
    const hadCrown = owned.includes(CROWN);
    const after = options.onBuy(chosen);
    if (!after.owned.includes(chosen)) return;
    balance = after.balance;
    owned = [...after.owned];
    const nextBalance = renderBalance(balance);
    balanceLine.replaceWith(nextBalance);
    balanceLine = nextBalance;
    // Buy hides once the item is owned, so focus moves to its tile.
    tiles.get(chosen)?.focus();
    if (!hadCrown && owned.includes(CROWN)) {
      chosen = CROWN;
      update();
      tiles.get(CROWN)?.focus();
      drawCharacter(true);
      screen.append(renderConfetti());
      sound.unlock();
    } else {
      update();
      sound.gem();
    }
  });

  update();
  screen.append(balanceLine, top, figure, ...sections, line);
  return screen;
}

import {
  CATALOGUE,
  CROWN,
  itemOf,
  SET,
  type Entry,
  type HatId,
  type Item,
  type ItemId,
  type ItemKind,
} from '../model/catalogue';
import type { Character } from '../model/characters';
import type { ChosenColours } from '../model/progress';
import { sound } from '../sound';
import { renderCharacter, renderConfetti } from './character';
import { gemWord, renderBalance, renderGem } from './gem';
import { renderHat } from './hat';

// The kinds of item the Shop sells so far, in catalogue order, with the
// heading of each. The rest of the catalogue goes on sale as the app gains
// the art and the choosing that each kind needs.
const ON_SALE: readonly { kind: ItemKind; heading: string }[] = [
  { kind: 'hat', heading: 'Hats' },
  { kind: 'colour', heading: 'Colours' },
];

// What the line under the items says with nothing chosen yet.
const PROMPT = 'Tap an item to try it on';

// What the line says once owning every hat of the set has earned the crown.
const SET_DONE = 'You have every hat. The crown is yours!';

// What the owned items and the balance are after a purchase.
export type Bought = { balance: number; owned: readonly ItemId[] };

export type ShopOptions = {
  balance: number;
  owned: readonly ItemId[];
  // The chosen character, which tries on the chosen hat, and the hat it
  // wears and each character's colour until an item is chosen.
  character: Character;
  hat: HatId | null;
  colours: Readonly<ChosenColours>;
  // Buys the item and hands back the balance and the owned items after,
  // which are as they were when the purchase could not be made.
  onBuy: (id: ItemId) => Bought;
  onBack: () => void;
};

// A count of gems in words: "40 gems".
function gems(count: number): string {
  return `${count} ${gemWord(count)}`;
}

// An item's name inside a sentence: "the top hat".
function named(item: Item): string {
  return item.name.toLowerCase();
}

// What an item's button says under the item's name, and after it in the
// button's name for a screen reader: owned, its price, or for the crown what earns it.
function status(item: Item, owned: boolean): string {
  if (owned) return 'Owned';
  if (item.price === null) return 'Every hat';
  return String(item.price);
}

// The item button's name for a screen reader: the item's name and its
// status.
function buttonName(item: Item, owned: boolean): string {
  if (owned) return `${item.name}, owned`;
  if (item.price === null) return `${item.name}, earned by every hat`;
  return `${item.name}, ${gems(item.price)}`;
}

// An item's picture on its button, hidden from a screen reader since the
// button's name says what it is: a hat on its own, or a colour variant's
// character sitting in that colour.
function renderPicture(item: Entry): Element[] {
  if (item.kind === 'hat') return [renderHat(item.id)];
  if (item.kind === 'colour') {
    const { character, id: colour } = item;
    const figure = renderCharacter({ character, pose: 'sit', colour });
    figure.setAttribute('aria-hidden', 'true');
    return [figure];
  }
  return [];
}

// Builds the Shop: the balance in the corner, the chosen character, then the
// items of each kind on sale in catalogue order, each with its price or
// marked as owned, and under them the line for the chosen item. A tap
// chooses an item: a hat is tried on the character, and a colour variant
// shows its own character in that colour, in the worn hat. Only the Buy
// button on that line buys, and it is disabled while the balance is short.
// A purchase stays on the Shop. The one that completes the set earns the
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
    colour: options.colours[options.character],
  });

  // The character in the given pose trying on the chosen item: wearing the
  // chosen hat, or the chosen colour variant's character in that colour.
  // Otherwise it is the chosen character as it is, in the hat it wears and
  // its colour.
  const drawCharacter = (celebrating = false) => {
    const item = chosen === null ? null : itemOf(chosen);
    const character =
      item?.kind === 'colour' ? item.character : options.character;
    const next = renderCharacter({
      character,
      pose: celebrating ? 'big-jump' : 'sit',
      hat: item?.kind === 'hat' ? item.id : options.hat,
      colour: item?.kind === 'colour' ? item.id : options.colours[character],
      sparkles: celebrating ? 'burst' : undefined,
    });
    figure.replaceWith(next);
    figure = next;
  };

  const buttons = new Map<ItemId, HTMLButtonElement>();
  const sections = ON_SALE.map(({ kind, heading: text }) => {
    const section = document.createElement('section');
    section.className = 'shop-kind';
    const title = document.createElement('h2');
    title.id = `kind-${kind}`;
    title.textContent = text;
    const items = document.createElement('div');
    items.className = 'items';
    items.setAttribute('role', 'group');
    items.setAttribute('aria-labelledby', title.id);
    for (const item of CATALOGUE.filter((entry) => entry.kind === kind)) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'item';
      button.addEventListener('click', () => {
        chosen = item.id;
        update();
        drawCharacter();
      });
      buttons.set(item.id, button);
      items.append(button);
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

  // Draws each button's price or owned mark, and the line for the chosen
  // item.
  const update = () => {
    for (const item of CATALOGUE) {
      const button = buttons.get(item.id);
      if (!button) continue;
      const isOwned = owned.includes(item.id);
      button.setAttribute('aria-label', buttonName(item, isOwned));
      button.setAttribute('aria-pressed', String(item.id === chosen));
      button.classList.toggle('owned', isOwned);
      const price = document.createElement('span');
      price.className = 'item-price';
      if (!isOwned && item.price !== null) price.append(renderGem());
      price.append(status(item, isOwned));
      const name = document.createElement('span');
      name.className = 'item-name';
      name.textContent = item.name;
      button.replaceChildren(...renderPicture(item), name, price);
    }

    const item = chosen === null ? null : itemOf(chosen);
    buy.hidden = true;
    if (!item) {
      said.textContent = PROMPT;
    } else if (owned.includes(item.id)) {
      said.textContent =
        item.id === CROWN ? SET_DONE : `You own the ${named(item)}`;
    } else if (item.price === null) {
      said.textContent = `Own all ${SET.length} hats to earn the ${named(item)}`;
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
    // Buy hides once the item is owned, so focus moves to its button.
    buttons.get(chosen)?.focus();
    if (!hadCrown && owned.includes(CROWN)) {
      chosen = CROWN;
      update();
      buttons.get(CROWN)?.focus();
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

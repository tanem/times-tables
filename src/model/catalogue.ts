import type { Character } from './characters';

// What an item is: a hat any character wears, a colour variant of one
// character, a theme for the app's colours, or the extra pose.
export type ItemKind = 'hat' | 'colour' | 'theme' | 'pose';

// One thing the Shop sells, at a price in gems (ADR 0005). An item with no
// price cannot be bought: the crown, which owning the set earns. A colour
// variant belongs to one character alone.
export type Item =
  | {
      id: string;
      kind: 'hat' | 'theme' | 'pose';
      name: string;
      price: number | null;
    }
  | {
      id: string;
      kind: 'colour';
      name: string;
      price: number;
      character: Character;
    };

// Every item there is, in kind order. It is data only: adding a hat or a
// theme later is an entry here and its art. The ids are stored in the
// progress document, so an id, once released, is never changed.
export const CATALOGUE = [
  { id: 'party-hat', kind: 'hat', name: 'Party hat', price: 40 },
  { id: 'top-hat', kind: 'hat', name: 'Top hat', price: 40 },
  { id: 'wizard-hat', kind: 'hat', name: 'Wizard hat', price: 40 },
  { id: 'cowboy-hat', kind: 'hat', name: 'Cowboy hat', price: 40 },
  { id: 'pirate-hat', kind: 'hat', name: 'Pirate hat', price: 40 },
  { id: 'bobble-hat', kind: 'hat', name: 'Bobble hat', price: 40 },
  { id: 'crown', kind: 'hat', name: 'Crown', price: null },
  {
    id: 'dragon-blue',
    kind: 'colour',
    name: 'Blue dragon',
    price: 25,
    character: 'dragon',
  },
  {
    id: 'dragon-purple',
    kind: 'colour',
    name: 'Purple dragon',
    price: 25,
    character: 'dragon',
  },
  {
    id: 'cat-grey',
    kind: 'colour',
    name: 'Grey cat',
    price: 25,
    character: 'cat',
  },
  {
    id: 'cat-black',
    kind: 'colour',
    name: 'Black cat',
    price: 25,
    character: 'cat',
  },
  { id: 'ocean', kind: 'theme', name: 'Ocean', price: 60 },
  { id: 'space', kind: 'theme', name: 'Space', price: 60 },
  { id: 'backflip', kind: 'pose', name: 'Backflip', price: 100 },
] as const satisfies readonly Item[];

type Entry = (typeof CATALOGUE)[number];

export type ItemId = Entry['id'];
export type HatId = Extract<Entry, { kind: 'hat' }>['id'];
export type ColourId = Extract<Entry, { kind: 'colour' }>['id'];
export type ThemeId = Extract<Entry, { kind: 'theme' }>['id'];

// The hat that owning the set earns. It cannot be bought.
export const CROWN = 'crown' satisfies HatId;

// The set: the hats the Shop sells, every hat with a price.
export const SET: readonly HatId[] = CATALOGUE.flatMap((item) =>
  item.kind === 'hat' && item.price !== null ? [item.id] : [],
);

export function isItemId(value: unknown): value is ItemId {
  return CATALOGUE.some((item) => item.id === value);
}

export function itemOf(id: ItemId): Item {
  const item = CATALOGUE.find((entry) => entry.id === id);
  if (!item) throw new Error(`no item ${id}`);
  return item;
}

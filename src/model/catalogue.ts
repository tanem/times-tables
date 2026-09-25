import type { Character } from './characters';

// One thing the Shop sells, at a price in gems (ADR 0005): a hat any
// character wears, a colour variant of one character, a theme for the app's
// colours, or the extra pose. A hat with no price cannot be bought: the
// crown, which owning the set earns. A colour variant belongs to one
// character alone.
export type Item =
  | { id: string; kind: 'hat'; name: string; price: number | null }
  | { id: string; kind: 'theme' | 'pose'; name: string; price: number }
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

export type ItemKind = Item['kind'];

// One entry of the catalogue, with its id, kind and character as literals.
export type Entry = (typeof CATALOGUE)[number];

// The ids of every item, and of the items of one kind.
export type ItemId = Entry['id'];
export type IdOf<K extends ItemKind> = Extract<Entry, { kind: K }>['id'];
export type HatId = IdOf<'hat'>;
export type ColourId = IdOf<'colour'>;
export type ThemeId = IdOf<'theme'>;

// The hat that owning the set earns. It cannot be bought.
export const CROWN = 'crown' satisfies HatId;

// The extra pose, which a fast answer plays once it is owned.
export const BACKFLIP = 'backflip' satisfies IdOf<'pose'>;

// The set: the hats the Shop sells, every hat with a price.
export const SET: readonly HatId[] = CATALOGUE.flatMap((item) =>
  item.kind === 'hat' && item.price !== null ? [item.id] : [],
);

// Whether a value is the id of an item in the catalogue.
export function isItemId(value: unknown): value is ItemId {
  return CATALOGUE.some((item) => item.id === value);
}

// Whether a value is the id of an item of the given kind.
export function isIdOf<K extends ItemKind>(
  value: unknown,
  kind: K,
): value is IdOf<K> {
  return CATALOGUE.some((item) => item.id === value && item.kind === kind);
}

// A character's colour variants, in catalogue order.
export function variantsOf(character: Character): ColourId[] {
  return CATALOGUE.flatMap((item) =>
    item.kind === 'colour' && item.character === character ? [item.id] : [],
  );
}

// The catalogue entry for an id. Every id has one; the throw is for a
// value that got past the types.
export function itemOf(id: ItemId): Entry {
  const item = CATALOGUE.find((entry) => entry.id === id);
  if (!item) throw new Error(`no item ${id}`);
  return item;
}

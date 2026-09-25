// The figures that react to the learner's practice, in the order they
// unlock. The dragon is there from the start.
export const CHARACTERS = [
  'dragon',
  'cat',
  'robot',
  'owl',
  'unicorn',
  'monster',
] as const;

export type Character = (typeof CHARACTERS)[number];

// The gem total each character unlocks at (ADR 0004).
export const UNLOCK_AT: Readonly<Record<Character, number>> = {
  dragon: 0,
  cat: 25,
  robot: 60,
  owl: 110,
  unicorn: 170,
  monster: 240,
};

export function isCharacter(value: unknown): value is Character {
  return (CHARACTERS as readonly unknown[]).includes(value);
}

// Whether the gem total has unlocked the character. The total never falls,
// so an unlock is never lost and unlocked characters are not stored.
export function isUnlocked(character: Character, gems: number): boolean {
  return gems >= UNLOCK_AT[character];
}

// The characters the gem total unlocked as it rose from before to after, in
// unlock order, or none when it crossed no unlock total. A drill can cross
// more than one (ADR 0005).
export function newUnlocks(before: number, after: number): Character[] {
  return CHARACTERS.filter(
    (character) =>
      !isUnlocked(character, before) && isUnlocked(character, after),
  );
}

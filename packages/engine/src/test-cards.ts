import type { Card, Rank, Suit } from './cards.ts';

/** Parses cards written like `'As Td 2c'` for tests. */
export function cards(text: string): Card[] {
  return text.split(' ').map((code) => ({ rank: code[0] as Rank, suit: code[1] as Suit }));
}

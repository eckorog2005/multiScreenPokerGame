import type { Card, Rank, Suit } from './cards.ts';

/** `cards('As Td 2c')` */
export function cards(text: string): Card[] {
  return text.split(' ').map((code) => ({ rank: code[0] as Rank, suit: code[1] as Suit }));
}

export function cardCodes(cards: readonly Card[]): string {
  return cards.map((card) => card.rank + card.suit).join(' ');
}

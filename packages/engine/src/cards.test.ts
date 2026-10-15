import { expect, test } from 'vitest';
import { newDeck } from './index.ts';
import { cardCodes } from './test-cards.ts';

test('a new deck has 52 distinct cards, 13 of each suit', () => {
  const deck = newDeck();
  expect(deck).toHaveLength(52);
  expect(new Set(cardCodes(deck).split(' ')).size).toBe(52);
  for (const suit of ['c', 'd', 'h', 's']) {
    expect(deck.filter((c) => c.suit === suit)).toHaveLength(13);
  }
});

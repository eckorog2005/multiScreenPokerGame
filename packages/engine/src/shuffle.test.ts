import { expect, test } from 'vitest';
import { cryptoRng, newDeck, shuffle, type Rng } from './index.ts';
import { cardCodes } from './test-cards.ts';

function seededRng(seed: number): Rng {
  let state = seed;
  return (maxExclusive) => {
    state = (state * 48271) % 2147483647;
    return state % maxExclusive;
  };
}

test('the same injected RNG gives the same order', () => {
  expect(cardCodes(shuffle(newDeck(), seededRng(7)))).toBe(cardCodes(shuffle(newDeck(), seededRng(7))));
  expect(cardCodes(shuffle(newDeck(), seededRng(7)))).not.toBe(cardCodes(shuffle(newDeck(), seededRng(8))));
});

test('shuffling returns a reordering of the same cards and leaves the input alone', () => {
  const deck = newDeck();
  const before = cardCodes(deck);
  const shuffled = shuffle(deck, seededRng(1));
  expect(cardCodes(deck)).toBe(before);
  expect(cardCodes(shuffled)).not.toBe(before);
  expect(sortedCodes(cardCodes(shuffled))).toBe(sortedCodes(before));
});

test('shuffles with the crypto RNG by default', () => {
  const shuffled = shuffle(newDeck());
  expect(new Set(cardCodes(shuffled).split(' ')).size).toBe(52);
  expect(cardCodes(shuffled)).not.toBe(cardCodes(newDeck()));
});

test('the crypto RNG returns whole numbers below the limit', () => {
  for (let i = 0; i < 1000; i++) {
    const n = cryptoRng(52);
    expect(Number.isInteger(n) && n >= 0 && n < 52).toBe(true);
  }
});

function sortedCodes(codes: string): string {
  return codes.split(' ').sort().join(' ');
}

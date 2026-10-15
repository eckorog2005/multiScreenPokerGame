import { expect, test } from 'vitest';
import { cryptoRng, newDeck, shuffle, type Rng } from './index.ts';

function seededRng(seed: number): Rng {
  let state = seed;
  return (maxExclusive) => {
    state = (state * 1103515245 + 12345) % 2 ** 31;
    return state % maxExclusive;
  };
}

const key = (cards: { rank: string; suit: string }[]) => cards.map((c) => c.rank + c.suit).join(' ');

test('the same injected RNG gives the same order', () => {
  expect(key(shuffle(newDeck(), seededRng(7)))).toBe(key(shuffle(newDeck(), seededRng(7))));
  expect(key(shuffle(newDeck(), seededRng(7)))).not.toBe(key(shuffle(newDeck(), seededRng(8))));
});

test('shuffling returns a reordering of the same cards and leaves the input alone', () => {
  const deck = newDeck();
  const before = key(deck);
  const shuffled = shuffle(deck, seededRng(1));
  expect(key(deck)).toBe(before);
  expect(key(shuffled)).not.toBe(before);
  expect(key([...shuffled].sort(byKey))).toBe(key([...deck].sort(byKey)));
});

test('shuffles with the crypto RNG by default', () => {
  const shuffled = shuffle(newDeck());
  expect(new Set(shuffled.map((c) => c.rank + c.suit)).size).toBe(52);
  expect(key(shuffled)).not.toBe(key(newDeck()));
});

test('the crypto RNG returns whole numbers below the limit', () => {
  for (let i = 0; i < 1000; i++) {
    const n = cryptoRng(52);
    expect(Number.isInteger(n) && n >= 0 && n < 52).toBe(true);
  }
});

function byKey(a: { rank: string; suit: string }, b: { rank: string; suit: string }) {
  return (a.rank + a.suit).localeCompare(b.rank + b.suit);
}

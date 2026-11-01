import { describe, expect, test } from 'vitest';
import { botAction, newDeck, startHand } from './index.ts';
import type { HandState } from './index.ts';
import { cards } from './test-cards.ts';

/** Heads-up: `bot` is the button (small blind) and acts first preflop; `human` holds 7c 2d. */
function preflop(botHole: string): HandState {
  const bot = cards(botHole);
  const human = cards('7c 2d');
  const used = new Set([...bot, ...human].map((c) => c.rank + c.suit));
  const spare = newDeck().filter((c) => !used.has(c.rank + c.suit));
  return startHand({
    players: [
      { id: 'bot', seat: 1, chips: 1000 },
      { id: 'human', seat: 2, chips: 1000 },
    ],
    button: 1,
    smallBlind: 5,
    bigBlind: 10,
    deck: [human[0]!, bot[0]!, human[1]!, bot[1]!, ...spare],
  });
}

describe('botAction', () => {
  test('raises a strong hand to the minimum raise', () => {
    const hand = preflop('As Ah');
    expect(botAction(hand, 'bot')).toEqual({ type: 'raise', amount: hand.legal!.minRaiseTo });
  });

  test('calls a medium hand', () => {
    expect(botAction(preflop('As 3d'), 'bot')).toEqual({ type: 'call' });
  });

  test('folds a weak hand to a big bet but calls a small one', () => {
    expect(botAction(preflop('8s 3d'), 'bot')).toEqual({ type: 'call' });
    const raised = { ...preflop('8s 3d'), legal: { ...preflop('8s 3d').legal!, toCall: 50 } };
    expect(botAction(raised, 'bot')).toEqual({ type: 'fold' });
  });

  test('checks when it costs nothing and the hand is not strong', () => {
    const hand = preflop('8s 3d');
    const free = { ...hand, legal: { ...hand.legal!, actions: ['check', 'bet'] as const, toCall: 0 } };
    expect(botAction({ ...free, legal: { ...free.legal, minRaiseTo: undefined } }, 'bot')).toEqual({ type: 'check' });
  });
});

import { describe, expect, test } from 'vitest';
import { applyAction, botAction, isRuleError, newDeck, startHand } from './index.ts';
import type { Card, HandState } from './index.ts';
import { cards } from './test-cards.ts';

/** Bot is Seat 2 (big blind) facing a raise of `raiseTo` from the button, or checking its option when null. */
function facing(botHole: string, raiseTo: number | null, stack = 1000): HandState {
  let state = startHand({
    players: [
      { id: 'human', seat: 1, chips: stack },
      { id: 'bot', seat: 2, chips: stack },
    ],
    button: 1,
    smallBlind: 5,
    bigBlind: 10,
    deck: newDeck(),
  });
  state = applyAction(
    state,
    'human',
    raiseTo === null ? { type: 'call' } : { type: 'raise', amount: raiseTo },
  ) as HandState;
  const holeCards = cards(botHole) as [Card, Card];
  return { ...state, players: state.players.map((p) => (p.id === 'bot' ? { ...p, holeCards } : p)) };
}

describe('botAction', () => {
  test('checks a weak hand for free', () => {
    expect(botAction(facing('7c 2d', null), 'bot')).toEqual({ type: 'check' });
  });

  test('folds a weak hand to a big bet', () => {
    expect(botAction(facing('7c 2d', 100), 'bot')).toEqual({ type: 'fold' });
  });

  test('calls a medium hand', () => {
    expect(botAction(facing('Kc 7d', 30), 'bot')).toEqual({ type: 'call' });
  });

  test('folds a medium hand when the call is half its stack', () => {
    expect(botAction(facing('Kc 7d', 600), 'bot')).toEqual({ type: 'fold' });
  });

  test('raises a strong hand', () => {
    const action = botAction(facing('Ac Ad', 30), 'bot');
    expect(action.type).toBe('raise');
  });

  test('always returns a legal action', () => {
    for (const hole of ['7c 2d', 'Kc 7d', 'Ac Ad', 'Js Ts']) {
      for (const raiseTo of [null, 30, 200, 1000]) {
        const state = facing(hole, raiseTo);
        expect(isRuleError(applyAction(state, 'bot', botAction(state, 'bot')))).toBe(false);
      }
    }
  });
});

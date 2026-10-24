import { describe, expect, test } from 'vitest';
import { newDeck, startHand, applyAction, isRuleError } from './index.ts';
import type { Action, HandState } from './index.ts';
import { cardCodes, cards } from './test-cards.ts';

type Setup = {
  /** `[id, chips]`; Seats are 1, 2, 3... in order. */
  players: [string, number][];
  button: string;
  holes?: Record<string, string>;
  board?: string;
  blinds?: [number, number];
};

const sumStacks = (state: HandState) => state.players.reduce((sum, p) => sum + p.stack, 0);
const sumCommitted = (state: HandState) => state.players.reduce((sum, p) => sum + p.committed, 0);

function start(setup: Setup): { state: HandState; total: number } {
  const players = setup.players.map(([id, chips], i) => ({ id, seat: i + 1, chips }));
  const button = players.findIndex((p) => p.id === setup.button) + 1;
  const afterButton = [...players.filter((p) => p.seat > button), ...players.filter((p) => p.seat <= button)];

  const wanted = [
    ...afterButton.map((p) => (setup.holes?.[p.id] ? cards(setup.holes[p.id]!)[0]! : undefined)),
    ...afterButton.map((p) => (setup.holes?.[p.id] ? cards(setup.holes[p.id]!)[1]! : undefined)),
  ];
  const boardCards = setup.board ? cards(setup.board) : [];
  const used = new Set([...wanted, ...boardCards].filter(Boolean).map((c) => c!.rank + c!.suit));
  const spare = newDeck().filter((c) => !used.has(c.rank + c.suit));
  const hole = wanted.map((c) => c ?? spare.shift()!);
  const board = Array.from({ length: 5 }, (_, i) => boardCards[i] ?? spare.shift()!);

  const [smallBlind, bigBlind] = setup.blinds ?? [5, 10];
  const state = startHand({ players, button, smallBlind, bigBlind, deck: [...hole, ...board, ...spare] });
  return { state, total: players.reduce((sum, p) => sum + p.chips, 0) };
}

function parse(text: string): Action {
  const [type, amount] = text.split(' ');
  if (type === 'bet' || type === 'raise') return { type, amount: Number(amount) };
  return { type: type === 'allin' ? 'all-in' : (type as 'fold' | 'check' | 'call' | 'show') };
}

/** Plays `'id action'` steps, checking Chips are conserved after each one. */
function play(state: HandState, total: number, ...steps: string[]): HandState {
  let current = state;
  for (const step of steps) {
    const [id, ...rest] = step.split(' ');
    const next = applyAction(current, id!, parse(rest.join(' ')));
    if (isRuleError(next)) throw new Error(`${step}: ${next.message}`);
    current = next;
    expect(current.street === 'complete' ? sumStacks(current) : sumStacks(current) + sumCommitted(current)).toBe(total);
  }
  return current;
}

function errorOf(state: HandState, id: string, action: string) {
  const result = applyAction(state, id, parse(action));
  if (!isRuleError(result)) throw new Error(`Expected ${id} ${action} to be rejected`);
  return result.error;
}

describe('blinds', () => {
  test('three-handed: small blind left of the button, first to act left of the big blind', () => {
    const { state } = start({
      players: [
        ['a', 1000],
        ['b', 1000],
        ['c', 1000],
      ],
      button: 'a',
    });
    expect(state.players.map((p) => [p.id, p.bet, p.stack])).toEqual([
      ['a', 0, 1000],
      ['b', 5, 995],
      ['c', 10, 990],
    ]);
    expect(state.toAct).toBe('a');
  });

  test('heads-up: the button posts the small blind and acts first before the flop, last after it', () => {
    const { state, total } = start({
      players: [
        ['a', 1000],
        ['b', 1000],
      ],
      button: 'a',
    });
    expect(state.players.map((p) => [p.id, p.bet])).toEqual([
      ['a', 5],
      ['b', 10],
    ]);
    expect(state.toAct).toBe('a');

    const flop = play(state, total, 'a call', 'b check');
    expect(flop.street).toBe('flop');
    expect(flop.toAct).toBe('b');
    expect(play(flop, total, 'b check').toAct).toBe('a');
  });

  test('a Player with fewer Chips than the blind posts it all-in for less', () => {
    const { state } = start({
      players: [
        ['a', 1000],
        ['b', 3],
        ['c', 7],
      ],
      button: 'a',
    });
    const [, b, c] = state.players;
    expect([b!.bet, b!.stack, b!.allIn]).toEqual([3, 0, true]);
    expect([c!.bet, c!.stack, c!.allIn]).toEqual([7, 0, true]);
    expect(state.toAct).toBe('a');
    expect(state.legal!.toCall).toBe(7);
  });

  test('blinds that put everyone all-in run the Board out immediately', () => {
    const { state } = start({
      players: [
        ['a', 4],
        ['b', 8],
      ],
      button: 'a',
    });
    expect(state.street).toBe('complete');
    expect(state.board).toHaveLength(5);
  });
});

describe('betting rounds', () => {
  test('pre-flop, flop, turn and river, in order, to a Showdown', () => {
    const { state, total } = start({
      players: [
        ['a', 1000],
        ['b', 1000],
        ['c', 1000],
      ],
      button: 'a',
    });
    expect(state.street).toBe('preflop');

    const flop = play(state, total, 'a call', 'b call', 'c check');
    expect([flop.street, flop.board.length, flop.toAct]).toEqual(['flop', 3, 'b']);

    const turn = play(flop, total, 'b check', 'c check', 'a check');
    expect([turn.street, turn.board.length, turn.toAct]).toEqual(['turn', 4, 'b']);

    const river = play(turn, total, 'b check', 'c check', 'a check');
    expect([river.street, river.board.length, river.toAct]).toEqual(['river', 5, 'b']);

    const done = play(river, total, 'b check', 'c check', 'a check');
    expect(done.street).toBe('complete');
    expect(done.result!.showdown).toBe(true);
  });

  test('the big blind gets the option when everyone limps', () => {
    const { state, total } = start({
      players: [
        ['a', 1000],
        ['b', 1000],
        ['c', 1000],
      ],
      button: 'a',
    });
    const afterLimps = play(state, total, 'a call', 'b call');
    expect(afterLimps.street).toBe('preflop');
    expect(afterLimps.legal!.actions).toContain('raise');
  });

  test('hole cards stay hidden until Showdown', () => {
    const { state, total } = start({
      players: [
        ['a', 1000],
        ['b', 1000],
      ],
      button: 'a',
    });
    expect(state.holeCardsRevealed).toBe(false);
    expect(play(state, total, 'a call').holeCardsRevealed).toBe(false);
  });
});

describe('legal actions', () => {
  test('expose the current Player, their options and the raise range', () => {
    const { state } = start({
      players: [
        ['a', 1000],
        ['b', 1000],
        ['c', 100],
      ],
      button: 'a',
    });
    expect(state.legal).toEqual({
      playerId: 'a',
      actions: ['fold', 'call', 'raise', 'all-in'],
      toCall: 10,
      minRaiseTo: 20,
      maxRaiseTo: 1000,
    });
  });

  test('check replaces call and bet replaces raise when nothing has been bet', () => {
    const { state, total } = start({
      players: [
        ['a', 1000],
        ['b', 1000],
      ],
      button: 'a',
    });
    const flop = play(state, total, 'a call', 'b check');
    expect(flop.legal).toMatchObject({
      actions: ['fold', 'check', 'bet', 'all-in'],
      toCall: 0,
      minRaiseTo: 10,
      maxRaiseTo: 990,
    });
  });

  test('a short stack can only call all-in or fold', () => {
    const { state } = start({
      players: [
        ['a', 6],
        ['b', 1000],
        ['c', 1000],
      ],
      button: 'a',
    });
    expect(state.legal).toMatchObject({ playerId: 'a', actions: ['fold', 'call', 'all-in'], toCall: 6 });
    expect(state.legal!.minRaiseTo).toBeUndefined();
  });

  test('rejects actions out of turn, illegal actions and bad amounts', () => {
    const { state } = start({
      players: [
        ['a', 1000],
        ['b', 1000],
        ['c', 1000],
      ],
      button: 'a',
    });
    expect(errorOf(state, 'b', 'call')).toBe('not-your-turn');
    expect(errorOf(state, 'a', 'check')).toBe('illegal-action');
    expect(errorOf(state, 'a', 'bet 50')).toBe('illegal-action');
    expect(errorOf(state, 'a', 'raise 15')).toBe('invalid-amount');
    expect(errorOf(state, 'a', 'raise 1001')).toBe('invalid-amount');
    expect(errorOf(state, 'a', 'raise 25.5')).toBe('invalid-amount');
    expect(errorOf(state, 'a', 'show')).toBe('illegal-action');
  });
});

describe('minimum raise', () => {
  test('equals the previous raise', () => {
    const { state, total } = start({
      players: [
        ['a', 1000],
        ['b', 1000],
        ['c', 1000],
      ],
      button: 'a',
    });
    const afterRaise = play(state, total, 'a raise 30');
    expect(afterRaise.legal).toMatchObject({ playerId: 'b', minRaiseTo: 50 });
    expect(errorOf(afterRaise, 'b', 'raise 49')).toBe('invalid-amount');

    const afterReraise = play(afterRaise, total, 'b raise 100');
    expect(afterReraise.legal).toMatchObject({ playerId: 'c', minRaiseTo: 170 });
  });

  test('after the flop the minimum bet is the big blind and a raise must match the bet', () => {
    const { state, total } = start({
      players: [
        ['a', 1000],
        ['b', 1000],
      ],
      button: 'a',
    });
    const flop = play(state, total, 'a call', 'b check');
    expect(errorOf(flop, 'b', 'bet 9')).toBe('invalid-amount');
    const afterBet = play(flop, total, 'b bet 40');
    expect(afterBet.legal).toMatchObject({ playerId: 'a', minRaiseTo: 80 });
  });

  test('a Player can go all-in for less than the minimum raise', () => {
    const { state, total } = start({
      players: [
        ['a', 1000],
        ['b', 1000],
        ['c', 25],
      ],
      button: 'a',
    });
    expect(state.legal!.actions).toContain('all-in');
    const afterShove = play(state, total, 'a raise 100', 'b call', 'c allin');
    expect(afterShove.street).not.toBe('complete');
  });
});

describe('reopening the betting', () => {
  const stacks = (c: number): Setup => ({
    players: [
      ['a', 1000],
      ['b', 1000],
      ['c', c],
    ],
    button: 'a',
  });

  test('an all-in smaller than a full raise does not reopen betting for Players who already acted', () => {
    const { state, total } = start(stacks(150));
    const afterShove = play(state, total, 'a raise 100', 'b call', 'c allin');
    expect(afterShove.legal).toMatchObject({ playerId: 'a', actions: ['fold', 'call'], toCall: 50 });
    expect(errorOf(afterShove, 'a', 'raise 400')).toBe('illegal-action');
    expect(errorOf(afterShove, 'a', 'allin')).toBe('illegal-action');
  });

  test('an all-in that is a full raise reopens it', () => {
    const { state, total } = start(stacks(300));
    const afterShove = play(state, total, 'a raise 100', 'b call', 'c allin');
    expect(afterShove.legal).toMatchObject({ playerId: 'a', minRaiseTo: 500 });
  });

  test('a Player who has not yet acted can still raise a short all-in', () => {
    const { state, total } = start(stacks(150));
    const afterShove = play(state, total, 'a raise 100', 'b call', 'c allin', 'a call');
    expect(afterShove.legal).toMatchObject({ playerId: 'b', actions: ['fold', 'call'] });
  });
});

describe('side pots and awards', () => {
  test('a three-way all-in creates two side pots, each awarded to its best eligible hand', () => {
    const { state, total } = start({
      players: [
        ['a', 100],
        ['b', 200],
        ['c', 300],
        ['d', 1000],
      ],
      button: 'd',
      holes: { a: 'Ah Ac', b: 'Kh Kc', c: 'Qh Qc', d: '7c 2h' },
      board: '2s 8d 9h Jc 3s',
    });
    const done = play(state, total, 'c allin', 'd call', 'a allin', 'b allin');

    expect(done.street).toBe('complete');
    expect(done.holeCardsRevealed).toBe(true);
    expect(done.result!.pots.map((pot) => [pot.amount, pot.eligible, pot.winners.map((w) => w.playerId)])).toEqual([
      [400, ['a', 'b', 'c', 'd'], ['a']],
      [300, ['b', 'c', 'd'], ['b']],
      [200, ['c', 'd'], ['c']],
    ]);
    expect(done.players.map((p) => p.stack)).toEqual([400, 300, 200, 700]);
  });

  test('uncalled chips go back to the bettor', () => {
    const { state, total } = start({
      players: [
        ['a', 1000],
        ['b', 50],
      ],
      button: 'a',
      holes: { a: 'Ah Ac', b: '7c 2h' },
      board: 'Ks 8d 9h Jc 3s',
    });
    const done = play(state, total, 'a raise 500', 'b allin');
    expect(done.players.map((p) => p.stack)).toEqual([1050, 0]);
    expect(done.result!.pots).toHaveLength(1);
  });

  test('a split pot divides evenly and the odd Chip goes to the first winner clockwise from the button', () => {
    const { state, total } = start({
      players: [
        ['a', 1000],
        ['b', 1000],
        ['c', 1000],
      ],
      button: 'c',
      holes: { b: '2c 3d', c: '4h 5s' },
      board: 'Ts Jd Qh Kc As',
    });
    const done = play(
      state,
      total,
      'c call',
      'a fold',
      'b check',
      'b check',
      'c check',
      'b check',
      'c check',
      'b check',
      'c check',
    );

    expect(done.result!.pots).toHaveLength(1);
    expect(done.result!.pots[0]!.winners.map((w) => [w.playerId, w.amount])).toEqual([
      ['b', 13],
      ['c', 12],
    ]);
    expect(done.players.map((p) => p.stack)).toEqual([995, 1003, 1002]);
  });

  test('the result lists the hand descriptions', () => {
    const { state, total } = start({
      players: [
        ['a', 1000],
        ['b', 1000],
      ],
      button: 'a',
      holes: { a: 'Ks 7d', b: 'Qs Qd' },
      board: '7c Kh 2s 9d 3c',
    });
    const done = play(state, total, 'a allin', 'b call');
    expect(done.result!.pots[0]!.winners).toEqual([
      { playerId: 'a', amount: 2000, description: 'Two Pair, Kings and Sevens' },
    ]);
    expect(done.result!.hands).toEqual([
      { playerId: 'a', description: 'Two Pair, Kings and Sevens' },
      { playerId: 'b', description: 'Pair of Queens' },
    ]);
  });
});

describe('ending without a Showdown', () => {
  test('when everyone else folds the Hand ends and the winner can choose to show', () => {
    const { state, total } = start({
      players: [
        ['a', 1000],
        ['b', 1000],
        ['c', 1000],
      ],
      button: 'a',
    });
    const done = play(state, total, 'a fold', 'b fold');

    expect(done.street).toBe('complete');
    expect(done.holeCardsRevealed).toBe(false);
    expect(done.result).toMatchObject({ showdown: false, shownBy: [] });
    expect(done.result!.pots[0]!.winners).toEqual([{ playerId: 'c', amount: 10 }]);
    expect(done.players.map((p) => p.stack)).toEqual([1000, 995, 1005]);

    const shown = play(done, total, 'c show');
    expect(shown.result!.shownBy).toEqual(['c']);
    expect(errorOf(done, 'b', 'show')).toBe('illegal-action');
    expect(errorOf(done, 'c', 'check')).toBe('hand-over');
  });

  test('folding after a bet awards the pot without revealing cards', () => {
    const { state, total } = start({
      players: [
        ['a', 1000],
        ['b', 1000],
      ],
      button: 'a',
    });
    const flop = play(state, total, 'a call', 'b check');
    const done = play(flop, total, 'b bet 50', 'a fold');
    expect(done.result!.showdown).toBe(false);
    expect(done.players.map((p) => p.stack)).toEqual([990, 1010]);
  });
});

describe('all-in runout', () => {
  test('deals the rest of the Board and reveals the Hole Cards', () => {
    const { state, total } = start({
      players: [
        ['a', 1000],
        ['b', 1000],
      ],
      button: 'a',
      holes: { a: 'Ah Ac', b: 'Kh Kc' },
      board: '2s 8d 9h Jc 3s',
    });
    const done = play(state, total, 'a allin', 'b call');

    expect(done.holeCardsRevealed).toBe(true);
    expect(cardCodes(done.board)).toBe('2s 8d 9h Jc 3s');
    expect(done.result!.showdown).toBe(true);
    expect(done.players.map((p) => p.stack)).toEqual([2000, 0]);
  });

  test('runs out from a later street when the last bet is called all-in', () => {
    const { state, total } = start({
      players: [
        ['a', 1000],
        ['b', 1000],
        ['c', 1000],
      ],
      button: 'a',
    });
    const flop = play(state, total, 'a call', 'b call', 'c check');
    const done = play(flop, total, 'b allin', 'c fold', 'a call');
    expect(done.board).toHaveLength(5);
    expect(done.holeCardsRevealed).toBe(true);
  });

  test('does not ask the last Player with Chips to act when nobody can bet against them', () => {
    const { state, total } = start({
      players: [
        ['a', 1000],
        ['b', 1000],
        ['c', 20],
      ],
      button: 'a',
    });
    const done = play(state, total, 'a call', 'b call', 'c allin', 'a call', 'b call');
    expect(done.street).not.toBe('preflop');
  });
});

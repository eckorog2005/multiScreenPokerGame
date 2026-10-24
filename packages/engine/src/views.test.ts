import { describe, expect, expectTypeOf, test } from 'vitest';
import type { ErrorCode } from '@poker/protocol';
import { act, createGame, rebuy, dealHand, isGameError, join, playerView, tableView } from './index.ts';
import type { Card, GameErrorCode, GameState, Rng } from './index.ts';

const first: Rng = () => 0;

function ok(result: GameState | { error: string; message: string }): GameState {
  if (isGameError(result as never)) throw new Error(JSON.stringify(result));
  return result as GameState;
}

function table(...ids: string[]): GameState {
  const game = ids.reduce(
    (g, id, i) => ok(join(g, { playerId: id, name: id.toUpperCase(), seat: i + 1 })),
    createGame(),
  );
  return ok(dealHand(game, { by: ids[0], rng: first }));
}

function play(game: GameState, ...steps: string[]): GameState {
  return steps.reduce((g, step) => {
    const [id, type] = step.split(' ');
    return ok(act(g, id!, { type: type as 'fold' | 'check' | 'call' | 'show' }));
  }, game);
}

function toShowdown(game: GameState): GameState {
  let current = game;
  while (current.hand!.toAct) {
    const id = current.hand!.toAct;
    const legal = current.hand!.legal!.actions;
    current = ok(act(current, id, { type: legal.includes('check') ? 'check' : 'call' }));
  }
  return current;
}

const holes = (game: GameState, id: string): Card[] => [...game.hand!.players.find((p) => p.id === id)!.holeCards];
const shows = (view: unknown, card: Card): boolean => JSON.stringify(view).includes(JSON.stringify(card));
const hidden = (game: GameState, ids: string[]): Card[] => [
  ...game.hand!.deck,
  ...ids.flatMap((id) => holes(game, id)),
];

describe('tableView', () => {
  test('shows no Hole Cards and no deck mid-Hand', () => {
    const game = table('a', 'b', 'c');
    const view = tableView(game);
    for (const card of hidden(game, ['a', 'b', 'c'])) expect(shows(view, card)).toBe(false);
    expect(view.seats.every((s) => s.revealedCards === null)).toBe(true);
  });

  test('shows only the dealt Board', () => {
    const game = play(table('a', 'b', 'c'), 'a call', 'b call', 'c check');
    expect(game.hand!.board).toHaveLength(3);
    const view = tableView(game);
    expect(view.hand!.board).toEqual(game.hand!.board);
    for (const card of hidden(game, ['a', 'b', 'c'])) expect(shows(view, card)).toBe(false);
  });

  test('describes Seats, button, blinds, bets and the pot', () => {
    const view = tableView(table('a', 'b', 'c'));
    expect(view).toMatchObject({ role: 'table', hostId: 'a', smallBlind: 5, bigBlind: 10 });
    expect(view.hand).toMatchObject({ street: 'preflop', pot: 15, currentBet: 10, toAct: 'a', result: null });
    expect(view.seats.map((s) => [s.seat, s.name, s.chips, s.bet, s.isButton])).toEqual([
      [1, 'A', 1000, 0, true],
      [2, 'B', 995, 5, false],
      [3, 'C', 990, 10, false],
    ]);
  });

  test('reveals every live hand at Showdown but not folded ones', () => {
    const game = toShowdown(play(table('a', 'b', 'c'), 'a fold'));
    expect(game.hand!.result!.showdown).toBe(true);
    const view = tableView(game);
    for (const card of [...holes(game, 'b'), ...holes(game, 'c')]) expect(shows(view, card)).toBe(true);
    for (const card of [...holes(game, 'a'), ...game.hand!.deck]) expect(shows(view, card)).toBe(false);
    expect(view.hand!.result!.hands.map((h) => h.playerId).sort()).toEqual(['b', 'c']);
  });

  test('reveals an uncontested winner only if they choose to show', () => {
    const won = play(table('a', 'b', 'c'), 'a fold', 'b fold');
    let view = tableView(won);
    for (const card of [...holes(won, 'c'), ...holes(won, 'b')]) expect(shows(view, card)).toBe(false);

    view = tableView(play(won, 'c show'));
    for (const card of holes(won, 'c')) expect(shows(view, card)).toBe(true);
    for (const card of [...holes(won, 'a'), ...holes(won, 'b'), ...won.hand!.deck])
      expect(shows(view, card)).toBe(false);
  });

  test('has no hand before the first deal', () => {
    expect(tableView(createGame()).hand).toBeNull();
  });
});

test('Seat Chips reflect a Rebuy taken after the Hand', () => {
  const done = play(table('a', 'b', 'c'), 'a fold', 'b fold');
  const broke = { ...done, players: done.players.map((p) => (p.id === 'b' ? { ...p, chips: 0 } : p)) };
  const view = tableView(ok(rebuy(broke, 'b')));
  expect(view.seats.find((s) => s.playerId === 'b')!.chips).toBe(1000);
});

describe('playerView', () => {
  test("includes the Player's own Hole Cards and no one else's or the deck", () => {
    const game = table('a', 'b', 'c');
    const view = playerView(game, 'b');
    for (const card of holes(game, 'b')) expect(shows(view, card)).toBe(true);
    for (const card of hidden(game, ['a', 'c'])) expect(shows(view, card)).toBe(false);
    expect(view.you.holeCards).toEqual(holes(game, 'b'));
  });

  test("gives legal actions and amounts only on the Player's turn, with the amount to call", () => {
    const game = table('a', 'b', 'c');
    const turn = playerView(game, 'a').you;
    expect(turn.toCall).toBe(10);
    expect(turn.legal).toMatchObject({
      actions: ['fold', 'call', 'raise', 'all-in'],
      toCall: 10,
      minRaiseTo: 20,
      maxRaiseTo: 1000,
    });

    const waiting = playerView(game, 'b').you;
    expect(waiting.legal).toBeNull();
    expect(waiting.toCall).toBe(5);
  });

  test('other Players follow the same reveal rules as the Table', () => {
    const game = toShowdown(play(table('a', 'b', 'c'), 'a fold'));
    const view = playerView(game, 'a');
    for (const card of [...holes(game, 'b'), ...holes(game, 'c'), ...holes(game, 'a')])
      expect(shows(view, card)).toBe(true);
    for (const card of game.hand!.deck) expect(shows(view, card)).toBe(false);
  });

  test('a Player folded early still sees only their own cards before Showdown', () => {
    const view = playerView(play(table('a', 'b', 'c'), 'a fold'), 'a');
    expect(view.you.holeCards).not.toBeNull();
    expect(view.you.legal).toBeNull();
    expect(view.seats.every((s) => s.revealedCards === null)).toBe(true);
  });

  test('a Player who joined mid-Hand has no Hole Cards', () => {
    const game = ok(join(table('a', 'b', 'c'), { playerId: 'd', name: 'D', seat: 4 }));
    expect(playerView(game, 'd').you).toMatchObject({ holeCards: null, legal: null, toCall: 0, seat: 4, chips: 1000 });
  });

  test('describes the Player and Host status', () => {
    const view = playerView(table('a', 'b'), 'a');
    expect(view).toMatchObject({
      role: 'player',
      you: { playerId: 'a', name: 'A', isHost: true, rebuys: 0, sittingOut: false },
    });
  });

  test('rejects an unknown Player', () => {
    expect(() => playerView(createGame(), 'nobody')).toThrow(RangeError);
  });
});

test('engine error codes are valid protocol error codes', () => {
  expectTypeOf<GameErrorCode>().toExtend<ErrorCode>();
});

describe('connection status', () => {
  test('marks seats connected unless the predicate says otherwise', () => {
    const game = table('a', 'b');

    const seats = (isConnected?: (id: string) => boolean) =>
      tableView(game, { isConnected }).seats.map((s) => s.connected);

    expect(seats()).toEqual([true, true]);
    expect(seats((id) => id === 'a')).toEqual([true, false]);
    expect(playerView(game, 'a', { isConnected: (id) => id === 'b' }).seats.map((s) => s.connected)).toEqual([
      false,
      true,
    ]);
  });

  test("offers the Host fold-for only on a disconnected Player's turn", () => {
    const game = play(table('a', 'b', 'c'), 'a fold');
    expect(game.hand!.toAct).toBe('b');
    const bAway = { isConnected: (id: string) => id !== 'b' };

    expect(playerView(game, 'a').you.canFoldFor).toBe(false);
    expect(playerView(game, 'a', bAway).you.canFoldFor).toBe(true);
    expect(playerView(game, 'c', bAway).you.canFoldFor).toBe(false);
    expect(playerView(play(game, 'b fold'), 'a', bAway).you.canFoldFor).toBe(false);
  });
});

describe('loop context', () => {
  test('includes whether auto-dealing is paused', () => {
    const game = table('a', 'b');
    expect(tableView(game).paused).toBe(false);
    expect(tableView(game, { paused: true }).paused).toBe(true);
  });

  test('includes the turn time left only while someone is to act', () => {
    const game = table('a', 'b');
    expect(tableView(game).hand!.turnTimeLeftMs).toBeNull();
    expect(tableView(game, { turnTimeLeftMs: 12_000 }).hand!.turnTimeLeftMs).toBe(12_000);
    expect(tableView(play(game, 'a fold'), { turnTimeLeftMs: 12_000 }).hand!.turnTimeLeftMs).toBeNull();
  });

  test('offers Claim Host to seated Players other than the Host once the Host is claimable', () => {
    const game = table('a', 'b');
    expect(playerView(game, 'b').you.canClaimHost).toBe(false);
    expect(playerView(game, 'b', { hostClaimable: true }).you.canClaimHost).toBe(true);
    expect(playerView(game, 'a', { hostClaimable: true }).you.canClaimHost).toBe(false);
  });
});

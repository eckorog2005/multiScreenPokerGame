import { describe, expect, test } from 'vitest';
import {
  act,
  claimHost,
  createGame,
  dealHand,
  foldFor,
  isGameError,
  join,
  leave,
  rebuy,
  removePlayer,
  setBlinds,
  setSittingOut,
  setStartingStack,
  setTurnTimer,
  standings,
} from './index.ts';
import type { GameError, GameState, Rng } from './index.ts';

const first: Rng = () => 0;

function ok(result: GameState | GameError): GameState {
  if (isGameError(result)) throw new Error(`${result.error}: ${result.message}`);
  return result;
}

function errorOf(result: GameState | GameError): string {
  if (!isGameError(result)) throw new Error('Expected an error');
  return result.error;
}

/** Joins players `a`, `b`, ... into Seats 1, 2, ...; the id is the name. */
function tableOf(...ids: string[]): GameState {
  return ids.reduce((game, id, i) => ok(join(game, { playerId: id, name: id, seat: i + 1 })), createGame());
}

function deal(game: GameState, rng: Rng = first): GameState {
  return ok(dealHand(game, { by: game.hostId ?? undefined, rng }));
}

function chips(game: GameState, id: string): number {
  return game.players.find((p) => p.id === id)!.chips;
}

function foldAround(game: GameState): GameState {
  let current = game;
  while (current.hand!.toAct) current = ok(act(current, current.hand!.toAct, { type: 'fold' }));
  return current;
}

describe('joining', () => {
  test('a Player joins with a name and an empty Seat and gets the starting stack', () => {
    const game = tableOf('ann');
    expect(game.players).toMatchObject([{ id: 'ann', seat: 1, chips: 1000, rebuys: 0, sittingOut: false }]);
  });

  test('display names are unique within the Game', () => {
    const game = tableOf('ann');
    expect(errorOf(join(game, { playerId: 'x', name: ' ANN ', seat: 2 }))).toBe('name-taken');
  });

  test('names must not be blank', () => {
    expect(errorOf(join(createGame(), { playerId: 'x', name: '  ', seat: 1 }))).toBe('invalid-name');
  });

  test('a Seat can hold one Player, and there are nine', () => {
    const game = tableOf('ann');
    expect(errorOf(join(game, { playerId: 'bob', name: 'bob', seat: 1 }))).toBe('seat-taken');
    expect(errorOf(join(game, { playerId: 'bob', name: 'bob', seat: 10 }))).toBe('invalid-seat');
    expect(errorOf(join(game, { playerId: 'bob', name: 'bob', seat: 0 }))).toBe('invalid-seat');
    const full = tableOf('a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i');
    expect(full.players).toHaveLength(9);
  });

  test('a seated Player cannot change Seat by joining again', () => {
    const game = tableOf('ann');
    expect(errorOf(join(game, { playerId: 'ann', name: 'ann', seat: 2 }))).toBe('already-seated');
  });

  test('a Player who joins mid-Hand is dealt in from the next Hand', () => {
    const midHand = ok(join(deal(tableOf('a', 'b', 'c')), { playerId: 'd', name: 'd', seat: 4 }));
    expect(midHand.hand!.players.map((p) => p.id)).not.toContain('d');

    const next = deal(foldAround(midHand));
    const dealt = next.hand!.players.find((p) => p.id === 'd')!;
    expect(dealt.stack + dealt.committed).toBe(1000);
    expect(next.hand!.players).toHaveLength(4);
  });
});

describe('Host', () => {
  test('the first Player to join is Host', () => {
    expect(tableOf('ann', 'bob').hostId).toBe('ann');
  });

  test('when the Host leaves, the role passes to the next occupied Seat clockwise', () => {
    let game = ok(join(createGame(), { playerId: 'a', name: 'a', seat: 3 }));
    game = ok(join(game, { playerId: 'b', name: 'b', seat: 1 }));
    game = ok(join(game, { playerId: 'c', name: 'c', seat: 5 }));
    game = ok(leave(game, 'a'));
    expect(game.hostId).toBe('c');
    game = ok(join(game, { playerId: 'a', name: 'a', seat: 2 }));
    expect(game.hostId).toBe('c');
    game = ok(leave(game, 'c'));
    expect(game.hostId).toBe('b');
  });

  test('when the Host is removed, the role passes on', () => {
    const game = ok(removePlayer(tableOf('a', 'b', 'c'), 'a', 'a'));
    expect(game.hostId).toBe('b');
  });

  test('the next joiner becomes Host if nobody is seated', () => {
    const game = ok(leave(tableOf('a'), 'a'));
    expect(game.hostId).toBeNull();
    expect(ok(join(game, { playerId: 'b', name: 'b', seat: 1 })).hostId).toBe('b');
  });

  test('a seated Player can claim Host', () => {
    const game = ok(claimHost(tableOf('a', 'b'), 'b'));
    expect(game.hostId).toBe('b');
  });

  test('a Player without a Seat cannot claim Host', () => {
    const game = ok(leave(tableOf('a', 'b'), 'b'));
    expect(errorOf(claimHost(game, 'b'))).toBe('not-seated');
    expect(errorOf(claimHost(game, 'nobody'))).toBe('unknown-player');
  });
});

describe('settings', () => {
  test('the Host can change the starting stack before the first Hand, resetting everyone', () => {
    const game = ok(setStartingStack(tableOf('a', 'b'), 'a', 500));
    expect(game.startingStack).toBe(500);
    expect(chips(game, 'b')).toBe(500);
    expect(chips(ok(join(game, { playerId: 'c', name: 'c', seat: 3 })), 'c')).toBe(500);
  });

  test('the starting stack is locked once a Hand has been dealt', () => {
    const game = foldAround(deal(tableOf('a', 'b')));
    expect(errorOf(setStartingStack(game, 'a', 500))).toBe('game-started');
  });

  test('blinds can change before the first Hand and between Hands, applying from the next Hand', () => {
    let game = ok(setBlinds(tableOf('a', 'b', 'c'), 'a', 10, 20));
    game = deal(game);
    expect(game.hand!.bigBlind).toBe(20);

    game = foldAround(game);
    game = ok(setBlinds(game, 'a', 25, 50));
    expect(game.hand!.bigBlind).toBe(20);
    game = deal(game);
    expect(game.hand!.smallBlind).toBe(25);
    expect(game.hand!.bigBlind).toBe(50);
  });

  test('blinds cannot change during a Hand', () => {
    expect(errorOf(setBlinds(deal(tableOf('a', 'b', 'c')), 'a', 25, 50))).toBe('hand-in-progress');
  });

  test('blinds must be whole numbers with the big blind at least the small blind', () => {
    const game = tableOf('a', 'b');
    expect(errorOf(setBlinds(game, 'a', 0, 10))).toBe('invalid-setting');
    expect(errorOf(setBlinds(game, 'a', 10, 5))).toBe('invalid-setting');
    expect(errorOf(setBlinds(game, 'a', 2.5, 5))).toBe('invalid-setting');
    expect(errorOf(setStartingStack(game, 'a', 0))).toBe('invalid-setting');
  });

  test('the turn timer is off by default and can be set or cleared', () => {
    let game = tableOf('a');
    expect(game.turnTimerSeconds).toBeNull();
    game = ok(setTurnTimer(game, 'a', 30));
    expect(game.turnTimerSeconds).toBe(30);
    expect(ok(setTurnTimer(game, 'a', null)).turnTimerSeconds).toBeNull();
    expect(errorOf(setTurnTimer(game, 'a', 0))).toBe('invalid-setting');
  });

  test('only the Host can change settings', () => {
    const game = tableOf('a', 'b');
    expect(errorOf(setStartingStack(game, 'b', 500))).toBe('not-host');
    expect(errorOf(setBlinds(game, 'b', 10, 20))).toBe('not-host');
    expect(errorOf(setTurnTimer(game, 'b', 30))).toBe('not-host');
  });
});

describe('dealing', () => {
  test('needs two seated Players with Chips who are not Sitting Out', () => {
    expect(errorOf(dealHand(tableOf('a'), { by: 'a' }))).toBe('not-enough-players');

    const sittingOut = ok(setSittingOut(tableOf('a', 'b'), 'b', true));
    expect(errorOf(dealHand(sittingOut, { by: 'a' }))).toBe('not-enough-players');

    const withoutSeat = ok(leave(tableOf('a', 'b'), 'b'));
    expect(errorOf(dealHand(withoutSeat, { by: 'a' }))).toBe('not-enough-players');
  });

  test('only the Host deals the first Hand', () => {
    expect(errorOf(dealHand(tableOf('a', 'b'), { by: 'b' }))).toBe('not-host');
  });

  test('cannot deal while a Hand is in progress', () => {
    expect(errorOf(dealHand(deal(tableOf('a', 'b', 'c')), { by: 'a' }))).toBe('hand-in-progress');
  });

  test('the first button goes to a random eligible Seat', () => {
    const game = ok(setSittingOut(tableOf('a', 'b', 'c', 'd'), 'a', true));
    expect(deal(game, (n) => n - 1).hand!.button).toBe(4);
    expect(deal(game, () => 0).hand!.button).toBe(2);
  });

  test('later buttons move to the next eligible Seat', () => {
    let game = tableOf('a', 'b', 'c', 'd');
    game = foldAround(deal(game, (n) => n - 1));
    expect(game.hand!.button).toBe(4);
    game = foldAround(deal(game));
    expect(game.hand!.button).toBe(1);

    game = ok(setSittingOut(game, 'b', true));
    game = deal(game);
    expect(game.hand!.button).toBe(3);
  });

  test('Chips flow back to Players when the Hand ends', () => {
    const game = foldAround(deal(tableOf('a', 'b', 'c')));
    expect([chips(game, 'a'), chips(game, 'b'), chips(game, 'c')]).toEqual([1000, 995, 1005]);
  });

  test('a Player acts through the Game and is checked for turn', () => {
    const game = deal(tableOf('a', 'b', 'c'));
    expect(game.hand!.toAct).toBe('a');
    expect(errorOf(act(game, 'b', { type: 'fold' }))).toBe('not-your-turn');
    expect(errorOf(act(tableOf('a', 'b'), 'a', { type: 'fold' }))).toBe('no-hand');
    expect(errorOf(act(game, 'nobody', { type: 'fold' }))).toBe('unknown-player');
  });
});

describe('Sitting Out', () => {
  test('toggling during a Hand only affects the next Hand', () => {
    let game = deal(tableOf('a', 'b', 'c'));
    game = ok(setSittingOut(game, 'c', true));
    expect(game.hand!.players.map((p) => p.id)).toContain('c');
    game = deal(foldAround(game));
    expect(game.hand!.players.map((p) => p.id)).toEqual(['a', 'b']);
  });

  test('returning owes no missed blinds', () => {
    let game = ok(setSittingOut(tableOf('a', 'b', 'c'), 'c', true));
    game = foldAround(deal(game));
    game = ok(setSittingOut(game, 'c', false));
    expect(chips(game, 'c')).toBe(1000);
    const next = deal(game);
    const c = next.hand!.players.find((p) => p.id === 'c')!;
    expect(c.stack + c.committed).toBe(1000);
  });
});

describe('Rebuy', () => {
  function withChips(game: GameState, id: string, amount: number): GameState {
    return { ...game, players: game.players.map((p) => (p.id === id ? { ...p, chips: amount } : p)) };
  }

  test('allowed with 0 Chips between Hands, for exactly the starting stack, and counted', () => {
    const broke = withChips(ok(setStartingStack(tableOf('a', 'b'), 'a', 200)), 'b', 0);
    const after = ok(rebuy(broke, 'b'));
    expect(chips(after, 'b')).toBe(200);
    expect(after.players.find((p) => p.id === 'b')!.rebuys).toBe(1);
  });

  test('rejected after leaving', () => {
    const game = ok(leave(withChips(tableOf('a', 'b'), 'b', 0), 'b'));
    expect(errorOf(rebuy(game, 'b'))).toBe('not-seated');
  });

  test('rejected with Chips', () => {
    expect(errorOf(rebuy(tableOf('a', 'b'), 'a'))).toBe('cannot-rebuy');
  });

  test('rejected during a Hand', () => {
    const game = withChips(deal(tableOf('a', 'b', 'c')), 'c', 0);
    expect(errorOf(rebuy(game, 'c'))).toBe('hand-in-progress');
  });

  test('can be repeated, and Standings count every Rebuy', () => {
    let game = withChips(tableOf('a', 'b'), 'b', 0);
    game = ok(rebuy(game, 'b'));
    game = ok(rebuy(withChips(game, 'b', 0), 'b'));
    expect(game.players.find((p) => p.id === 'b')!.rebuys).toBe(2);
    expect(standings(withChips(game, 'b', 3000)).find((r) => r.playerId === 'b')!.net).toBe(0);
  });
});

describe('leaving', () => {
  test('frees the Seat but keeps the Player and Chips', () => {
    const game = ok(leave(tableOf('a', 'b'), 'b'));
    expect(game.players.find((p) => p.id === 'b')).toMatchObject({ seat: null, chips: 1000 });
    expect(ok(join(game, { playerId: 'c', name: 'c', seat: 2 })).players).toHaveLength(3);
  });

  test('the same Player rejoins into any empty Seat with their Chips', () => {
    let game = foldAround(deal(tableOf('a', 'b', 'c')));
    game = ok(leave(game, 'b'));
    expect(game.players.find((p) => p.id === 'b')!.chips).toBe(995);
    game = ok(join(game, { playerId: 'b', name: 'ignored', seat: 7 }));
    expect(game.players.find((p) => p.id === 'b')).toMatchObject({ name: 'b', seat: 7, chips: 995 });
  });

  test('is rejected mid-Hand until the Player has folded', () => {
    let game = deal(tableOf('a', 'b', 'c'));
    expect(errorOf(leave(game, 'a'))).toBe('cannot-leave');
    game = ok(act(game, 'a', { type: 'fold' }));
    game = ok(leave(game, 'a'));
    expect(game.players.find((p) => p.id === 'a')!.seat).toBeNull();
  });

  test('a Player who left after folding gets their Chips from the finished Hand', () => {
    let game = deal(tableOf('a', 'b', 'c'));
    game = ok(act(game, 'a', { type: 'fold' }));
    game = ok(leave(game, 'a'));
    game = foldAround(game);
    expect(chips(game, 'a')).toBe(1000);
    expect(chips(game, 'b') + chips(game, 'c')).toBe(2000);
  });

  test('is rejected when not seated', () => {
    const game = ok(leave(tableOf('a', 'b'), 'b'));
    expect(errorOf(leave(game, 'b'))).toBe('not-seated');
    expect(errorOf(leave(game, 'nobody'))).toBe('unknown-player');
  });

  test('a left Player keeps their name reserved', () => {
    const game = ok(leave(tableOf('a', 'b'), 'b'));
    expect(errorOf(join(game, { playerId: 'x', name: 'b', seat: 2 }))).toBe('name-taken');
  });
});

describe('removal', () => {
  test('only the Host can remove Players', () => {
    expect(errorOf(removePlayer(tableOf('a', 'b'), 'b', 'a'))).toBe('not-host');
    expect(errorOf(removePlayer(tableOf('a', 'b'), 'a', 'nobody'))).toBe('unknown-player');
  });

  test('a Player in a Hand is folded, even out of turn', () => {
    let game = deal(tableOf('a', 'b', 'c'));
    game = ok(removePlayer(game, 'a', 'c'));
    expect(game.hand!.players.find((p) => p.id === 'c')!.folded).toBe(true);
    expect(game.players.map((p) => p.id)).toEqual(['a', 'b']);
    expect(game.hand!.toAct).toBe('a');
  });

  test('removing the Player on turn moves play on', () => {
    let game = deal(tableOf('a', 'b', 'c'));
    game = ok(removePlayer(game, 'a', 'a'));
    expect(game.hand!.toAct).toBe('b');
  });

  test('removing all but one live Player ends the Hand', () => {
    let game = deal(tableOf('a', 'b', 'c'));
    game = ok(removePlayer(game, 'a', 'b'));
    game = ok(removePlayer(game, 'a', 'c'));
    expect(game.hand!.street).toBe('complete');
    expect(chips(game, 'a')).toBe(1015);
  });

  test('keeps a Standings row using the Chips they had, and frees the name', () => {
    let game = foldAround(deal(tableOf('a', 'b', 'c')));
    game = ok(removePlayer(game, 'a', 'b'));
    expect(standings(game)).toContainEqual({ playerId: 'b', name: 'b', net: -5, removed: true });
    expect(game.players.map((p) => p.id)).toEqual(['a', 'c']);

    game = ok(join(game, { playerId: 'b2', name: 'b', seat: 2 }));
    expect(chips(game, 'b2')).toBe(1000);
  });

  test('a removed Player can join back with the same id as a new Player', () => {
    let game = foldAround(deal(tableOf('a', 'b', 'c')));
    game = ok(removePlayer(game, 'a', 'b'));
    game = ok(join(game, { playerId: 'b', name: 'b', seat: 2 }));
    expect(game.players.find((p) => p.id === 'b')).toMatchObject({ chips: 1000, rebuys: 0 });
    expect(
      standings(game)
        .filter((r) => r.playerId === 'b')
        .map((r) => [r.net, r.removed]),
    ).toEqual([
      [0, false],
      [-5, true],
    ]);
  });

  test('mid-Hand removal counts Chips left behind in the pot as lost', () => {
    let game = deal(tableOf('a', 'b', 'c'));
    game = ok(removePlayer(game, 'a', 'c'));
    expect(standings(game).find((r) => r.playerId === 'c')!.net).toBe(-1000 + 990);
  });
});

describe('fold for', () => {
  test('the Host folds for the Player whose turn it is', () => {
    const game = ok(foldFor(deal(tableOf('a', 'b', 'c')), 'a'));
    expect(game.hand!.players.find((p) => p.id === 'a')!.folded).toBe(true);
    expect(game.hand!.toAct).toBe('b');
  });

  test('is Host-only and needs a Hand', () => {
    const game = deal(tableOf('a', 'b', 'c'));
    expect(errorOf(foldFor(game, 'b'))).toBe('not-host');
    expect(errorOf(foldFor(tableOf('a', 'b'), 'a'))).toBe('no-hand');
    expect(errorOf(foldFor(foldAround(game), 'a'))).toBe('no-hand');
  });
});

describe('Standings', () => {
  test('net result is Chips minus the starting stack and all Rebuys', () => {
    const base = ok(setStartingStack(tableOf('a', 'b'), 'a', 10));
    const game = {
      ...base,
      players: base.players.map((p) => (p.id === 'a' ? { ...p, chips: 45, rebuys: 2 } : p)),
    };
    expect(standings(game).find((r) => r.playerId === 'a')!.net).toBe(45 - 30);
  });

  test('includes Players who left', () => {
    const game = ok(leave(foldAround(deal(tableOf('a', 'b', 'c'))), 'c'));
    expect(standings(game).map((r) => [r.playerId, r.net])).toEqual([
      ['a', 0],
      ['b', -5],
      ['c', 5],
    ]);
  });
});

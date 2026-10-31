import { newDeck } from './cards.ts';
import { applyAction, foldPlayer, isRuleError, startHand } from './hand.ts';
import type { Action, HandState, RuleErrorCode } from './hand.ts';
import { cryptoRng, shuffle } from './shuffle.ts';
import type { Rng } from './shuffle.ts';

export const MAX_SEATS = 9;
export const DEFAULT_STARTING_STACK = 1000;
export const DEFAULT_SMALL_BLIND = 5;
export const DEFAULT_BIG_BLIND = 10;
const BOT_NAMES = ['Ada', 'Ben', 'Cal', 'Dee', 'Eli', 'Fay', 'Gus', 'Hal', 'Ivy'];

export type GamePlayer = {
  readonly id: string;
  readonly name: string;
  /** Null once the Player has left; they keep their Chips. */
  readonly seat: number | null;
  /** Chips as of the last finished Hand. */
  readonly chips: number;
  readonly sittingOut: boolean;
  readonly rebuys: number;
  /** Run by the server; never Host. */
  readonly bot?: boolean;
};

export type StandingsRow = {
  readonly playerId: string;
  readonly name: string;
  readonly net: number;
  readonly removed: boolean;
};

export type GameState = {
  readonly players: readonly GamePlayer[];
  /** Standings rows frozen at the moment the Host removed the Player. */
  readonly removed: readonly StandingsRow[];
  readonly hostId: string | null;
  readonly startingStack: number;
  readonly smallBlind: number;
  readonly bigBlind: number;
  /** Enforced by the server loop, not here. */
  readonly turnTimerSeconds: number | null;
  readonly button: number | null;
  readonly handsDealt: number;
  readonly hand: HandState | null;
};

export type GameErrorCode =
  | RuleErrorCode
  | 'unknown-player'
  | 'not-host'
  | 'invalid-name'
  | 'name-taken'
  | 'invalid-seat'
  | 'seat-taken'
  | 'already-seated'
  | 'not-seated'
  | 'invalid-setting'
  | 'game-started'
  | 'hand-in-progress'
  | 'no-hand'
  | 'not-enough-players'
  | 'cannot-rebuy'
  | 'cannot-leave'
  | 'table-full';

export type GameError = { readonly error: GameErrorCode; readonly message: string };

export type JoinInput = { readonly playerId: string; readonly name: string; readonly seat: number };

export type DealOptions = {
  /** Required for the first Hand, which only the Host can deal. */
  readonly by?: string;
  readonly rng?: Rng;
};

export function isGameError(value: GameState | GameError): value is GameError {
  return 'error' in value;
}

export function createGame(): GameState {
  return {
    players: [],
    removed: [],
    hostId: null,
    startingStack: DEFAULT_STARTING_STACK,
    smallBlind: DEFAULT_SMALL_BLIND,
    bigBlind: DEFAULT_BIG_BLIND,
    turnTimerSeconds: null,
    button: null,
    handsDealt: 0,
    hand: null,
  };
}

export function join(game: GameState, input: JoinInput): GameState | GameError {
  const { playerId, seat } = input;
  if (findPlayer(game, playerId)) return takeSeat(game, playerId, seat);
  const denied = seatDenied(game, seat);
  if (denied) return denied;
  const name = input.name.trim();
  if (!name) return fail('invalid-name', 'A display name is required');
  if (game.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
    return fail('name-taken', `${name} is already taken`);
  }
  const player: GamePlayer = { id: playerId, name, seat, chips: game.startingStack, sittingOut: false, rebuys: 0 };
  return { ...game, players: [...game.players, player], hostId: game.hostId ?? playerId };
}

export function takeSeat(game: GameState, playerId: string, seat: number): GameState | GameError {
  const player = findPlayer(game, playerId);
  if (!player) return unknownPlayer(playerId);
  if (player.seat !== null) return fail('already-seated', 'Seats cannot be changed');
  const denied = seatDenied(game, seat);
  if (denied) return denied;
  const players = game.players.map((p) => (p === player ? { ...p, seat } : p));
  return { ...game, players, hostId: game.hostId ?? playerId };
}

function seatDenied(game: GameState, seat: number): GameError | null {
  if (!Number.isInteger(seat) || seat < 1 || seat > MAX_SEATS) {
    return fail('invalid-seat', `Seat must be from 1 to ${MAX_SEATS}`);
  }
  if (game.players.some((p) => p.seat === seat)) return fail('seat-taken', `Seat ${seat} is taken`);
  return null;
}

export function leave(game: GameState, playerId: string): GameState | GameError {
  const player = findPlayer(game, playerId);
  if (!player) return unknownPlayer(playerId);
  if (player.seat === null) return fail('not-seated', `${player.name} has no Seat`);
  const inHand = game.hand?.players.find((p) => p.id === playerId);
  if (handActive(game) && inHand && !inHand.folded) {
    return fail('cannot-leave', 'Fold before leaving mid-Hand');
  }
  const players = game.players.map((p) => (p === player ? { ...p, seat: null } : p));
  return { ...game, players, hostId: nextHost(game, players, playerId, player.seat) };
}

export function removePlayer(game: GameState, actorId: string, targetId: string): GameState | GameError {
  const denied = requireHost(game, actorId);
  if (denied) return denied;
  const target = findPlayer(game, targetId);
  if (!target) return unknownPlayer(targetId);

  let current = game;
  if (handActive(game) && game.hand!.players.some((p) => p.id === targetId)) {
    const folded = foldPlayer(game.hand!, targetId);
    if (isRuleError(folded)) return folded;
    current = withHand(game, folded);
  }
  const finalChips = current.players.find((p) => p.id === targetId)!.chips;
  const stillInHand = handActive(current) ? current.hand!.players.find((p) => p.id === targetId) : undefined;
  const chipsLeft = stillInHand ? stillInHand.stack : finalChips;

  const players = current.players.filter((p) => p.id !== targetId);
  const row: StandingsRow = {
    playerId: targetId,
    name: target.name,
    net: chipsLeft - netBase(game, target),
    removed: true,
  };
  return {
    ...current,
    players,
    removed: [...current.removed, row],
    hostId: nextHost(current, players, targetId, target.seat),
  };
}

export function addBot(game: GameState, actorId: string, botId: string): GameState | GameError {
  const denied = requireHost(game, actorId);
  if (denied) return denied;
  if (handActive(game)) return fail('hand-in-progress', 'Bots can only be added between Hands');
  const seat = Array.from({ length: MAX_SEATS }, (_, i) => i + 1).find((s) => !game.players.some((p) => p.seat === s));
  if (seat === undefined) return fail('table-full', 'Every Seat is taken');
  const taken = new Set(game.players.map((p) => p.name.toLowerCase()));
  const name = BOT_NAMES.map((n) => `Bot ${n}`).find((n) => !taken.has(n.toLowerCase()));
  if (name === undefined) return fail('name-taken', 'No Bot names are left');
  const bot: GamePlayer = { id: botId, name, seat, chips: game.startingStack, sittingOut: false, rebuys: 0, bot: true };
  return { ...game, players: [...game.players, bot] };
}

export function claimHost(game: GameState, playerId: string): GameState | GameError {
  const player = findPlayer(game, playerId);
  if (!player) return unknownPlayer(playerId);
  if (player.seat === null) return fail('not-seated', 'Only a seated Player can claim Host');
  return { ...game, hostId: playerId };
}

export function transferHost(game: GameState, actorId: string, targetId: string): GameState | GameError {
  const denied = requireHost(game, actorId);
  if (denied) return denied;
  const target = findPlayer(game, targetId);
  if (!target) return unknownPlayer(targetId);
  if (target.seat === null) return fail('not-seated', `${target.name} has no Seat`);
  if (target.bot) return fail('invalid-setting', 'A Bot cannot be Host');
  return { ...game, hostId: targetId };
}

export function setStartingStack(game: GameState, actorId: string, amount: number): GameState | GameError {
  const denied = requireHost(game, actorId);
  if (denied) return denied;
  if (game.handsDealt > 0) return fail('game-started', 'The starting stack is locked after the first Hand');
  if (!isPositiveInteger(amount)) return fail('invalid-setting', 'The starting stack must be a positive whole number');
  return { ...game, startingStack: amount, players: game.players.map((p) => ({ ...p, chips: amount })) };
}

export function setBlinds(
  game: GameState,
  actorId: string,
  smallBlind: number,
  bigBlind: number,
): GameState | GameError {
  const denied = requireHost(game, actorId);
  if (denied) return denied;
  if (handActive(game)) return fail('hand-in-progress', 'Blinds can only change between Hands');
  if (!isPositiveInteger(smallBlind) || !isPositiveInteger(bigBlind) || bigBlind < smallBlind) {
    return fail('invalid-setting', 'Blinds must be positive whole numbers, big blind at least the small blind');
  }
  return { ...game, smallBlind, bigBlind };
}

export function setTurnTimer(game: GameState, actorId: string, seconds: number | null): GameState | GameError {
  const denied = requireHost(game, actorId);
  if (denied) return denied;
  if (seconds !== null && !isPositiveInteger(seconds)) {
    return fail('invalid-setting', 'The turn timer must be off or a positive number of seconds');
  }
  return { ...game, turnTimerSeconds: seconds };
}

export function setSittingOut(game: GameState, playerId: string, sittingOut: boolean): GameState | GameError {
  const player = findPlayer(game, playerId);
  if (!player) return unknownPlayer(playerId);
  return { ...game, players: game.players.map((p) => (p === player ? { ...p, sittingOut } : p)) };
}

export function rebuy(game: GameState, playerId: string): GameState | GameError {
  const player = findPlayer(game, playerId);
  if (!player) return unknownPlayer(playerId);
  if (player.seat === null) return fail('not-seated', 'Rejoin before taking a Rebuy');
  if (handActive(game)) return fail('hand-in-progress', 'Rebuy is only possible between Hands');
  if (player.chips > 0) return fail('cannot-rebuy', 'Rebuy needs 0 Chips');
  const players = game.players.map((p) =>
    p === player ? { ...p, chips: game.startingStack, rebuys: p.rebuys + 1 } : p,
  );
  return { ...game, players };
}

export function dealHand(game: GameState, options: DealOptions = {}): GameState | GameError {
  const { by, rng = cryptoRng } = options;
  if (handActive(game)) return fail('hand-in-progress', 'A Hand is already in progress');
  if (game.handsDealt === 0 && (by === undefined || by !== game.hostId)) {
    return fail('not-host', 'Only the Host deals the first Hand');
  }
  const eligible = game.players
    .filter((p): p is GamePlayer & { seat: number } => p.seat !== null && p.chips > 0 && !p.sittingOut)
    .sort((a, b) => a.seat - b.seat);
  if (eligible.length < 2) return fail('not-enough-players', 'Two seated Players with Chips are needed');

  const button =
    game.button === null
      ? eligible[rng(eligible.length)]!.seat
      : (eligible.find((p) => p.seat > game.button!) ?? eligible[0]!).seat;

  const hand = startHand({
    players: eligible.map((p) => ({ id: p.id, seat: p.seat, chips: p.chips })),
    button,
    smallBlind: game.smallBlind,
    bigBlind: game.bigBlind,
    deck: shuffle(newDeck(), rng),
  });
  return withHand({ ...game, button, handsDealt: game.handsDealt + 1 }, hand);
}

export function act(game: GameState, playerId: string, action: Action): GameState | GameError {
  if (!findPlayer(game, playerId)) return unknownPlayer(playerId);
  if (!game.hand) return fail('no-hand', 'No Hand has been dealt');
  const hand = applyAction(game.hand, playerId, action);
  return isRuleError(hand) ? hand : withHand(game, hand);
}

export function foldFor(game: GameState, actorId: string): GameState | GameError {
  const denied = requireHost(game, actorId);
  if (denied) return denied;
  if (!handActive(game)) return fail('no-hand', 'No Hand is in progress');
  return act(game, game.hand!.toAct!, { type: 'fold' });
}

export function standings(game: GameState): StandingsRow[] {
  const current = game.players.map((p) => ({
    playerId: p.id,
    name: p.name,
    net: p.chips - netBase(game, p),
    removed: false,
  }));
  return [...current, ...game.removed];
}

function netBase(game: GameState, player: GamePlayer): number {
  return game.startingStack * (1 + player.rebuys);
}

function findPlayer(game: GameState, playerId: string): GamePlayer | undefined {
  return game.players.find((p) => p.id === playerId);
}

function handActive(game: GameState): boolean {
  return game.hand !== null && game.hand.street !== 'complete';
}

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

function requireHost(game: GameState, actorId: string): GameError | null {
  return game.hostId === actorId ? null : fail('not-host', 'Only the Host can do that');
}

function unknownPlayer(playerId: string): GameError {
  return fail('unknown-player', `No Player ${playerId} in this Game`);
}

function fail(error: GameErrorCode, message: string): GameError {
  return { error, message };
}

function withHand(game: GameState, hand: HandState): GameState {
  if (hand.street !== 'complete') return { ...game, hand };
  const players = game.players.map((p) => {
    const inHand = hand.players.find((h) => h.id === p.id);
    return inHand ? { ...p, chips: inHand.stack } : p;
  });
  return { ...game, hand, players };
}

function nextHost(
  game: GameState,
  players: readonly GamePlayer[],
  leavingId: string,
  leavingSeat: number | null,
): string | null {
  if (game.hostId !== leavingId) return game.hostId;
  const others = players
    .filter((p): p is GamePlayer & { seat: number } => p.id !== leavingId && p.seat !== null && !p.bot)
    .sort((a, b) => a.seat - b.seat);
  const next = others.find((p) => p.seat > (leavingSeat ?? 0)) ?? others[0];
  return next?.id ?? null;
}

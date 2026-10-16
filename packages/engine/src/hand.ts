import type { Card } from './cards.ts';
import { compareHands, evaluateHand } from './evaluate.ts';

export type Street = 'preflop' | 'flop' | 'turn' | 'river' | 'complete';

export type HandPlayer = {
  readonly id: string;
  readonly seat: number;
  readonly stack: number;
  readonly holeCards: readonly [Card, Card];
  /** Chips put in during the current betting round. */
  readonly bet: number;
  /** Chips put in during the whole Hand. */
  readonly committed: number;
  readonly folded: boolean;
  readonly allIn: boolean;
  /** Acted since the last full raise; such a Player can't raise again. */
  readonly acted: boolean;
};

export type LegalActionType = 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'all-in';

export type LegalActions = {
  readonly playerId: string;
  readonly actions: readonly LegalActionType[];
  readonly toCall: number;
  /** Present when `bet` or `raise` is legal; both are "to" amounts for the round. */
  readonly minRaiseTo?: number;
  readonly maxRaiseTo?: number;
};

export type Action =
  | { readonly type: 'fold' | 'check' | 'call' | 'all-in' | 'show' }
  | { readonly type: 'bet' | 'raise'; readonly amount: number };

export type PotResult = {
  readonly amount: number;
  readonly eligible: readonly string[];
  readonly winners: readonly { readonly playerId: string; readonly amount: number; readonly description?: string }[];
};

export type HandResult = {
  readonly showdown: boolean;
  /** Main pot first, then side pots. */
  readonly pots: readonly PotResult[];
  /** Every hand still in at Showdown. */
  readonly hands: readonly { readonly playerId: string; readonly description: string }[];
  /** Players who chose to show after winning uncontested. */
  readonly shownBy: readonly string[];
};

export type HandState = {
  /** In seat order. */
  readonly players: readonly HandPlayer[];
  readonly button: number;
  readonly smallBlind: number;
  readonly bigBlind: number;
  readonly street: Street;
  readonly board: readonly Card[];
  readonly deck: readonly Card[];
  readonly currentBet: number;
  /** The size of the last full raise. */
  readonly minRaise: number;
  readonly toAct: string | null;
  readonly legal: LegalActions | null;
  readonly holeCardsRevealed: boolean;
  readonly result: HandResult | null;
};

export type RuleErrorCode = 'hand-over' | 'not-your-turn' | 'illegal-action' | 'invalid-amount';

export type RuleError = { readonly error: RuleErrorCode; readonly message: string };

export type StartHandInput = {
  readonly players: readonly { readonly id: string; readonly seat: number; readonly chips: number }[];
  /** Seat of the button; it must be one of the dealt-in Players' Seats. */
  readonly button: number;
  readonly smallBlind: number;
  readonly bigBlind: number;
  /** Cards are dealt from the front. */
  readonly deck: readonly Card[];
};

type Mutable<T> = { -readonly [K in keyof T]: T[K] };
type Player = Mutable<HandPlayer>;
type Draft = Omit<Mutable<HandState>, 'players' | 'board' | 'deck'> & {
  players: Player[];
  board: Card[];
  deck: Card[];
};

const BOARD_CARDS_BY_STREET = { flop: 3, turn: 1, river: 1 } as const;

export function isRuleError(value: HandState | RuleError): value is RuleError {
  return 'error' in value;
}

export function startHand(input: StartHandInput): HandState {
  const { smallBlind, bigBlind, button } = input;
  const seated = [...input.players].sort((a, b) => a.seat - b.seat);
  if (seated.length < 2) throw new RangeError('A Hand needs at least two Players');
  if (new Set(seated.map((p) => p.id)).size !== seated.length) throw new RangeError('Duplicate Player id');
  if (new Set(seated.map((p) => p.seat)).size !== seated.length) throw new RangeError('Duplicate Seat');
  if (seated.some((p) => p.chips <= 0)) throw new RangeError('Every Player needs Chips');
  if (!seated.some((p) => p.seat === button)) throw new RangeError('The button must be on a dealt-in Player');
  if (input.deck.length < seated.length * 2 + 5) throw new RangeError('The deck is too short');

  const deck = [...input.deck];
  const holes = new Map<string, Card[]>(seated.map((p) => [p.id, []]));
  const dealOrder = clockwise(seated, button);
  for (let round = 0; round < 2; round++) {
    for (const p of dealOrder) holes.get(p.id)!.push(deck.shift()!);
  }

  const draft: Draft = {
    players: seated.map((p) => ({
      id: p.id,
      seat: p.seat,
      stack: p.chips,
      holeCards: holes.get(p.id) as [Card, Card],
      bet: 0,
      committed: 0,
      folded: false,
      allIn: false,
      acted: false,
    })),
    button,
    smallBlind,
    bigBlind,
    street: 'preflop',
    board: [],
    deck,
    currentBet: 0,
    minRaise: bigBlind,
    toAct: null,
    legal: null,
    holeCardsRevealed: false,
    result: null,
  };

  const headsUp = seated.length === 2;
  const sbSeat = headsUp ? dealOrder[1]!.seat : dealOrder[0]!.seat;
  const bbSeat = headsUp ? dealOrder[0]!.seat : dealOrder[1]!.seat;
  postBlind(draft, sbSeat, smallBlind);
  postBlind(draft, bbSeat, bigBlind);
  draft.currentBet = Math.max(...draft.players.map((p) => p.bet));

  settle(draft, bbSeat);
  return draft;
}

export function applyAction(state: HandState, playerId: string, action: Action): HandState | RuleError {
  if (state.street === 'complete') return applyShow(state, playerId, action);
  if (state.toAct !== playerId) return fail('not-your-turn', `It is not ${playerId}'s turn`);
  const legal = state.legal!;

  if (action.type === 'show') return fail('illegal-action', 'Cards can only be shown after the Hand');
  if (!legal.actions.includes(action.type)) {
    return fail('illegal-action', `${action.type} is not legal; options: ${legal.actions.join(', ')}`);
  }
  if (action.type === 'bet' || action.type === 'raise') {
    const { amount } = action;
    if (!Number.isInteger(amount) || amount < legal.minRaiseTo! || amount > legal.maxRaiseTo!) {
      return fail('invalid-amount', `${action.type} must be a whole number from ${legal.minRaiseTo} to ${legal.maxRaiseTo}`);
    }
  }

  const draft = clone(state);
  const player = draft.players.find((p) => p.id === playerId)!;

  switch (action.type) {
    case 'fold':
      player.folded = true;
      break;
    case 'check':
      player.acted = true;
      break;
    case 'call':
      commitTo(draft, player, player.bet + Math.min(draft.currentBet - player.bet, player.stack));
      break;
    case 'bet':
    case 'raise':
      commitTo(draft, player, action.amount);
      break;
    case 'all-in':
      commitTo(draft, player, player.bet + player.stack);
      break;
  }

  settle(draft, player.seat);
  return draft;
}

function applyShow(state: HandState, playerId: string, action: Action): HandState | RuleError {
  const result = state.result!;
  const player = state.players.find((p) => p.id === playerId);
  if (action.type !== 'show' || result.showdown || !player || player.folded) {
    return fail('hand-over', 'The Hand is over');
  }
  if (result.shownBy.includes(playerId)) return state;
  return { ...state, result: { ...result, shownBy: [...result.shownBy, playerId] } };
}

function fail(error: RuleErrorCode, message: string): RuleError {
  return { error, message };
}

function clone(state: HandState): Draft {
  return {
    ...state,
    players: state.players.map((p) => ({ ...p })),
    board: [...state.board],
    deck: [...state.deck],
  };
}

/** Players ordered clockwise starting with the first Seat after `seat`. */
function clockwise<T extends { seat: number }>(players: readonly T[], seat: number): T[] {
  return [...players.filter((p) => p.seat > seat), ...players.filter((p) => p.seat <= seat)];
}

function postBlind(draft: Draft, seat: number, amount: number): void {
  const player = draft.players.find((p) => p.seat === seat)!;
  moveChips(player, player.bet + Math.min(amount, player.stack));
}

function moveChips(player: Player, total: number): void {
  const extra = total - player.bet;
  player.stack -= extra;
  player.bet = total;
  player.committed += extra;
  if (player.stack === 0) player.allIn = true;
}

function commitTo(draft: Draft, player: Player, total: number): void {
  const increment = total - draft.currentBet;
  moveChips(player, total);
  if (increment > 0) {
    if (increment >= draft.minRaise) {
      draft.minRaise = increment;
      for (const other of draft.players) if (other !== player) other.acted = false;
    }
    draft.currentBet = total;
  }
  player.acted = true;
}

function legalActionsFor(draft: Draft, player: Player): LegalActions {
  const toCall = Math.min(draft.currentBet - player.bet, player.stack);
  const maxRaiseTo = player.bet + player.stack;
  const minRaiseTo = draft.currentBet === 0 ? draft.bigBlind : draft.currentBet + draft.minRaise;
  const canRaise = !player.acted;

  const actions: LegalActionType[] = ['fold'];
  actions.push(draft.currentBet === player.bet ? 'check' : 'call');
  const canBetOrRaise = canRaise && maxRaiseTo >= minRaiseTo;
  if (canBetOrRaise) actions.push(draft.currentBet === 0 ? 'bet' : 'raise');
  if (canRaise || maxRaiseTo <= draft.currentBet) actions.push('all-in');

  return {
    playerId: player.id,
    actions,
    toCall,
    ...(canBetOrRaise && { minRaiseTo, maxRaiseTo }),
  };
}

/** Moves the Hand forward until a Player must act or the Hand is complete. */
function settle(draft: Draft, fromSeat: number): void {
  for (;;) {
    const live = draft.players.filter((p) => !p.folded);
    if (live.length === 1) {
      collectBets(draft);
      finish(draft, false);
      return;
    }

    const canAct = live.filter((p) => !p.allIn).length;
    const next = clockwise(live, fromSeat).find(
      (p) =>
        !p.allIn &&
        (!p.acted || p.bet < draft.currentBet) &&
        !(canAct <= 1 && p.bet >= draft.currentBet),
    );
    if (next) {
      draft.toAct = next.id;
      draft.legal = legalActionsFor(draft, next);
      return;
    }

    collectBets(draft);
    if (draft.street === 'river' || canAct <= 1) {
      while (draft.board.length < 5) dealStreet(draft);
      finish(draft, true);
      return;
    }
    dealStreet(draft);
    fromSeat = draft.button;
  }
}

function dealStreet(draft: Draft): void {
  const next = draft.board.length === 0 ? 'flop' : draft.board.length === 3 ? 'turn' : 'river';
  draft.board.push(...draft.deck.splice(0, BOARD_CARDS_BY_STREET[next]));
  draft.street = next;
}

/** Ends a betting round, returning any bet nobody matched. */
function collectBets(draft: Draft): void {
  const byBet = [...draft.players].sort((a, b) => b.bet - a.bet);
  const [top, second] = byBet as [Player, Player];
  if (top.bet > second.bet) {
    const uncalled = top.bet - second.bet;
    top.bet -= uncalled;
    top.committed -= uncalled;
    top.stack += uncalled;
  }
  for (const p of draft.players) {
    p.bet = 0;
    p.acted = false;
  }
  draft.currentBet = 0;
  draft.minRaise = draft.bigBlind;
}

function finish(draft: Draft, showdown: boolean): void {
  draft.street = 'complete';
  draft.toAct = null;
  draft.legal = null;
  draft.holeCardsRevealed = showdown;

  const live = draft.players.filter((p) => !p.folded);
  const values = new Map(
    showdown ? live.map((p) => [p.id, evaluateHand(p.holeCards, draft.board)] as const) : [],
  );

  const pots: PotResult[] = [];
  for (const pot of buildPots(draft.players)) {
    const contenders = live.filter((p) => pot.eligible.includes(p.id));
    let winners = contenders;
    if (showdown) {
      const best = contenders.reduce((a, b) =>
        compareHands(values.get(b.id)!, values.get(a.id)!) > 0 ? b : a,
      );
      winners = contenders.filter((p) => compareHands(values.get(p.id)!, values.get(best.id)!) === 0);
    }
    const ordered = clockwise(winners, draft.button);
    const share = Math.floor(pot.amount / ordered.length);
    const oddChips = pot.amount % ordered.length;
    pots.push({
      amount: pot.amount,
      eligible: pot.eligible,
      winners: ordered.map((p, i) => {
        const amount = share + (i < oddChips ? 1 : 0);
        p.stack += amount;
        return showdown ? { playerId: p.id, amount, description: values.get(p.id)!.description } : { playerId: p.id, amount };
      }),
    });
  }

  draft.result = {
    showdown,
    pots,
    hands: showdown ? live.map((p) => ({ playerId: p.id, description: values.get(p.id)!.description })) : [],
    shownBy: [],
  };
}

function buildPots(players: readonly Player[]): { amount: number; eligible: string[] }[] {
  const levels = [...new Set(players.filter((p) => !p.folded && p.committed > 0).map((p) => p.committed))].sort(
    (a, b) => a - b,
  );
  let previous = 0;
  return levels.map((level) => {
    const amount = players.reduce(
      (sum, p) => sum + Math.min(p.committed, level) - Math.min(p.committed, previous),
      0,
    );
    const eligible = players.filter((p) => !p.folded && p.committed >= level).map((p) => p.id);
    previous = level;
    return { amount, eligible };
  });
}

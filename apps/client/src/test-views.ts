import type { HandView, PlayerView, SeatView, YouView } from '@poker/protocol';

export const seat = (overrides: Partial<SeatView>): SeatView => ({
  seat: 1,
  playerId: 'p1',
  name: 'Ada',
  chips: 1000,
  bet: 0,
  isHost: false,
  isButton: false,
  sittingOut: false,
  connected: true,
  inHand: false,
  folded: false,
  allIn: false,
  revealedCards: null,
  ...overrides,
});

export const playerView = (you: Partial<YouView>, seats: SeatView[], rest: Partial<PlayerView> = {}): PlayerView => ({
  role: 'player',
  hostId: null,
  startingStack: 1000,
  smallBlind: 5,
  bigBlind: 10,
  turnTimerSeconds: null,
  paused: false,
  seats,
  hand: null,
  standings: [],
  you: {
    playerId: 'p2',
    name: 'Bob',
    seat: null,
    chips: 1000,
    rebuys: 0,
    sittingOut: false,
    isHost: false,
    holeCards: null,
    toCall: 0,
    legal: null,
    canFoldFor: false,
    canClaimHost: false,
    ...you,
  },
  ...rest,
});

export const hand = (overrides: Partial<HandView>): HandView => ({
  street: 'preflop',
  board: [],
  pot: 15,
  currentBet: 10,
  toAct: null,
  turnTimeLeftMs: null,
  result: null,
  ...overrides,
});

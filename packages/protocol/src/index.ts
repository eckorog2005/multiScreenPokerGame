export const name = '@poker/protocol';

export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'T' | 'J' | 'Q' | 'K' | 'A';
export type Suit = 'c' | 'd' | 'h' | 's';
export type Card = { readonly rank: Rank; readonly suit: Suit };

export type Street = 'preflop' | 'flop' | 'turn' | 'river' | 'complete';
export type LegalActionType = 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'all-in';

export type PlayerAction =
  | { readonly type: 'fold' | 'check' | 'call' | 'all-in' | 'show' }
  | { readonly type: 'bet' | 'raise'; readonly amount: number };

export type ErrorCode =
  | 'hand-over'
  | 'not-your-turn'
  | 'illegal-action'
  | 'invalid-amount'
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
  | 'unknown-game'
  | 'not-joined'
  | 'bad-message';

export type HostCommand =
  | { readonly type: 'deal-hand' }
  | { readonly type: 'set-starting-stack'; readonly amount: number }
  | { readonly type: 'set-blinds'; readonly smallBlind: number; readonly bigBlind: number }
  | { readonly type: 'set-turn-timer'; readonly seconds: number | null }
  | { readonly type: 'set-paused'; readonly paused: boolean }
  | { readonly type: 'remove-player'; readonly playerId: string }
  | { readonly type: 'fold-for' }
  | { readonly type: 'end-game' };

export type ClientMessage =
  | { readonly type: 'create-game' }
  | { readonly type: 'open-table'; readonly code: string }
  | { readonly type: 'join'; readonly code: string; readonly name: string; readonly seat: number }
  | { readonly type: 'resume'; readonly code: string; readonly token: string }
  | { readonly type: 'action'; readonly action: PlayerAction }
  | { readonly type: 'sit-out'; readonly sittingOut: boolean }
  | { readonly type: 'leave' }
  | { readonly type: 'rebuy' }
  | { readonly type: 'claim-host' }
  | { readonly type: 'host'; readonly command: HostCommand };

export type SeatView = {
  readonly seat: number;
  readonly playerId: string;
  readonly name: string;
  readonly chips: number;
  readonly bet: number;
  readonly isHost: boolean;
  readonly isButton: boolean;
  readonly sittingOut: boolean;
  readonly connected: boolean;
  readonly inHand: boolean;
  readonly folded: boolean;
  readonly allIn: boolean;
  /** Only present once the Player's cards are revealed to everyone. */
  readonly revealedCards: readonly [Card, Card] | null;
};

export type PotView = {
  readonly amount: number;
  readonly eligible: readonly string[];
  readonly winners: readonly { readonly playerId: string; readonly amount: number; readonly description?: string }[];
};

export type ResultView = {
  readonly showdown: boolean;
  readonly pots: readonly PotView[];
  readonly hands: readonly { readonly playerId: string; readonly description: string }[];
  readonly shownBy: readonly string[];
};

export type HandView = {
  readonly street: Street;
  readonly board: readonly Card[];
  readonly pot: number;
  readonly currentBet: number;
  readonly toAct: string | null;
  readonly result: ResultView | null;
};

export type StandingsRowView = {
  readonly playerId: string;
  readonly name: string;
  readonly net: number;
  readonly removed: boolean;
};

export type GameViewBase = {
  readonly hostId: string | null;
  readonly startingStack: number;
  readonly smallBlind: number;
  readonly bigBlind: number;
  readonly turnTimerSeconds: number | null;
  readonly seats: readonly SeatView[];
  readonly hand: HandView | null;
  readonly standings: readonly StandingsRowView[];
};

export type TableView = GameViewBase & { readonly role: 'table' };

export type LegalActionsView = {
  readonly actions: readonly LegalActionType[];
  readonly toCall: number;
  /** Present when `bet` or `raise` is legal; both are "to" amounts for the round. */
  readonly minRaiseTo?: number;
  readonly maxRaiseTo?: number;
};

export type YouView = {
  readonly playerId: string;
  readonly name: string;
  readonly seat: number | null;
  readonly chips: number;
  readonly rebuys: number;
  readonly sittingOut: boolean;
  readonly isHost: boolean;
  readonly holeCards: readonly [Card, Card] | null;
  readonly toCall: number;
  /** Present only on the Player's turn. */
  readonly legal: LegalActionsView | null;
};

export type PlayerView = GameViewBase & { readonly role: 'player'; readonly you: YouView };

export type ServerMessage =
  | { readonly type: 'game-created'; readonly code: string }
  | { readonly type: 'joined'; readonly code: string; readonly playerId: string; readonly token: string }
  | { readonly type: 'table-view'; readonly view: TableView }
  | { readonly type: 'player-view'; readonly view: PlayerView }
  | { readonly type: 'error'; readonly error: ErrorCode; readonly message: string };

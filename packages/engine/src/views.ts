import type {
  GameViewBase,
  HandView,
  LegalActionsView,
  PlayerView,
  ResultView,
  SeatView,
  TableView,
} from '@poker/protocol';
import { standings } from './game.ts';
import type { GamePlayer, GameState } from './game.ts';
import type { HandPlayer, HandState } from './hand.ts';

export function tableView(game: GameState): TableView {
  return { role: 'table', ...baseView(game) };
}

export function playerView(game: GameState, playerId: string): PlayerView {
  const player = game.players.find((p) => p.id === playerId);
  if (!player) throw new RangeError(`No Player ${playerId} in this Game`);

  const hand = game.hand;
  const inHand = hand?.players.find((p) => p.id === playerId);
  const live = hand !== null && hand.street !== 'complete' && inHand !== undefined && !inHand.folded;
  const legal: LegalActionsView | null =
    hand?.toAct === playerId && hand.legal
      ? {
          actions: hand.legal.actions,
          toCall: hand.legal.toCall,
          ...(hand.legal.minRaiseTo !== undefined && { minRaiseTo: hand.legal.minRaiseTo }),
          ...(hand.legal.maxRaiseTo !== undefined && { maxRaiseTo: hand.legal.maxRaiseTo }),
        }
      : null;

  return {
    role: 'player',
    ...baseView(game),
    you: {
      playerId,
      name: player.name,
      seat: player.seat,
      chips: chipsOf(game, player, inHand),
      rebuys: player.rebuys,
      sittingOut: player.sittingOut,
      isHost: game.hostId === playerId,
      holeCards: inHand?.holeCards ?? null,
      toCall: live ? Math.min(Math.max(hand.currentBet - inHand.bet, 0), inHand.stack) : 0,
      legal,
    },
  };
}

function baseView(game: GameState): GameViewBase {
  return {
    hostId: game.hostId,
    startingStack: game.startingStack,
    smallBlind: game.smallBlind,
    bigBlind: game.bigBlind,
    turnTimerSeconds: game.turnTimerSeconds,
    seats: seatViews(game),
    hand: handView(game),
    standings: standings(game),
  };
}

function seatViews(game: GameState): SeatView[] {
  return game.players
    .filter((p): p is GamePlayer & { seat: number } => p.seat !== null)
    .sort((a, b) => a.seat - b.seat)
    .map((p) => {
      const inHand = game.hand?.players.find((h) => h.id === p.id);
      return {
        seat: p.seat,
        playerId: p.id,
        name: p.name,
        chips: chipsOf(game, p, inHand),
        bet: inHand?.bet ?? 0,
        isHost: game.hostId === p.id,
        isButton: game.button === p.seat,
        sittingOut: p.sittingOut,
        inHand: inHand !== undefined,
        folded: inHand?.folded ?? false,
        allIn: inHand?.allIn ?? false,
        revealedCards: inHand && isRevealed(game.hand!, inHand) ? inHand.holeCards : null,
      };
    });
}

function handView(game: GameState): HandView | null {
  const hand = game.hand;
  if (!hand) return null;
  const result: ResultView | null = hand.result && {
    showdown: hand.result.showdown,
    pots: hand.result.pots.map((pot) => ({
      amount: pot.amount,
      eligible: pot.eligible,
      winners: pot.winners.map((w) => ({ ...w })),
    })),
    hands: hand.result.hands.map((h) => ({ playerId: h.playerId, description: h.description })),
    shownBy: hand.result.shownBy,
  };
  return {
    street: hand.street,
    board: hand.board,
    pot: hand.players.reduce((sum, p) => sum + p.committed, 0),
    currentBet: hand.currentBet,
    toAct: hand.toAct,
    result,
  };
}

function chipsOf(game: GameState, player: GamePlayer, inHand: HandPlayer | undefined): number {
  const handActive = game.hand !== null && game.hand.street !== 'complete';
  return handActive && inHand ? inHand.stack : player.chips;
}

function isRevealed(hand: HandState, player: HandPlayer): boolean {
  if (!hand.result) return false;
  return (hand.holeCardsRevealed && !player.folded) || hand.result.shownBy.includes(player.id);
}

import { act, botAction, dealHand, isGameError, setSittingOut } from '@poker/engine';
import type { GameError, GameState, ViewContext } from '@poker/engine';
import type { Clock } from './clock.ts';
import { hasConnectedScreen, type ServerGame } from './registry.ts';

export const DEFAULT_AUTO_DEAL_DELAY_MS = 5_000;
export const HOST_CLAIM_AFTER_MS = 60_000;
export const IDLE_GAME_MS = 30 * 60_000;
export const BOT_ACT_DELAY_MS = 1_500;

export type LoopOptions = {
  readonly clock: Clock;
  readonly autoDealDelayMs: number;
  /** Sends fresh views to every screen of the Game. */
  readonly publish: (game: ServerGame) => void;
  /** The Game had no connected screens for `IDLE_GAME_MS`. */
  readonly discard: (game: ServerGame) => void;
};

export type Loop = ReturnType<typeof createLoop>;

export function isConnected(game: ServerGame) {
  return (playerId: string) =>
    game.players.get(playerId)?.screen != null || game.state.players.some((p) => p.id === playerId && p.bot);
}

export function createLoop({ clock, autoDealDelayMs, publish, discard }: LoopOptions) {
  const hostClaimable = (game: ServerGame): boolean => {
    const host = game.state.hostId === null ? undefined : game.players.get(game.state.hostId);
    if (!host || host.screen !== null || host.disconnectedAt === null) return false;
    return clock.now() - host.disconnectedAt >= HOST_CLAIM_AFTER_MS;
  };

  /** Deals the next Hand, first Sitting Out every seated Player who is still disconnected. */
  const deal = (game: ServerGame, by?: string): GameState | GameError => {
    const connected = isConnected(game);
    let state = game.state;
    for (const player of state.players) {
      if (player.seat === null || player.sittingOut || connected(player.id)) continue;
      const next = setSittingOut(state, player.id, true);
      if (!isGameError(next)) state = next;
    }
    return dealHand(state, by === undefined ? {} : { by });
  };

  const timeOut = (game: ServerGame) => {
    const hand = game.state.hand;
    if (!hand?.toAct || !hand.legal) return;
    const next = act(game.state, hand.toAct, { type: hand.legal.actions.includes('check') ? 'check' : 'fold' });
    if (!isGameError(next)) game.state = next;
    changed(game);
  };

  const botAct = (game: ServerGame) => {
    const { hand } = game.state;
    if (!hand?.toAct) return;
    const next = act(game.state, hand.toAct, botAction(hand, hand.toAct));
    if (!isGameError(next)) game.state = next;
    changed(game);
  };

  const autoDeal = (game: ServerGame) => {
    const next = deal(game);
    if (!isGameError(next)) game.state = next;
    changed(game);
  };

  const canAutoDeal = (game: ServerGame): boolean => {
    const { state } = game;
    if (game.ended || game.paused || state.handsDealt === 0 || state.hand?.street !== 'complete') return false;
    const connected = isConnected(game);
    const eligible = state.players.filter((p) => p.seat !== null && p.chips > 0 && !p.sittingOut && connected(p.id));
    return eligible.length >= 2 && eligible.some((p) => !p.bot);
  };

  /** Re-arms the Game's timers for its current state, then publishes it. Call after every change. */
  const changed = (game: ServerGame) => {
    const { state, timers } = game;
    const hand = state.hand;

    const actingBot =
      !game.ended &&
      hand?.street !== 'complete' &&
      hand?.toAct != null &&
      state.players.some((p) => p.id === hand.toAct && p.bot);

    if (actingBot) {
      timers.bot.set(hand, BOT_ACT_DELAY_MS, () => botAct(game));
    } else {
      timers.bot.clear();
    }

    if (
      !game.ended &&
      !actingBot &&
      hand &&
      hand.street !== 'complete' &&
      hand.toAct !== null &&
      state.turnTimerSeconds !== null
    ) {
      timers.turn.set(hand, state.turnTimerSeconds * 1000, () => timeOut(game));
    } else {
      timers.turn.clear();
    }

    if (canAutoDeal(game)) timers.deal.set(hand, autoDealDelayMs, () => autoDeal(game));
    else timers.deal.clear();

    const host = state.hostId === null ? undefined : game.players.get(state.hostId);
    if (!game.ended && host?.disconnectedAt != null && !hostClaimable(game)) {
      const wait = host.disconnectedAt + HOST_CLAIM_AFTER_MS - clock.now();
      timers.hostClaim.set(host.disconnectedAt, wait, () => changed(game));
    } else {
      timers.hostClaim.clear();
    }

    if (hasConnectedScreen(game)) timers.cleanup.clear();
    else timers.cleanup.set('idle', IDLE_GAME_MS, () => discard(game));

    publish(game);
  };

  const viewContext = (game: ServerGame): ViewContext => {
    const turnEndsAt = game.timers.turn.at;
    return {
      isConnected: isConnected(game),
      paused: game.paused,
      ended: game.ended,
      turnTimeLeftMs: turnEndsAt === null ? null : Math.max(turnEndsAt - clock.now(), 0),
      hostClaimable: hostClaimable(game),
    };
  };

  return { changed, deal, hostClaimable, viewContext };
}

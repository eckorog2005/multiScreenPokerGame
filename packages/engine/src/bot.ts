import type { Action, HandState } from './hand.ts';
import { evaluateHand } from './evaluate.ts';

type Tier = 'weak' | 'medium' | 'strong';

const BROADWAY = new Set(['T', 'J', 'Q', 'K', 'A']);

function tierOf(hand: HandState, playerId: string): Tier {
  const [a, b] = hand.players.find((p) => p.id === playerId)!.holeCards;
  if (hand.board.length < 3) {
    if (a.rank === b.rank) return 'strong';
    return BROADWAY.has(a.rank) || BROADWAY.has(b.rank) ? 'medium' : 'weak';
  }
  const { category } = evaluateHand([a, b], hand.board);
  if (category === 'high-card') return 'weak';
  return category === 'pair' ? 'medium' : 'strong';
}

/** The Bot's single fixed strategy: raise strong hands, call medium ones, fold weak ones to big bets. */
export function botAction(hand: HandState, playerId: string): Action {
  const legal = hand.legal!;
  const can = (type: Action['type']) => (legal.actions as readonly string[]).includes(type);
  const tier = tierOf(hand, playerId);
  const free = can('check');

  if (tier === 'strong' && legal.minRaiseTo !== undefined) {
    return { type: can('raise') ? 'raise' : 'bet', amount: legal.minRaiseTo };
  }
  if (free) return { type: 'check' };
  if (tier === 'weak' && legal.toCall > hand.bigBlind) return { type: 'fold' };
  return { type: can('call') ? 'call' : 'all-in' };
}

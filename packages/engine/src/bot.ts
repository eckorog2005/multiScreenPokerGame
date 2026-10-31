import { RANKS } from './cards.ts';
import { evaluateHand } from './evaluate.ts';
import type { Action, HandState } from './hand.ts';

type Strength = 'weak' | 'medium' | 'strong';

const rankIndex = (rank: string) => RANKS.indexOf(rank as (typeof RANKS)[number]);
const TEN = rankIndex('T');

function strength(hand: HandState, playerId: string): Strength {
  const [a, b] = hand.players.find((p) => p.id === playerId)!.holeCards;
  if (hand.board.length === 0) {
    if (a.rank === b.rank) return rankIndex(a.rank) >= TEN ? 'strong' : 'medium';
    return Math.max(rankIndex(a.rank), rankIndex(b.rank)) >= TEN ? 'medium' : 'weak';
  }
  const { category } = evaluateHand([a, b], hand.board);
  if (category === 'high-card') return 'weak';
  return category === 'pair' ? 'medium' : 'strong';
}

/** The Bot's one fixed strategy: no bluffing, nothing random. */
export function botAction(hand: HandState, playerId: string): Action {
  const legal = hand.legal!;
  const { actions, toCall } = legal;
  const level = strength(hand, playerId);
  const stack = hand.players.find((p) => p.id === playerId)!.stack;

  if (level === 'strong' && legal.minRaiseTo !== undefined) {
    return { type: actions.includes('raise') ? 'raise' : 'bet', amount: legal.minRaiseTo };
  }
  if (actions.includes('check')) return { type: 'check' };
  const tooBig = level === 'weak' ? toCall > hand.bigBlind : toCall * 2 >= stack;
  if (level !== 'strong' && tooBig) return { type: 'fold' };
  return { type: actions.includes('call') ? 'call' : 'all-in' };
}

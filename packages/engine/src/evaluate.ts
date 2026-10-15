import { RANKS, type Card, type Rank } from './cards.ts';

const CATEGORIES = [
  'high-card',
  'pair',
  'two-pair',
  'three-of-a-kind',
  'straight',
  'flush',
  'full-house',
  'four-of-a-kind',
  'straight-flush',
] as const;

export type HandCategory = (typeof CATEGORIES)[number];

export type HandValue = {
  readonly category: HandCategory;
  /** The best five cards, most significant first. */
  readonly cards: readonly Card[];
  readonly description: string;
  /** Category strength followed by tie-break ranks; compared element by element. */
  readonly strength: readonly number[];
};

const RANK_NAMES: Record<Rank, string> = {
  '2': 'Two', '3': 'Three', '4': 'Four', '5': 'Five', '6': 'Six', '7': 'Seven', '8': 'Eight',
  '9': 'Nine', T: 'Ten', J: 'Jack', Q: 'Queen', K: 'King', A: 'Ace',
};

export function evaluateHand(holeCards: readonly Card[], board: readonly Card[]): HandValue {
  if (holeCards.length !== 2) throw new RangeError(`Expected 2 Hole Cards, got ${holeCards.length}`);
  if (board.length < 3 || board.length > 5) {
    throw new RangeError(`Expected 3 to 5 Board cards, got ${board.length}`);
  }
  const all = [...holeCards, ...board];
  let best: HandValue | undefined;
  for (const five of combinations(all, 5)) {
    const value = evaluateFive(five);
    if (!best || compareHands(value, best) > 0) best = value;
  }
  return best!;
}

export function compareHands(a: HandValue, b: HandValue): -1 | 0 | 1 {
  for (let i = 0; i < a.strength.length; i++) {
    const diff = a.strength[i]! - b.strength[i]!;
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  return 0;
}

function evaluateFive(five: Card[]): HandValue {
  const groups = groupByRank(five);
  const ordered = groups.flat();
  const ranks = groups.map((group) => rankValue(group[0]!.rank));
  const [first, second] = groups.map((group) => RANK_NAMES[group[0]!.rank]) as [string, string];
  const shape = groups.map((group) => group.length).join('');

  switch (shape) {
    case '41':
      return hand('four-of-a-kind', ordered, ranks, `Four of a Kind, ${plural(first)}`);
    case '32':
      return hand('full-house', ordered, ranks, `Full House, ${plural(first)} over ${plural(second)}`);
    case '311':
      return hand('three-of-a-kind', ordered, ranks, `Three of a Kind, ${plural(first)}`);
    case '221':
      return hand('two-pair', ordered, ranks, `Two Pair, ${plural(first)} and ${plural(second)}`);
    case '2111':
      return hand('pair', ordered, ranks, `Pair of ${plural(first)}`);
  }

  const isFlush = five.every((card) => card.suit === five[0]!.suit);
  const isWheel = ranks.join() === '14,5,4,3,2';
  const isStraight = isWheel || ranks[0]! - ranks[4]! === 4;
  const straightCards = isWheel ? [...ordered.slice(1), ordered[0]!] : ordered;
  const straightRanks = isWheel ? [5, 4, 3, 2, 1] : ranks;
  const straightHigh = RANK_NAMES[straightCards[0]!.rank];

  if (isStraight && isFlush) {
    const description = straightRanks[0] === 14 ? 'Royal Flush' : `Straight Flush, ${straightHigh} High`;
    return hand('straight-flush', straightCards, straightRanks, description);
  }
  if (isFlush) return hand('flush', ordered, ranks, `Flush, ${first} High`);
  if (isStraight) return hand('straight', straightCards, straightRanks, `Straight, ${straightHigh} High`);
  return hand('high-card', ordered, ranks, `High Card, ${first}`);
}

function hand(category: HandCategory, cards: Card[], ranks: number[], description: string): HandValue {
  return { category, cards, description, strength: [CATEGORIES.indexOf(category), ...ranks] };
}

/** Groups cards of equal rank, largest group first, then highest rank first. */
function groupByRank(five: Card[]): Card[][] {
  const byRank = new Map<Rank, Card[]>();
  for (const card of five) byRank.set(card.rank, [...(byRank.get(card.rank) ?? []), card]);
  return [...byRank.values()].sort(
    (a, b) => b.length - a.length || rankValue(b[0]!.rank) - rankValue(a[0]!.rank),
  );
}

function plural(name: string): string {
  return name === 'Six' ? 'Sixes' : `${name}s`;
}

function rankValue(rank: Rank): number {
  return RANKS.indexOf(rank) + 2;
}

function* combinations<T>(items: readonly T[], size: number, start = 0): Generator<T[]> {
  if (size === 0) {
    yield [];
    return;
  }
  for (let i = start; i <= items.length - size; i++) {
    for (const rest of combinations(items, size - 1, i + 1)) yield [items[i]!, ...rest];
  }
}

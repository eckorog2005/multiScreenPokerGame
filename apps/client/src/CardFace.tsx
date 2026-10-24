import type { Card } from '@poker/protocol';

const suits = { c: '♣', d: '♦', h: '♥', s: '♠' } as const;

function cardText({ rank, suit }: Card): string {
  return `${rank === 'T' ? '10' : rank}${suits[suit]}`;
}

function CardFace({ card, small = false }: { card: Card; small?: boolean }) {
  const red = card.suit === 'd' || card.suit === 'h';
  return <span className={['card', small && 'small', red && 'red'].filter(Boolean).join(' ')}>{cardText(card)}</span>;
}

export default CardFace;

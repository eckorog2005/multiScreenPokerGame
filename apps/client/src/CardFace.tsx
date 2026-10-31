import type { Card } from '@poker/protocol';

const suits = {
  c: { glyph: '♣', name: 'clubs' },
  d: { glyph: '♦', name: 'diamonds' },
  h: { glyph: '♥', name: 'hearts' },
  s: { glyph: '♠', name: 'spades' },
} as const;

const rankNames: Record<Card['rank'], string> = {
  A: 'Ace',
  K: 'King',
  Q: 'Queen',
  J: 'Jack',
  T: 'Ten',
  '9': 'Nine',
  '8': 'Eight',
  '7': 'Seven',
  '6': 'Six',
  '5': 'Five',
  '4': 'Four',
  '3': 'Three',
  '2': 'Two',
};

function CardFace({ card, small = false }: { card: Card; small?: boolean }) {
  const red = card.suit === 'd' || card.suit === 'h';
  const suit = suits[card.suit];
  return (
    <span
      role="img"
      aria-label={`${rankNames[card.rank]} of ${suit.name}`}
      className={['card', small && 'small', red && 'red'].filter(Boolean).join(' ')}
    >
      <span aria-hidden="true">{card.rank === 'T' ? '10' : card.rank}</span>
      <span aria-hidden="true">{suit.glyph}</span>
    </span>
  );
}

export default CardFace;

import type { Card } from '@poker/protocol';

const suits = { c: '♣', d: '♦', h: '♥', s: '♠' } as const;

export function cardText({ rank, suit }: Card): string {
  return `${rank === 'T' ? '10' : rank}${suits[suit]}`;
}

export const isRed = ({ suit }: Card) => suit === 'd' || suit === 'h';

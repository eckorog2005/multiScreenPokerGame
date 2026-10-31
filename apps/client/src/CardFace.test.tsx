import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import CardFace from './CardFace.tsx';

test.each([
  ['h', 'Ace of hearts', true],
  ['d', 'Ace of diamonds', true],
  ['s', 'Ace of spades', false],
  ['c', 'Ace of clubs', false],
] as const)('a %s card is named for screen readers and is red only for hearts and diamonds', (suit, name, red) => {
  render(<CardFace card={{ rank: 'A', suit }} />);
  const card = screen.getByRole('img', { name });
  expect(card.classList.contains('red')).toBe(red);
});

test('a Ten shows as 10', () => {
  render(<CardFace card={{ rank: 'T', suit: 's' }} />);
  expect(screen.getByRole('img', { name: 'Ten of spades' })).toHaveTextContent('10♠');
});

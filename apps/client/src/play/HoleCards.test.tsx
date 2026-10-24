import { fireEvent, render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import HoleCards from './HoleCards.tsx';

const cards = [
  { rank: 'A', suit: 's' },
  { rank: 'T', suit: 'h' },
] as const;

test('Hole Cards are face down until held, and turn back face down on release', () => {
  render(<HoleCards cards={cards} />);
  const peek = screen.getByRole('button', { name: /Hold to see your cards/ });
  expect(screen.queryByText('A♠')).not.toBeInTheDocument();

  fireEvent.pointerDown(peek);
  expect(screen.getByText('A♠')).toBeInTheDocument();
  expect(screen.getByText('10♥')).toBeInTheDocument();

  fireEvent.pointerUp(peek);
  expect(screen.queryByText('A♠')).not.toBeInTheDocument();
});

test('a cancelled touch turns the Hole Cards face down', () => {
  render(<HoleCards cards={cards} />);
  const peek = screen.getByRole('button', { name: /Hold to see your cards/ });

  fireEvent.pointerDown(peek);
  fireEvent.pointerCancel(peek);

  expect(screen.queryByText('A♠')).not.toBeInTheDocument();
});

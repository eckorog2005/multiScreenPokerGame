import { act, render, screen, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { hand, seat, tableView } from '../test-views.ts';
import TableTop from './TableTop.tsx';

afterEach(() => {
  vi.useRealTimers();
});

const seatLabelled = (number: number) => screen.getByRole('listitem', { name: `Seat ${number}` });

test("each Seat shows the Player's name, Chip stack, current bet and status", () => {
  render(
    <TableTop
      view={tableView([
        seat({ seat: 1, playerId: 'p1', name: 'Ada', chips: 980, bet: 20, inHand: true }),
        seat({ seat: 2, playerId: 'p2', name: 'Bob', sittingOut: true }),
        seat({ seat: 4, playerId: 'p3', name: 'Cy', connected: false, inHand: true, folded: true }),
        seat({ seat: 6, playerId: 'p4', name: 'Di', chips: 0, bet: 400, inHand: true, allIn: true }),
      ])}
    />,
  );

  expect(seatLabelled(1)).toHaveTextContent('Ada');
  expect(seatLabelled(1)).toHaveTextContent('980 Chips');
  expect(seatLabelled(1)).toHaveTextContent('Bet 20');
  expect(seatLabelled(2)).toHaveTextContent('Sitting Out');
  expect(seatLabelled(2)).not.toHaveTextContent('Bet');
  expect(seatLabelled(4)).toHaveTextContent('Disconnected');
  expect(seatLabelled(4)).toHaveTextContent('Folded');
  expect(seatLabelled(6)).toHaveTextContent('All-in');
  expect(seatLabelled(6)).toHaveTextContent('Bet 400');
  expect(within(seatLabelled(3)).getByText('Empty')).toBeInTheDocument();
});

test('marks the button and the blinds, and highlights whose turn it is with the turn timer', () => {
  vi.useFakeTimers();
  const seats = [
    seat({ seat: 1, playerId: 'p1', name: 'Ada', inHand: true, isButton: true }),
    seat({ seat: 2, playerId: 'p2', name: 'Bob', inHand: true, blind: 'small', bet: 5 }),
    seat({ seat: 3, playerId: 'p3', name: 'Cy', inHand: true, blind: 'big', bet: 10 }),
  ];
  const { rerender } = render(
    <TableTop view={tableView(seats, { hand: hand({ toAct: 'p1', turnTimeLeftMs: 12_000 }) })} />,
  );

  expect(within(seatLabelled(1)).getByLabelText('Button')).toBeInTheDocument();
  expect(within(seatLabelled(2)).getByLabelText('Small blind')).toBeInTheDocument();
  expect(within(seatLabelled(3)).getByLabelText('Big blind')).toBeInTheDocument();
  expect(seatLabelled(1)).toHaveAttribute('aria-current', 'true');
  expect(seatLabelled(2)).not.toHaveAttribute('aria-current');
  expect(within(seatLabelled(1)).getByRole('timer')).toHaveTextContent('12s');

  act(() => vi.advanceTimersByTime(3_000));
  expect(within(seatLabelled(1)).getByRole('timer')).toHaveTextContent('9s');

  rerender(<TableTop view={tableView(seats, { hand: hand({ toAct: 'p2', turnTimeLeftMs: 30_000 }) })} />);
  expect(seatLabelled(2)).toHaveAttribute('aria-current', 'true');
  expect(within(seatLabelled(2)).getByRole('timer')).toHaveTextContent('30s');

  rerender(<TableTop view={tableView(seats, { hand: hand({ toAct: 'p2' }) })} />);
  expect(screen.queryByRole('timer')).not.toBeInTheDocument();
});

const potTexts = () =>
  within(screen.getByRole('list', { name: 'Pots' }))
    .getAllByRole('listitem')
    .map((item) => item.textContent);

const flop = [
  { rank: 'K', suit: 'h' },
  { rank: '7', suit: 'c' },
  { rank: 'T', suit: 'd' },
] as const;

test('shows the Board and the pot', () => {
  render(<TableTop view={tableView([], { hand: hand({ street: 'flop', board: flop, pot: 60, pots: [] }) })} />);

  const board = screen.getByRole('region', { name: 'Board' });
  expect(board).toHaveTextContent('K♥7♣10♦');
  expect(potTexts()).toEqual(['Pot 60']);
});

test('shows the main pot and side pots separately', () => {
  const pots = [
    { amount: 300, eligible: ['p1', 'p2', 'p3'] },
    { amount: 400, eligible: ['p2', 'p3'] },
    { amount: 100, eligible: ['p3'] },
  ];
  render(<TableTop view={tableView([], { hand: hand({ board: flop, pot: 800, pots }) })} />);

  expect(potTexts()).toEqual(['Main pot 300', 'Side pot 400', 'Side pot 2 100']);
});

const river = [...flop, { rank: '2', suit: 's' }, { rank: '7', suit: 'h' }] as const;

test('at Showdown, shows each revealed hand with its description and who won each pot', () => {
  const seats = [
    seat({ seat: 1, playerId: 'p1', name: 'Ada', inHand: true, folded: true }),
    seat({
      seat: 2,
      playerId: 'p2',
      name: 'Bob',
      inHand: true,
      allIn: true,
      revealedCards: [
        { rank: 'K', suit: 's' },
        { rank: 'Q', suit: 'd' },
      ],
    }),
    seat({
      seat: 3,
      playerId: 'p3',
      name: 'Cy',
      inHand: true,
      revealedCards: [
        { rank: 'A', suit: 'c' },
        { rank: 'A', suit: 'd' },
      ],
    }),
  ];
  const result = {
    showdown: true,
    pots: [
      {
        amount: 300,
        eligible: ['p2', 'p3'],
        winners: [{ playerId: 'p2', amount: 300, description: 'Two Pair, Kings and Sevens' }],
      },
      {
        amount: 200,
        eligible: ['p3'],
        winners: [{ playerId: 'p3', amount: 200, description: 'Two Pair, Aces and Sevens' }],
      },
    ],
    hands: [
      { playerId: 'p2', description: 'Two Pair, Kings and Sevens' },
      { playerId: 'p3', description: 'Two Pair, Aces and Sevens' },
    ],
    shownBy: [],
  };
  render(
    <TableTop
      view={tableView(seats, {
        hand: hand({ street: 'complete', board: river, pot: 500, pots: [], toAct: null, result }),
      })}
    />,
  );

  expect(seatLabelled(2)).toHaveTextContent('K♠Q♦');
  expect(seatLabelled(2)).toHaveTextContent('Two Pair, Kings and Sevens');
  expect(seatLabelled(3)).toHaveTextContent('A♣A♦');
  expect(seatLabelled(3)).toHaveTextContent('Two Pair, Aces and Sevens');
  expect(seatLabelled(1)).not.toHaveTextContent('Two Pair');
  expect(potTexts()).toEqual([
    'Main pot 300Bob wins 300 with Two Pair, Kings and Sevens',
    'Side pot 200Cy wins 200 with Two Pair, Aces and Sevens',
  ]);
});

test('a split pot names every winner, and an uncontested win names no hand', () => {
  const seats = [seat({ seat: 1, playerId: 'p1', name: 'Ada' }), seat({ seat: 2, playerId: 'p2', name: 'Bob' })];
  const split = {
    showdown: true,
    pots: [
      {
        amount: 41,
        eligible: ['p1', 'p2'],
        winners: [
          { playerId: 'p1', amount: 21, description: 'Straight, Ace high' },
          { playerId: 'p2', amount: 20, description: 'Straight, Ace high' },
        ],
      },
    ],
    hands: [],
    shownBy: [],
  };
  const { rerender } = render(
    <TableTop view={tableView(seats, { hand: hand({ street: 'complete', pot: 41, toAct: null, result: split }) })} />,
  );
  expect(potTexts()).toEqual(['Pot 41Ada wins 21 with Straight, Ace highBob wins 20 with Straight, Ace high']);

  const uncontested = {
    showdown: false,
    pots: [{ amount: 30, eligible: ['p2'], winners: [{ playerId: 'p2', amount: 30 }] }],
    hands: [],
    shownBy: [],
  };
  rerender(
    <TableTop
      view={tableView(seats, { hand: hand({ street: 'complete', pot: 30, toAct: null, result: uncontested }) })}
    />,
  );
  expect(potTexts()).toEqual(['Pot 30Bob wins 30']);
});

test('between Hands, says when the Host paused or more Players are needed', () => {
  const ada = seat({ seat: 1, playerId: 'p1', name: 'Ada' });
  const bob = seat({ seat: 2, playerId: 'p2', name: 'Bob' });
  const done = hand({ street: 'complete', toAct: null });
  const status = () => screen.queryByRole('status')?.textContent;
  const { rerender } = render(<TableTop view={tableView([ada])} />);
  expect(status()).toBe('Waiting for players');

  rerender(<TableTop view={tableView([ada, bob])} />);
  expect(status()).toBe('Waiting for the Host to deal');

  rerender(<TableTop view={tableView([ada, bob], { hand: done })} />);
  expect(status()).toBeUndefined();

  for (const away of [{ sittingOut: true }, { connected: false }, { chips: 0 }]) {
    rerender(<TableTop view={tableView([ada, { ...bob, ...away }], { hand: done })} />);
    expect(status()).toBe('Waiting for players');
  }

  rerender(<TableTop view={tableView([ada, bob], { hand: done, paused: true })} />);
  expect(status()).toBe('Paused by Host');

  rerender(<TableTop view={tableView([ada, bob], { hand: hand({ toAct: 'p1' }), paused: true })} />);
  expect(status()).toBeUndefined();
});

test('when the Game ends, shows the Standings sorted by net result instead of the Seats', () => {
  const standings = [
    { playerId: 'p1', name: 'Ada', net: -250, removed: false },
    { playerId: 'p2', name: 'Bob', net: 400, removed: false },
    { playerId: 'p3', name: 'Cy', net: 0, removed: false },
    { playerId: 'p4', name: 'Di', net: -150, removed: true },
  ];
  render(<TableTop view={tableView([seat({ seat: 1 })], { ended: true, standings })} />);

  const table = screen.getByRole('table', { name: 'Standings' });
  const rows = within(table)
    .getAllByRole('row')
    .slice(1)
    .map((row) =>
      within(row)
        .getAllByRole('cell')
        .map((cell) => cell.textContent),
    );
  expect(rows).toEqual([
    ['Bob', '+400'],
    ['Cy', '0'],
    ['Di (removed)', '−150'],
    ['Ada', '−250'],
  ]);
  expect(screen.queryByRole('listitem', { name: 'Seat 1' })).not.toBeInTheDocument();
});

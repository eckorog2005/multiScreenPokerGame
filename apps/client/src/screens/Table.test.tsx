import { act, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import type { SeatView, TableView } from '@poker/protocol';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { FakeWebSocket } from '../connection/fake-websocket.ts';
import Table from './Table.tsx';

function Location() {
  const location = useLocation();
  return <output aria-label="location">{location.pathname + location.search}</output>;
}

function renderTable(url: string) {
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/table" element={<Table />} />
      </Routes>
      <Location />
    </MemoryRouter>,
  );
  const socket = FakeWebSocket.latest();
  act(() => socket.serverOpen());
  return socket;
}

const seat = (overrides: Partial<SeatView>): SeatView => ({
  seat: 1,
  playerId: 'p1',
  name: 'Ada',
  chips: 1000,
  bet: 0,
  isHost: false,
  isButton: false,
  sittingOut: false,
  connected: true,
  inHand: false,
  folded: false,
  allIn: false,
  revealedCards: null,
  ...overrides,
});

const tableView = (seats: SeatView[], hostId: string | null = null): TableView => ({
  role: 'table',
  hostId,
  startingStack: 1000,
  smallBlind: 5,
  bigBlind: 10,
  turnTimerSeconds: null,
  seats,
  hand: null,
  standings: [],
});

beforeEach(() => {
  FakeWebSocket.instances = [];
  vi.stubGlobal('WebSocket', FakeWebSocket);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test('creates a Game and shows its Game Code with a QR link to join it', () => {
  const socket = renderTable('/table');

  expect(socket.sent).toEqual([{ type: 'create-game' }]);
  act(() => socket.serverSend({ type: 'game-created', code: 'ABCD' }));

  expect(screen.getByRole('heading', { name: 'ABCD' })).toBeInTheDocument();
  expect(screen.getByRole('img', { name: /QR code/ })).toBeInTheDocument();
  expect(screen.getByText(`${location.origin}/play?code=ABCD`)).toBeInTheDocument();
  expect(screen.getByRole('status', { name: 'location' })).toHaveTextContent('/table?code=ABCD');
});

test('reattaches to an existing Game from the Game Code in the URL', () => {
  const socket = renderTable('/table?code=WXYZ');

  expect(socket.sent).toEqual([{ type: 'open-table', code: 'WXYZ' }]);
  act(() => socket.serverSend({ type: 'table-view', view: tableView([]) }));

  expect(screen.getByRole('heading', { name: 'WXYZ' })).toBeInTheDocument();
});

test('says so when the Game Code in the URL is unknown', () => {
  const socket = renderTable('/table?code=ZZZZ');

  act(() => socket.serverSend({ type: 'error', error: 'unknown-game', message: 'No Game has that code' }));

  expect(screen.getByText(/No Game has the code ZZZZ/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Host a new Table' })).toHaveAttribute('href', '/table');
});

test('fills in Seats as Players join and marks the Host', () => {
  const socket = renderTable('/table');
  act(() => socket.serverSend({ type: 'game-created', code: 'ABCD' }));
  act(() => socket.serverSend({ type: 'table-view', view: tableView([]) }));
  expect(screen.getAllByRole('listitem')).toHaveLength(9);
  expect(screen.getByRole('listitem', { name: 'Seat 3' })).toHaveTextContent('Empty');

  act(() =>
    socket.serverSend({
      type: 'table-view',
      view: tableView(
        [seat({ seat: 3, playerId: 'p1', name: 'Ada', isHost: true }), seat({ seat: 7, playerId: 'p2', name: 'Bob' })],
        'p1',
      ),
    }),
  );

  expect(screen.getByRole('listitem', { name: 'Seat 3' })).toHaveTextContent('Ada');
  expect(screen.getByRole('listitem', { name: 'Seat 3' })).toHaveTextContent('Host');
  expect(screen.getByRole('listitem', { name: 'Seat 7' })).toHaveTextContent('Bob');
  expect(screen.getByRole('listitem', { name: 'Seat 7' })).not.toHaveTextContent('Host');
});

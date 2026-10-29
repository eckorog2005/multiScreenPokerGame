import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import type { GameSeatsResponse } from '@poker/protocol';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { FakeWebSocket } from '../connection/fake-websocket.ts';
import { loadToken, saveToken } from '../connection/token-store.ts';
import { playerView, seat } from '../test-views.ts';
import PlayerDevice from './PlayerDevice.tsx';

function Location() {
  const location = useLocation();
  return <output aria-label="location">{location.pathname + location.search}</output>;
}

function renderPlay(url: string) {
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/play" element={<PlayerDevice />} />
      </Routes>
      <Location />
    </MemoryRouter>,
  );
  const socket = FakeWebSocket.latest();
  act(() => socket.serverOpen());
  return socket;
}

let seatsByCode: Record<string, GameSeatsResponse> = {};
const fetchSeats = vi.fn(async (url: string) => {
  const code = url.split('/').at(-1)!;
  const body = seatsByCode[code];
  return { ok: body !== undefined, status: body ? 200 : 404, json: async () => body ?? { error: 'unknown-game' } };
});

beforeEach(() => {
  FakeWebSocket.instances = [];
  vi.stubGlobal('WebSocket', FakeWebSocket);
  vi.stubGlobal('fetch', fetchSeats);
  seatsByCode = { ABCD: { code: 'ABCD', seats: [{ seat: 3, name: 'Ada' }] } };
  fetchSeats.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

test('joins with the Game Code from the link, a name and an empty Seat', async () => {
  const user = userEvent.setup();
  const socket = renderPlay('/play?code=ABCD');

  expect(screen.getByLabelText('Game Code')).toHaveValue('ABCD');
  await user.type(screen.getByLabelText('Your name'), 'Bob');
  await user.click(screen.getByRole('button', { name: 'Continue' }));

  expect(fetchSeats).toHaveBeenCalledWith('/api/games/ABCD');
  expect(await screen.findByRole('button', { name: /Seat 3/ })).toBeDisabled();
  expect(screen.getByRole('button', { name: /Seat 3/ })).toHaveTextContent('Ada');
  await user.click(screen.getByRole('button', { name: /Seat 5/ }));

  expect(socket.sent).toEqual([{ type: 'join', code: 'ABCD', name: 'Bob', seat: 5 }]);
  act(() => socket.serverSend({ type: 'joined', code: 'ABCD', playerId: 'p2', token: 'secret' }));
  act(() =>
    socket.serverSend({
      type: 'player-view',
      view: playerView({ seat: 5 }, [seat({ seat: 3 }), seat({ seat: 5, playerId: 'p2', name: 'Bob' })]),
    }),
  );

  expect(screen.getByText(/Seat 5/)).toBeInTheDocument();
  expect(screen.getByRole('status', { name: 'location' })).toHaveTextContent('/play?code=ABCD');
});

async function continueAs(user: ReturnType<typeof userEvent.setup>, code: string, name: string) {
  await user.clear(screen.getByLabelText('Game Code'));
  await user.type(screen.getByLabelText('Game Code'), code);
  await user.clear(screen.getByLabelText('Your name'));
  await user.type(screen.getByLabelText('Your name'), name);
  await user.click(screen.getByRole('button', { name: 'Continue' }));
}

test('shows an unknown Game Code inline', async () => {
  const user = userEvent.setup();
  renderPlay('/play');

  await continueAs(user, 'zzzz', 'Bob');

  expect(await screen.findByRole('alert')).toHaveTextContent('No Game has the code ZZZZ');
  expect(screen.getByLabelText('Game Code')).toHaveValue('ZZZZ');
});

test('shows a taken name inline back on the details step', async () => {
  const user = userEvent.setup();
  const socket = renderPlay('/play');
  await continueAs(user, 'ABCD', 'ada');
  await user.click(await screen.findByRole('button', { name: /Seat 5/ }));

  act(() => socket.serverSend({ type: 'error', error: 'name-taken', message: 'ada is already taken' }));

  expect(screen.getByRole('alert')).toHaveTextContent('That name is already taken');
  expect(screen.getByLabelText('Your name')).toHaveValue('ada');
});

test('shows a taken Seat inline and refreshes the Seats', async () => {
  const user = userEvent.setup();
  const socket = renderPlay('/play');
  await continueAs(user, 'ABCD', 'Bob');
  await user.click(await screen.findByRole('button', { name: /Seat 5/ }));
  seatsByCode.ABCD = {
    code: 'ABCD',
    seats: [
      { seat: 3, name: 'Ada' },
      { seat: 5, name: 'Cy' },
    ],
  };

  act(() => socket.serverSend({ type: 'error', error: 'seat-taken', message: 'Seat 5 is taken' }));

  expect(screen.getByRole('alert')).toHaveTextContent('That Seat was just taken');
  expect(await screen.findByRole('button', { name: /Seat 5 · Cy/ })).toBeDisabled();
});

test('resumes the same Player with the token stored for the Game Code', () => {
  saveToken('ABCD', 'secret');
  const socket = renderPlay('/play?code=ABCD');

  expect(socket.sent).toEqual([{ type: 'resume', code: 'ABCD', token: 'secret' }]);
  expect(screen.getByText(/Rejoining/)).toBeInTheDocument();
  act(() => socket.serverSend({ type: 'joined', code: 'ABCD', playerId: 'p2', token: 'secret' }));
  act(() => socket.serverSend({ type: 'player-view', view: playerView({ seat: 5 }, []) }));

  expect(screen.getByText(/Seat 5/)).toBeInTheDocument();
});

test('falls back to joining when the stored token is no longer known', () => {
  saveToken('ABCD', 'stale');
  const socket = renderPlay('/play?code=ABCD');

  act(() => socket.serverSend({ type: 'error', error: 'unknown-player', message: 'Unknown token' }));

  expect(screen.getByRole('alert')).toHaveTextContent('Join again');
  expect(screen.getByLabelText('Game Code')).toHaveValue('ABCD');
});

test('a Player who left picks an empty Seat and keeps their Chips', async () => {
  const user = userEvent.setup();
  saveToken('ABCD', 'secret');
  const socket = renderPlay('/play?code=ABCD');
  act(() => socket.serverSend({ type: 'joined', code: 'ABCD', playerId: 'p2', token: 'secret' }));

  act(() =>
    socket.serverSend({ type: 'player-view', view: playerView({ seat: null, chips: 1450 }, [seat({ seat: 3 })]) }),
  );

  expect(screen.getByText(/1450 Chips/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Seat 3/ })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: /Seat 6/ }));
  expect(socket.sent.at(-1)).toEqual({ type: 'take-seat', seat: 6 });
});

test('resumes with the stored token when the Game Code is typed instead of linked', async () => {
  const user = userEvent.setup();
  saveToken('ABCD', 'secret');
  const socket = renderPlay('/play');

  await continueAs(user, 'ABCD', 'Bob');

  expect(socket.sent).toEqual([{ type: 'resume', code: 'ABCD', token: 'secret' }]);
  expect(fetchSeats).not.toHaveBeenCalled();
});

test('the screen is kept awake in a Game, and the lock is taken again when the page is visible again', async () => {
  const release = vi.fn(async () => {});
  const request = vi.fn(async () => ({ release }));
  vi.stubGlobal('navigator', { ...navigator, wakeLock: { request } });
  saveToken('ABCD', 'secret');
  const socket = renderPlay('/play?code=ABCD');
  expect(request).not.toHaveBeenCalled();

  act(() => socket.serverSend({ type: 'joined', code: 'ABCD', playerId: 'p2', token: 'secret' }));
  await act(async () => socket.serverSend({ type: 'player-view', view: playerView({ seat: null }, []) }));
  expect(request).toHaveBeenCalledWith('screen');

  await act(async () => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
  expect(request).toHaveBeenCalledTimes(2);

  cleanup();
  await act(async () => {});
  expect(release).toHaveBeenCalled();
});

function seatedAs(view = playerView({ seat: 5 }, [])) {
  saveToken('ABCD', 'secret');
  const socket = renderPlay('/play?code=ABCD');
  act(() => socket.serverSend({ type: 'joined', code: 'ABCD', playerId: 'p2', token: 'secret' }));
  act(() => socket.serverSend({ type: 'player-view', view }));
  return socket;
}

test('a removed Player is told so, forgets the Game and can join again as a new Player', () => {
  const socket = seatedAs();

  act(() => socket.serverSend({ type: 'error', error: 'removed', message: 'The Host removed you from the Game' }));
  act(() => socket.serverDrop());

  expect(screen.getByRole('alert')).toHaveTextContent('The Host removed you from the Game.');
  expect(screen.getByLabelText('Game Code')).toHaveValue('ABCD');
  expect(loadToken('ABCD')).toBeNull();
});

test('when the Game ends the phone shows the Player their result instead of the controls', () => {
  const standings = [{ playerId: 'p2', name: 'Bob', net: -250, removed: false }];
  seatedAs(playerView({ seat: 5, isHost: true }, [seat({ seat: 5, playerId: 'p2' })], { ended: true, standings }));

  expect(screen.getByRole('heading', { name: 'The Game has ended' })).toBeInTheDocument();
  expect(screen.getByText('You finished −250 Chips. The Standings are on the Table.')).toBeInTheDocument();
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});

import { act, renderHook } from '@testing-library/react';
import type { TableView, YouView } from '@poker/protocol';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { FakeWebSocket } from './fake-websocket.ts';
import { loadToken } from './token-store.ts';
import { useConnection } from './use-connection.ts';

const tableView: TableView = {
  role: 'table',
  hostId: null,
  startingStack: 1000,
  smallBlind: 5,
  bigBlind: 10,
  turnTimerSeconds: null,
  paused: false,
  ended: false,
  seats: [],
  hand: null,
  standings: [],
};

const you: YouView = {
  playerId: 'p1',
  name: 'Ada',
  seat: 3,
  chips: 1000,
  rebuys: 0,
  sittingOut: false,
  isHost: true,
  holeCards: null,
  toCall: 0,
  legal: null,
  canFoldFor: false,
  canClaimHost: false,
};

beforeEach(() => {
  FakeWebSocket.instances = [];
  vi.stubGlobal('WebSocket', FakeWebSocket);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  localStorage.clear();
});

test('connects to /ws on the page origin and reports when it is open', () => {
  const { result } = renderHook(() => useConnection());

  expect(FakeWebSocket.latest().url).toBe(`ws://${location.host}/ws`);
  expect(result.current.status).toBe('connecting');

  act(() => FakeWebSocket.latest().serverOpen());

  expect(result.current.status).toBe('open');
});

test('exposes the latest view snapshot and the Game Code', () => {
  const { result } = renderHook(() => useConnection());
  const socket = FakeWebSocket.latest();
  act(() => socket.serverOpen());

  act(() => result.current.send({ type: 'create-game' }));
  act(() => socket.serverSend({ type: 'game-created', code: 'ABCD' }));
  act(() => socket.serverSend({ type: 'table-view', view: tableView }));

  expect(socket.sent).toEqual([{ type: 'create-game' }]);
  expect(result.current.code).toBe('ABCD');
  expect(result.current.view).toEqual(tableView);
});

test('stores the Player token for the Game Code when joined', () => {
  const { result } = renderHook(() => useConnection());
  const socket = FakeWebSocket.latest();
  act(() => socket.serverOpen());

  act(() => result.current.send({ type: 'join', code: 'ABCD', name: 'Ada', seat: 3 }));
  act(() => socket.serverSend({ type: 'joined', code: 'ABCD', playerId: 'p1', token: 'secret' }));

  expect(result.current.code).toBe('ABCD');
  expect(result.current.playerId).toBe('p1');
  expect(loadToken('ABCD')).toBe('secret');
});

test('exposes server errors until the next message is sent', () => {
  const { result } = renderHook(() => useConnection());
  const socket = FakeWebSocket.latest();
  act(() => socket.serverOpen());

  act(() => result.current.send({ type: 'join', code: 'ABCD', name: 'Ada', seat: 3 }));
  act(() => socket.serverSend({ type: 'error', error: 'name-taken', message: 'That name is taken' }));

  expect(result.current.error).toEqual({ error: 'name-taken', message: 'That name is taken' });

  act(() => result.current.send({ type: 'join', code: 'ABCD', name: 'Grace', seat: 3 }));

  expect(result.current.error).toBeNull();
});

test('reconnects after a drop and resumes the Player', () => {
  vi.useFakeTimers();
  const { result } = renderHook(() => useConnection());
  const first = FakeWebSocket.latest();
  act(() => first.serverOpen());
  act(() => result.current.send({ type: 'join', code: 'ABCD', name: 'Ada', seat: 3 }));
  act(() => first.serverSend({ type: 'joined', code: 'ABCD', playerId: 'p1', token: 'secret' }));

  act(() => first.serverDrop());

  expect(result.current.status).toBe('reconnecting');
  expect(result.current.send({ type: 'leave' })).toBe(false);
  expect(FakeWebSocket.instances).toHaveLength(1);

  act(() => vi.advanceTimersByTime(500));
  const second = FakeWebSocket.latest();
  expect(second).not.toBe(first);
  act(() => second.serverOpen());

  expect(result.current.status).toBe('open');
  expect(second.sent).toEqual([{ type: 'resume', code: 'ABCD', token: 'secret' }]);
});

test('backs off between failed attempts, up to 10 seconds, and starts over once connected', () => {
  vi.useFakeTimers();
  renderHook(() => useConnection());
  const waitBeforeNextSocket = () => {
    const before = FakeWebSocket.instances.length;
    act(() => FakeWebSocket.latest().serverDrop());
    let waited = 0;
    while (FakeWebSocket.instances.length === before) {
      act(() => vi.advanceTimersByTime(100));
      waited += 100;
    }
    return waited;
  };

  expect([1, 2, 3, 4, 5, 6, 7].map(waitBeforeNextSocket)).toEqual([500, 1000, 2000, 4000, 8000, 10_000, 10_000]);

  act(() => FakeWebSocket.latest().serverOpen());
  expect(waitBeforeNextSocket()).toBe(500);
});

test('closes the socket on unmount and stops reconnecting', () => {
  vi.useFakeTimers();
  const { unmount } = renderHook(() => useConnection());
  const socket = FakeWebSocket.latest();
  act(() => socket.serverOpen());

  unmount();
  act(() => vi.advanceTimersByTime(60_000));

  expect(socket.readyState).toBe(FakeWebSocket.CLOSED);
  expect(FakeWebSocket.instances).toHaveLength(1);
});

test('stops a pending reconnect on unmount', () => {
  vi.useFakeTimers();
  const { unmount } = renderHook(() => useConnection());
  act(() => FakeWebSocket.latest().serverDrop());

  unmount();
  act(() => vi.advanceTimersByTime(60_000));

  expect(FakeWebSocket.instances).toHaveLength(1);
});

test('reconnects a Table view by reopening its Game', () => {
  vi.useFakeTimers();
  const { result } = renderHook(() => useConnection());
  const first = FakeWebSocket.latest();
  act(() => first.serverOpen());
  act(() => result.current.send({ type: 'create-game' }));
  act(() => first.serverSend({ type: 'game-created', code: 'ABCD' }));

  act(() => first.serverDrop());
  act(() => vi.advanceTimersByTime(500));
  const second = FakeWebSocket.latest();
  act(() => second.serverOpen());

  expect(second.sent).toEqual([{ type: 'open-table', code: 'ABCD' }]);
});

test('forgets the Game and its token when the server no longer knows them after a reconnect', () => {
  vi.useFakeTimers();
  const { result } = renderHook(() => useConnection());
  const first = FakeWebSocket.latest();
  act(() => first.serverOpen());
  act(() => result.current.send({ type: 'join', code: 'ABCD', name: 'Ada', seat: 3 }));
  act(() => first.serverSend({ type: 'joined', code: 'ABCD', playerId: 'p1', token: 'secret' }));
  act(() => first.serverSend({ type: 'player-view', view: { ...tableView, role: 'player', you: you } }));

  act(() => first.serverDrop());
  act(() => vi.advanceTimersByTime(500));
  const second = FakeWebSocket.latest();
  act(() => second.serverOpen());
  act(() => second.serverSend({ type: 'error', error: 'unknown-game', message: 'No Game has that code' }));

  expect(result.current.error).toEqual({ error: 'unknown-game', message: 'No Game has that code' });
  expect(result.current).toMatchObject({ code: null, playerId: null, view: null });
  expect(loadToken('ABCD')).toBeNull();

  act(() => second.serverDrop());
  act(() => vi.advanceTimersByTime(500));
  const third = FakeWebSocket.latest();
  act(() => third.serverOpen());

  expect(third.sent).toEqual([]);
});

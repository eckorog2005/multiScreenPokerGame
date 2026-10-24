import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ClientMessage, PlayerView } from '@poker/protocol';
import { afterEach, expect, test, vi } from 'vitest';
import type { ConnectionStatus } from '../connection/use-connection.ts';
import { hand, playerView, seat } from '../test-views.ts';
import Seated from './Seated.tsx';

const holeCards = [
  { rank: 'A', suit: 's' },
  { rank: 'K', suit: 's' },
] as const;

const bob = (overrides = {}) => seat({ seat: 5, playerId: 'p2', name: 'Bob', inHand: true, ...overrides });

function renderSeated(view: PlayerView, status: ConnectionStatus = 'open') {
  const send = vi.fn<(message: ClientMessage) => boolean>(() => true);
  const result = render(<Seated view={view} status={status} send={send} />);
  return { send, rerender: (next: PlayerView) => result.rerender(<Seated view={next} status={status} send={send} />) };
}

const facingBet = playerView(
  {
    seat: 5,
    holeCards,
    toCall: 10,
    legal: { actions: ['fold', 'call', 'raise', 'all-in'], toCall: 10, minRaiseTo: 20, maxRaiseTo: 1000 },
  },
  [seat({ seat: 3, inHand: true, bet: 10 }), bob()],
  { hand: hand({ toAct: 'p2' }) },
);

test('facing a bet on their turn, a Player can fold, call the amount or raise', async () => {
  const user = userEvent.setup();
  const { send } = renderSeated(facingBet);

  expect(screen.getByRole('heading', { name: 'Your turn' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Check/ })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: /^Raise to/ })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Call 10' }));

  expect(send).toHaveBeenCalledWith({ type: 'action', action: { type: 'call' } });
});

test('with nothing to call, a Player can check or bet a preset adjusted by a big blind', async () => {
  const user = userEvent.setup();
  const view = playerView(
    {
      seat: 5,
      holeCards,
      legal: { actions: ['fold', 'check', 'bet', 'all-in'], toCall: 0, minRaiseTo: 10, maxRaiseTo: 900 },
    },
    [seat({ seat: 3, inHand: true }), bob()],
    { hand: hand({ street: 'flop', pot: 100, currentBet: 0, toAct: 'p2' }) },
  );
  const { send } = renderSeated(view);

  expect(screen.queryByRole('button', { name: /^Call/ })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '½ pot' }));
  await user.click(screen.getByRole('button', { name: 'More' }));
  await user.click(screen.getByRole('button', { name: 'Bet 60' }));

  expect(send).toHaveBeenCalledWith({ type: 'action', action: { type: 'bet', amount: 60 } });
});

test('a Player too short to raise can fold, call or go all-in', () => {
  const view = playerView(
    { seat: 5, holeCards, toCall: 10, legal: { actions: ['fold', 'call', 'all-in'], toCall: 10 } },
    [seat({ seat: 3, inHand: true, bet: 20 }), bob({ chips: 15 })],
    { hand: hand({ currentBet: 20, toAct: 'p2' }) },
  );
  renderSeated(view);

  expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(
    expect.arrayContaining(['Fold', 'Call 10', 'All-in']),
  );
  expect(screen.queryByRole('slider')).not.toBeInTheDocument();
});

test('when it is not their turn, a Player has no betting actions', () => {
  const view = playerView({ seat: 5, holeCards }, [seat({ seat: 3, inHand: true }), bob()], {
    hand: hand({ toAct: 'p1' }),
  });
  renderSeated(view);

  expect(screen.queryByRole('heading', { name: 'Your turn' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Fold' })).not.toBeInTheDocument();
});

test('Sit Out toggles the Player Sitting Out and back', async () => {
  const user = userEvent.setup();
  const { send, rerender } = renderSeated(playerView({ seat: 5 }, [bob()]));

  await user.click(screen.getByRole('button', { name: 'Sit Out' }));
  expect(send).toHaveBeenLastCalledWith({ type: 'sit-out', sittingOut: true });

  rerender(playerView({ seat: 5, sittingOut: true }, [bob({ sittingOut: true })]));
  expect(screen.getByRole('button', { name: 'Sit Out' })).toHaveAttribute('aria-pressed', 'true');
  await user.click(screen.getByRole('button', { name: 'Sit Out' }));
  expect(send).toHaveBeenLastCalledWith({ type: 'sit-out', sittingOut: false });
});

test('Leave is enabled between Hands and after folding, not while still in a Hand', async () => {
  const user = userEvent.setup();
  const { send, rerender } = renderSeated(facingBet);
  expect(screen.getByRole('button', { name: 'Leave' })).toBeDisabled();

  rerender(playerView({ seat: 5 }, [bob({ folded: true })], { hand: hand({ toAct: 'p1' }) }));
  expect(screen.getByRole('button', { name: 'Leave' })).toBeEnabled();

  rerender(playerView({ seat: 5 }, [bob({ inHand: false })]));
  await user.click(screen.getByRole('button', { name: 'Leave' }));
  expect(send).toHaveBeenLastCalledWith({ type: 'leave' });
});

test('Rebuy is offered at 0 Chips between Hands only', async () => {
  const user = userEvent.setup();
  const broke = playerView({ seat: 5, chips: 0 }, [bob({ chips: 0, inHand: false })]);
  const { send, rerender } = renderSeated(broke);

  await user.click(screen.getByRole('button', { name: 'Rebuy' }));
  expect(send).toHaveBeenLastCalledWith({ type: 'rebuy' });

  rerender({ ...broke, hand: hand({ toAct: 'p1' }) });
  expect(screen.queryByRole('button', { name: 'Rebuy' })).not.toBeInTheDocument();
  rerender(playerView({ seat: 5, chips: 10 }, [bob()]));
  expect(screen.queryByRole('button', { name: 'Rebuy' })).not.toBeInTheDocument();
});

const wonUncontested = (shownBy: string[]) =>
  playerView({ seat: 5, holeCards }, [bob(), seat({ seat: 3, inHand: true, folded: true })], {
    hand: hand({
      street: 'complete',
      result: {
        showdown: false,
        pots: [{ amount: 15, eligible: ['p2'], winners: [{ playerId: 'p2', amount: 15 }] }],
        hands: [],
        shownBy,
      },
    }),
  });

test('the winner of an uncontested Hand can show their cards once', async () => {
  const user = userEvent.setup();
  const { send, rerender } = renderSeated(wonUncontested([]));

  await user.click(screen.getByRole('button', { name: 'Show cards' }));
  expect(send).toHaveBeenLastCalledWith({ type: 'action', action: { type: 'show' } });

  rerender(wonUncontested(['p2']));
  expect(screen.queryByRole('button', { name: 'Show cards' })).not.toBeInTheDocument();
});

test('Show cards is not offered after a Showdown or to a Player who lost', () => {
  const { rerender } = renderSeated({
    ...wonUncontested([]),
    hand: hand({
      street: 'complete',
      result: {
        showdown: true,
        pots: [{ amount: 40, eligible: ['p1', 'p2'], winners: [{ playerId: 'p2', amount: 40 }] }],
        hands: [],
        shownBy: [],
      },
    }),
  });
  expect(screen.queryByRole('button', { name: 'Show cards' })).not.toBeInTheDocument();

  const lost = wonUncontested([]);
  rerender({ ...lost, you: { ...lost.you, playerId: 'p1' } });
  expect(screen.queryByRole('button', { name: 'Show cards' })).not.toBeInTheDocument();
});

test('a dropped connection shows a reconnecting banner', () => {
  renderSeated(playerView({ seat: 5 }, [bob()]), 'reconnecting');

  expect(screen.getByRole('status')).toHaveTextContent('Reconnecting');
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test("the phone vibrates once when the Player's turn begins", () => {
  const vibrate = vi.fn(() => true);
  vi.stubGlobal('navigator', { ...navigator, vibrate });
  const waiting = playerView({ seat: 5, holeCards }, [bob()], { hand: hand({ toAct: 'p1' }) });
  const { rerender } = renderSeated(waiting);
  expect(vibrate).not.toHaveBeenCalled();

  rerender(facingBet);
  rerender({ ...facingBet, hand: hand({ toAct: 'p2', turnTimeLeftMs: 5000 }) });

  expect(vibrate).toHaveBeenCalledTimes(1);
});

test('the screen is kept awake, and the lock is taken again when the page is visible again', async () => {
  const release = vi.fn(async () => {});
  const request = vi.fn(async () => ({ release }));
  vi.stubGlobal('navigator', { ...navigator, wakeLock: { request } });

  const { unmount } = render(<Seated view={playerView({ seat: 5 }, [bob()])} status="open" send={() => true} />);
  await act(async () => {});
  expect(request).toHaveBeenCalledWith('screen');

  await act(async () => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
  expect(request).toHaveBeenCalledTimes(2);

  unmount();
  await act(async () => {});
  expect(release).toHaveBeenCalled();
});

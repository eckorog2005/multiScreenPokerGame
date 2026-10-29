import { render, screen } from '@testing-library/react';
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

afterEach(() => {
  vi.unstubAllGlobals();
});

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

test('the amount to call shows while waiting for their turn', () => {
  renderSeated(
    playerView({ seat: 5, holeCards, toCall: 40 }, [seat({ seat: 3, inHand: true, bet: 50 }), bob({ bet: 10 })], {
      hand: hand({ currentBet: 50, toAct: 'p1' }),
    }),
  );

  expect(screen.getByText('To call: 40')).toBeInTheDocument();
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

const ann = seat({ seat: 3, playerId: 'p1', name: 'Ann' });
const hostView = (rest: Partial<PlayerView> = {}, you = {}) =>
  playerView({ seat: 5, isHost: true, ...you }, [ann, bob({ inHand: false, isHost: true })], rest);
const hostCommands = (send: ReturnType<typeof renderSeated>['send']) =>
  send.mock.calls.flatMap(([message]) => (message.type === 'host' ? [message.command] : []));

test('before the first Hand the Host sets the stack, blinds and turn timer, then deals', async () => {
  const user = userEvent.setup();
  const { send } = renderSeated(hostView());

  await user.clear(screen.getByLabelText('Starting stack'));
  await user.type(screen.getByLabelText('Starting stack'), '500');
  await user.clear(screen.getByLabelText('Small blind'));
  await user.type(screen.getByLabelText('Small blind'), '10');
  await user.clear(screen.getByLabelText('Big blind'));
  await user.type(screen.getByLabelText('Big blind'), '20');
  await user.type(screen.getByLabelText('Turn timer (seconds, blank for off)'), '30');
  await user.click(screen.getByRole('button', { name: 'Deal' }));

  expect(hostCommands(send)).toEqual([
    { type: 'set-starting-stack', amount: 500 },
    { type: 'set-blinds', smallBlind: 10, bigBlind: 20 },
    { type: 'set-turn-timer', seconds: 30 },
    { type: 'deal-hand' },
  ]);
});

test('the first-Hand settings start from the current ones and refuse a big blind below the small blind', async () => {
  const user = userEvent.setup();
  const { send } = renderSeated(hostView({ turnTimerSeconds: 45 }));

  expect(screen.getByLabelText('Starting stack')).toHaveValue(1000);
  expect(screen.getByLabelText('Turn timer (seconds, blank for off)')).toHaveValue(45);
  await user.clear(screen.getByLabelText('Big blind'));
  await user.type(screen.getByLabelText('Big blind'), '2');
  await user.click(screen.getByRole('button', { name: 'Deal' }));

  expect(screen.getByRole('alert')).toHaveTextContent('The big blind must be at least the small blind.');
  expect(send).not.toHaveBeenCalled();
});

test('only the Host sees Host controls', () => {
  renderSeated(playerView({ seat: 5 }, [ann, bob({ inHand: false })]));

  expect(screen.queryByRole('region', { name: 'Host' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Deal' })).not.toBeInTheDocument();
});

const handOver = hand({ street: 'complete', currentBet: 0 });

test('between Hands the Host can pause and resume dealing', async () => {
  const user = userEvent.setup();
  const { send, rerender } = renderSeated(hostView({ hand: handOver }));

  expect(screen.queryByRole('button', { name: 'Deal' })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Pause dealing' }));
  rerender(hostView({ hand: handOver, paused: true }));
  await user.click(screen.getByRole('button', { name: 'Resume dealing' }));

  expect(hostCommands(send)).toEqual([
    { type: 'set-paused', paused: true },
    { type: 'set-paused', paused: false },
  ]);
});

test('between Hands the Host can change the blinds for the next Hand', async () => {
  const user = userEvent.setup();
  const { send } = renderSeated(hostView({ hand: handOver }));

  await user.clear(screen.getByLabelText('Small blind'));
  await user.type(screen.getByLabelText('Small blind'), '25');
  await user.clear(screen.getByLabelText('Big blind'));
  await user.type(screen.getByLabelText('Big blind'), '50');
  await user.click(screen.getByRole('button', { name: 'Set blinds' }));

  expect(hostCommands(send)).toEqual([{ type: 'set-blinds', smallBlind: 25, bigBlind: 50 }]);
});

test('during a Hand the Host cannot pause or change the blinds', () => {
  renderSeated(hostView({ hand: hand({ toAct: 'p1' }) }));

  expect(screen.queryByRole('button', { name: 'Pause dealing' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Set blinds' })).not.toBeInTheDocument();
});

test("on a disconnected Player's turn the Host can fold for them", async () => {
  const user = userEvent.setup();
  const view = playerView(
    { seat: 5, isHost: true, canFoldFor: true },
    [seat({ seat: 3, playerId: 'p1', name: 'Ann', inHand: true, connected: false }), bob({ isHost: true })],
    { hand: hand({ toAct: 'p1' }) },
  );
  const { send } = renderSeated(view);

  await user.click(screen.getByRole('button', { name: 'Fold for Ann' }));

  expect(hostCommands(send)).toEqual([{ type: 'fold-for' }]);
});

test('the Host removes a Player only after confirming', async () => {
  const user = userEvent.setup();
  const { send } = renderSeated(hostView({ hand: hand({ toAct: 'p1' }) }));

  await user.click(screen.getByRole('button', { name: 'Remove Ann' }));
  await user.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(send).not.toHaveBeenCalled();

  await user.click(screen.getByRole('button', { name: 'Remove Ann' }));
  expect(screen.getByText('Remove Ann from the Game? Their Chips leave with them.')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Yes, remove Ann' }));

  expect(hostCommands(send)).toEqual([{ type: 'remove-player', playerId: 'p1' }]);
});

test('the Host hands the role to another Player', async () => {
  const user = userEvent.setup();
  const { send } = renderSeated(hostView());

  expect(screen.queryByRole('button', { name: 'Make Bob Host' })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Make Ann Host' }));

  expect(hostCommands(send)).toEqual([{ type: 'transfer-host', playerId: 'p1' }]);
});

test('the Host ends the Game only after confirming', async () => {
  const user = userEvent.setup();
  const { send } = renderSeated(hostView({ hand: handOver }));

  await user.click(screen.getByRole('button', { name: 'End Game' }));
  expect(send).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Yes, end the Game' }));

  expect(hostCommands(send)).toEqual([{ type: 'end-game' }]);
});

test('any Player can claim Host once the Host has been gone for a minute', async () => {
  const user = userEvent.setup();
  const view = playerView({ seat: 5 }, [ann, bob({ inHand: false })]);
  const { send, rerender } = renderSeated(view);
  expect(screen.queryByRole('button', { name: 'Claim Host' })).not.toBeInTheDocument();

  rerender({ ...view, you: { ...view.you, canClaimHost: true } });
  await user.click(screen.getByRole('button', { name: 'Claim Host' }));

  expect(send).toHaveBeenCalledWith({ type: 'claim-host' });
});

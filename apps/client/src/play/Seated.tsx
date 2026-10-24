import { useEffect, useState } from 'react';
import type { ClientMessage, HandView, LegalActionsView, PlayerAction, PlayerView } from '@poker/protocol';
import { cardText, isRed } from '../cards.ts';
import type { ConnectionStatus } from '../connection/use-connection.ts';
import { betPresets, clampBet, stepBet } from './bet.ts';
import HoleCards from './HoleCards.tsx';
import { useWakeLock } from './use-wake-lock.ts';

type Send = (message: ClientMessage) => boolean;

type Props = { view: PlayerView; status: ConnectionStatus; send: Send; notice?: string | null };

function Seated({ view, status, send, notice = null }: Props) {
  const { you, hand } = view;
  const act = (action: PlayerAction) => send({ type: 'action', action });
  const handActive = hand !== null && hand.street !== 'complete';
  const myTurn = you.legal !== null;
  useWakeLock();
  useEffect(() => {
    if (myTurn && 'vibrate' in navigator) navigator.vibrate(200);
  }, [myTurn]);
  return (
    <main className={myTurn ? 'seated my-turn' : 'seated'}>
      {status !== 'open' && (
        <p role="status" className="banner">
          Reconnecting…
        </p>
      )}
      <header>
        <h1>{you.name}</h1>
        <p>
          Seat {you.seat} · {you.chips} Chips{you.isHost && ' · Host'}
        </p>
      </header>
      {hand && <BoardSummary hand={hand} />}
      {you.holeCards && <HoleCards cards={you.holeCards} />}
      {notice && <p role="alert">{notice}</p>}
      {you.legal && hand ? (
        <section className="your-turn" aria-labelledby="your-turn">
          <h2 id="your-turn">Your turn</h2>
          <Actions legal={you.legal} hand={hand} bigBlind={view.bigBlind} act={act} />
        </section>
      ) : (
        <p>{handActive ? 'Waiting for your turn…' : 'Waiting for the next Hand…'}</p>
      )}
      <PlayerControls view={view} handActive={handActive} send={send} />
    </main>
  );
}

function PlayerControls({ view, handActive, send }: { view: PlayerView; handActive: boolean; send: Send }) {
  const { you, hand } = view;
  const mySeat = view.seats.find((s) => s.playerId === you.playerId);
  const stillInHand = handActive && mySeat?.inHand === true && !mySeat.folded;
  const result = hand?.result;
  const canShow =
    result !== null &&
    result !== undefined &&
    !result.showdown &&
    !result.shownBy.includes(you.playerId) &&
    result.pots.some((pot) => pot.winners.some((w) => w.playerId === you.playerId));
  return (
    <div className="player-controls">
      {canShow && (
        <button type="button" onClick={() => send({ type: 'action', action: { type: 'show' } })}>
          Show cards
        </button>
      )}
      {you.chips === 0 && !handActive && (
        <button type="button" onClick={() => send({ type: 'rebuy' })}>
          Rebuy
        </button>
      )}
      <button
        type="button"
        aria-pressed={you.sittingOut}
        onClick={() => send({ type: 'sit-out', sittingOut: !you.sittingOut })}
      >
        Sit Out
      </button>
      <button type="button" disabled={stillInHand} onClick={() => send({ type: 'leave' })}>
        Leave
      </button>
    </div>
  );
}

function BoardSummary({ hand }: { hand: HandView }) {
  return (
    <section className="board-summary" aria-label="Board">
      <p>Pot {hand.pot}</p>
      <p>
        {hand.board.map((card, i) => (
          <span key={i} className={isRed(card) ? 'card small red' : 'card small'}>
            {cardText(card)}
          </span>
        ))}
      </p>
    </section>
  );
}

function Actions({
  legal,
  hand,
  bigBlind,
  act,
}: {
  legal: LegalActionsView;
  hand: HandView;
  bigBlind: number;
  act: (action: PlayerAction) => void;
}) {
  const can = (type: LegalActionsView['actions'][number]) => legal.actions.includes(type);
  const betType = can('bet') ? 'bet' : can('raise') ? 'raise' : null;
  return (
    <div className="actions">
      <button type="button" onClick={() => act({ type: 'fold' })}>
        Fold
      </button>
      {can('check') ? (
        <button type="button" onClick={() => act({ type: 'check' })}>
          Check
        </button>
      ) : (
        <button type="button" onClick={() => act({ type: 'call' })}>
          Call {legal.toCall}
        </button>
      )}
      {betType ? (
        <BetControls
          key={`${hand.street}-${hand.currentBet}`}
          type={betType}
          legal={legal}
          hand={hand}
          bigBlind={bigBlind}
          act={act}
        />
      ) : (
        can('all-in') && (
          <button type="button" onClick={() => act({ type: 'all-in' })}>
            All-in
          </button>
        )
      )}
    </div>
  );
}

function BetControls({
  type,
  legal,
  hand,
  bigBlind,
  act,
}: {
  type: 'bet' | 'raise';
  legal: LegalActionsView;
  hand: HandView;
  bigBlind: number;
  act: (action: PlayerAction) => void;
}) {
  const [amount, setAmount] = useState(() => clampBet(legal.minRaiseTo ?? 0, legal));
  return (
    <div className="bet-controls">
      <div className="presets">
        {betPresets(legal, hand).map((preset) => (
          <button key={preset.label} type="button" onClick={() => setAmount(preset.amount)}>
            {preset.label}
          </button>
        ))}
      </div>
      <div className="slider">
        <button type="button" aria-label="Less" onClick={() => setAmount(stepBet(amount, -1, legal, bigBlind))}>
          −
        </button>
        <input
          type="range"
          aria-label="Amount"
          min={legal.minRaiseTo}
          max={legal.maxRaiseTo}
          value={amount}
          onChange={(event) => setAmount(clampBet(Number(event.target.value), legal))}
        />
        <button type="button" aria-label="More" onClick={() => setAmount(stepBet(amount, 1, legal, bigBlind))}>
          +
        </button>
      </div>
      <button type="button" className="primary" onClick={() => act({ type, amount })}>
        {type === 'bet' ? `Bet ${amount}` : `Raise to ${amount}`}
      </button>
    </div>
  );
}

export default Seated;

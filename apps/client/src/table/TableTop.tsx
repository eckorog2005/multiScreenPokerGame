import type { CSSProperties } from 'react';
import { MAX_SEATS } from '@poker/engine';
import type { HandView, PotView, SeatView, TableView } from '@poker/protocol';
import CardFace from '../CardFace.tsx';
import { signed } from '../signed.ts';
import { useSecondsLeft } from './use-seconds-left.ts';

function TableTop({ view }: { view: TableView }) {
  if (view.ended) return <Standings view={view} />;
  return (
    <div className="table-top">
      <Seats view={view} />
      <div className="felt">
        {view.hand && <Board view={view} hand={view.hand} />}
        <BetweenHands view={view} />
      </div>
    </div>
  );
}

function Standings({ view }: { view: TableView }) {
  const rows = [...view.standings].sort((a, b) => b.net - a.net);
  return (
    <table className="standings">
      <caption>Standings</caption>
      <thead>
        <tr>
          <th scope="col">Player</th>
          <th scope="col">Net</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.playerId}>
            <td>
              {row.name}
              {row.removed && ' (removed)'}
            </td>
            <td>{signed(row.net)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Seats({ view }: { view: TableView }) {
  const seatNumbers = Array.from({ length: MAX_SEATS }, (_, i) => i + 1);
  return (
    <ol className="seats">
      {seatNumbers.map((number) => {
        const seat = view.seats.find((s) => s.seat === number);
        const toAct = seat !== undefined && view.hand?.toAct === seat.playerId;
        return (
          <li
            key={number}
            aria-label={`Seat ${number}`}
            aria-current={toAct || undefined}
            className={toAct ? 'to-act' : undefined}
            style={{ '--seat': number } as CSSProperties}
          >
            {seat ? <Seat seat={seat} hand={view.hand} /> : <span className="empty">Empty</span>}
            {toAct && view.hand!.turnTimeLeftMs !== null && (
              <TurnTimer key={`${seat.playerId}-${view.hand!.turnTimeLeftMs}`} ms={view.hand!.turnTimeLeftMs} />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function Board({ view, hand }: { view: TableView; hand: HandView }) {
  const pots = potsToShow(hand);
  return (
    <>
      <section className="board" aria-label="Board">
        {hand.board.map((card, i) => (
          <CardFace key={i} card={card} />
        ))}
      </section>
      <ul className="pots" aria-label="Pots">
        {pots.map((pot, i) => (
          <li key={i}>
            {potLabel(i, pots.length)} <strong>{pot.amount}</strong>
            {pot.winners.map((winner) => (
              <p key={winner.playerId} className="winner">
                {nameOf(view, winner.playerId)} wins {winner.amount}
                {winner.description && ` with ${winner.description}`}
              </p>
            ))}
          </li>
        ))}
      </ul>
    </>
  );
}

function BetweenHands({ view }: { view: TableView }) {
  if (view.hand && view.hand.street !== 'complete') return null;
  // Mirrors the server loop, which deals only to connected Players with Chips who aren't Sitting Out.
  const ready = view.seats.filter((s) => s.connected && s.chips > 0 && !s.sittingOut).length;
  const message = view.paused
    ? 'Paused by Host'
    : ready < 2
      ? 'Waiting for players'
      : view.hand === null
        ? 'Waiting for the Host to deal'
        : null;
  return (
    message && (
      <p role="status" className="table-status">
        {message}
      </p>
    )
  );
}

/** The result's pots once the Hand is over; until then, one total unless all-ins split it into side pots. */
function potsToShow(hand: HandView): readonly Pick<PotView, 'amount' | 'winners'>[] {
  if (hand.result) return hand.result.pots;
  if (hand.pots.length > 1) return hand.pots.map((pot) => ({ amount: pot.amount, winners: [] }));
  return [{ amount: hand.pot, winners: [] }];
}

function potLabel(index: number, count: number): string {
  if (count === 1) return 'Pot';
  if (index === 0) return 'Main pot';
  return index === 1 ? 'Side pot' : `Side pot ${index}`;
}

function nameOf(view: TableView, playerId: string): string {
  const player = view.seats.find((s) => s.playerId === playerId) ?? view.standings.find((s) => s.playerId === playerId);
  return player?.name ?? 'A Player';
}

function Seat({ seat, hand }: { seat: SeatView; hand: HandView | null }) {
  const description = hand?.result?.hands.find((h) => h.playerId === seat.playerId)?.description;
  return (
    <>
      <p className="seat-name">
        {seat.name}
        {seat.isHost && <span className="badge">Host</span>}
        {seat.bot && <span className="badge">Bot</span>}
        {seat.isButton && <Marker label="Button" text="D" />}
        {seat.blind === 'small' && <Marker label="Small blind" text="SB" />}
        {seat.blind === 'big' && <Marker label="Big blind" text="BB" />}
      </p>
      <p>{seat.chips} Chips</p>
      {seat.bet > 0 && <p className="seat-bet">Bet {seat.bet}</p>}
      {statuses(seat).map((status) => (
        <p key={status} className="seat-status">
          {status}
        </p>
      ))}
      {seat.revealedCards && (
        <p className="revealed">
          {seat.revealedCards.map((card, i) => (
            <CardFace key={i} card={card} small />
          ))}
        </p>
      )}
      {description && <p className="hand-description">{description}</p>}
    </>
  );
}

function Marker({ label, text }: { label: string; text: string }) {
  return (
    <span className="marker" aria-label={label} title={label}>
      {text}
    </span>
  );
}

function TurnTimer({ ms }: { ms: number }) {
  return (
    <p role="timer" className="turn-timer">
      {useSecondsLeft(ms)}s
    </p>
  );
}

function statuses(seat: SeatView): string[] {
  return [
    seat.sittingOut && 'Sitting Out',
    !seat.connected && 'Disconnected',
    seat.folded && 'Folded',
    seat.allIn && 'All-in',
  ].filter((status) => status !== false);
}

export default TableTop;

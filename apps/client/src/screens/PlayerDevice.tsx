import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router';
import { MAX_SEATS } from '@poker/engine';
import type { ErrorCode, GameSeatsResponse, PlayerView } from '@poker/protocol';
import { loadToken } from '../connection/token-store.ts';
import {
  useConnection,
  type Connection,
  type ConnectionStatus,
  type ServerError,
} from '../connection/use-connection.ts';
import Seated from '../play/Seated.tsx';
import { useWakeLock } from '../play/use-wake-lock.ts';

type Seats = GameSeatsResponse['seats'];

// A fresh `seats` step object (re)loads the Seats, e.g. after a seat-taken error.
type Step = { readonly kind: 'details' } | { readonly kind: 'seats' };

const detailsErrors = new Set<ErrorCode>(['unknown-game', 'invalid-name', 'name-taken']);

function PlayerDevice() {
  const [params, setParams] = useSearchParams();
  const linkCode = params.get('code')?.toUpperCase() ?? '';
  const { status, code: joinedCode, view, error, send } = useConnection();
  const [rejoining, setRejoining] = useState(() => linkCode !== '' && loadToken(linkCode) !== null);
  const resumeSent = useRef(false);
  const [code, setCode] = useState(linkCode);
  const [name, setName] = useState('');
  const [step, setStep] = useState<Step>({ kind: 'details' });
  const [seats, setSeats] = useState<Seats | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [seenError, setSeenError] = useState(error);

  if (error !== seenError) {
    setSeenError(error);
    if (error) {
      setRejoining(false);
      setNotice(errorText(error, code));
      if (detailsErrors.has(error.error)) setStep({ kind: 'details' });
      else if (error.error === 'seat-taken' && step.kind === 'seats') setStep({ kind: 'seats' });
    }
  }

  useEffect(() => {
    if (status !== 'open' || resumeSent.current) return;
    resumeSent.current = true;
    const token = linkCode ? loadToken(linkCode) : null;
    if (token) send({ type: 'resume', code: linkCode, token });
  }, [status, linkCode, send]);

  useEffect(() => {
    if (joinedCode && joinedCode !== linkCode) setParams({ code: joinedCode }, { replace: true });
  }, [joinedCode, linkCode, setParams]);

  useEffect(() => {
    if (step.kind !== 'seats') return;
    let cancelled = false;
    void fetchSeats(code).then((result) => {
      if (cancelled) return;
      if (typeof result === 'string') {
        setNotice(result);
        setStep({ kind: 'details' });
      } else {
        setSeats(result);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [step, code]);

  if (view?.role === 'player') return <Joined view={view} status={status} notice={error ? notice : null} send={send} />;
  if (rejoining) {
    return (
      <main>
        <p>Rejoining your Game…</p>
      </main>
    );
  }

  if (step.kind === 'seats') {
    return (
      <main>
        <h1>Pick a Seat</h1>
        {notice && <p role="alert">{notice}</p>}
        {seats ? (
          <SeatPicker
            seats={seats}
            onPick={(seat) => {
              setNotice(null);
              send({ type: 'join', code, name: name.trim(), seat });
            }}
          />
        ) : (
          <p>Finding the Game…</p>
        )}
        <button type="button" onClick={() => setStep({ kind: 'details' })}>
          Back
        </button>
      </main>
    );
  }

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setNotice(null);
    const token = loadToken(code);
    if (token && send({ type: 'resume', code, token })) return setRejoining(true);
    if (!name.trim()) return setNotice('Enter a display name.');
    setSeats(null);
    setStep({ kind: 'seats' });
  };

  return (
    <main>
      <h1>Join a Game</h1>
      <form onSubmit={submit}>
        <label>
          Game Code
          <input
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            maxLength={4}
            autoCapitalize="characters"
            autoComplete="off"
            required
          />
        </label>
        <label>
          Your name
          <input value={name} onChange={(event) => setName(event.target.value)} maxLength={20} required />
        </label>
        {notice && <p role="alert">{notice}</p>}
        <button type="submit">Continue</button>
      </form>
    </main>
  );
}

function Joined({
  view,
  status,
  notice,
  send,
}: {
  view: PlayerView;
  status: ConnectionStatus;
  notice: string | null;
  send: Connection['send'];
}) {
  const { you } = view;
  useWakeLock();
  if (you.seat !== null) return <Seated view={view} status={status} notice={notice} send={send} />;
  return (
    <main>
      <h1>Pick a Seat</h1>
      <p>
        Welcome back, {you.name}. You have {you.chips} Chips.
      </p>
      {notice && <p role="alert">{notice}</p>}
      <SeatPicker seats={view.seats} onPick={(seat) => send({ type: 'take-seat', seat })} />
    </main>
  );
}

function SeatPicker({ seats, onPick }: { seats: Seats; onPick: (seat: number) => void }) {
  const seatNumbers = Array.from({ length: MAX_SEATS }, (_, i) => i + 1);
  return (
    <ul className="seat-picker">
      {seatNumbers.map((number) => {
        const taken = seats.find((s) => s.seat === number);
        return (
          <li key={number}>
            <button type="button" disabled={taken !== undefined} onClick={() => onPick(number)}>
              Seat {number}
              {taken ? ` · ${taken.name}` : ' · Empty'}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

async function fetchSeats(code: string): Promise<Seats | string> {
  try {
    const response = await fetch(`/api/games/${encodeURIComponent(code)}`);
    if (response.status === 404) return `No Game has the code ${code}.`;
    if (!response.ok) return 'Could not reach the Game. Try again.';
    return ((await response.json()) as GameSeatsResponse).seats;
  } catch {
    return 'Could not reach the Game. Try again.';
  }
}

function errorText({ error, message }: ServerError, code: string): string {
  switch (error) {
    case 'unknown-game':
      return `No Game has the code ${code}.`;
    case 'unknown-player':
      return 'Your Seat in that Game was not found. Join again.';
    case 'name-taken':
      return 'That name is already taken in this Game.';
    case 'invalid-name':
      return 'Enter a display name.';
    case 'seat-taken':
      return 'That Seat was just taken. Pick another.';
    default:
      return message;
  }
}

export default PlayerDevice;

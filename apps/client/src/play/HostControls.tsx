import { useState, type FormEvent } from 'react';
import type { HostCommand, PlayerView } from '@poker/protocol';
import type { Connection } from '../connection/use-connection.ts';

type Send = Connection['send'];
type SendHostCommand = (command: HostCommand) => void;

const blindsProblem = 'The big blind must be at least the small blind.';

function HostControls({ view, send }: { view: PlayerView; send: Send }) {
  const host: SendHostCommand = (command) => send({ type: 'host', command });
  const { hand, you } = view;
  const toAct = hand?.toAct ? view.seats.find((s) => s.playerId === hand.toAct) : undefined;
  return (
    <section className="host-controls" aria-labelledby="host-controls">
      <h2 id="host-controls">Host</h2>
      {you.canFoldFor && toAct && (
        <button type="button" onClick={() => host({ type: 'fold-for' })}>
          Fold for {toAct.name}
        </button>
      )}
      {hand === null && <FirstHandSettings view={view} host={host} />}
      {hand?.street === 'complete' && (
        <>
          <button
            type="button"
            aria-pressed={view.paused}
            onClick={() => host({ type: 'set-paused', paused: !view.paused })}
          >
            {view.paused ? 'Resume dealing' : 'Pause dealing'}
          </button>
          <BlindsForm view={view} host={host} />
        </>
      )}
      <ul className="host-players" aria-label="Players">
        {view.seats
          .filter((s) => s.playerId !== you.playerId)
          .map((s) => (
            <li key={s.playerId}>
              {s.name}
              <button type="button" onClick={() => host({ type: 'transfer-host', playerId: s.playerId })}>
                Make {s.name} Host
              </button>
              <Confirmed
                label={`Remove ${s.name}`}
                question={`Remove ${s.name} from the Game? Their Chips leave with them.`}
                confirm={`Yes, remove ${s.name}`}
                onConfirm={() => host({ type: 'remove-player', playerId: s.playerId })}
              />
            </li>
          ))}
      </ul>
      <Confirmed
        label="End Game"
        question="End the Game for everyone and show the Standings?"
        confirm="Yes, end the Game"
        onConfirm={() => host({ type: 'end-game' })}
      />
    </section>
  );
}

type ConfirmedProps = { label: string; question: string; confirm: string; onConfirm: () => void };

function Confirmed({ label, question, confirm, onConfirm }: ConfirmedProps) {
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return (
      <button type="button" onClick={() => setAsking(true)}>
        {label}
      </button>
    );
  }
  return (
    <span className="confirm">
      {question}
      <button type="button" className="danger" onClick={onConfirm}>
        {confirm}
      </button>
      <button type="button" onClick={() => setAsking(false)}>
        Cancel
      </button>
    </span>
  );
}

function BlindsForm({ view, host }: { view: PlayerView; host: SendHostCommand }) {
  const blinds = useBlinds(view);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const command = blinds.check();
    if (command) host(command);
  };

  return (
    <form onSubmit={submit}>
      {blinds.fields}
      <button type="submit">Set blinds</button>
    </form>
  );
}

function FirstHandSettings({ view, host }: { view: PlayerView; host: SendHostCommand }) {
  const [startingStack, setStartingStack] = useState(String(view.startingStack));
  const [turnTimer, setTurnTimer] = useState(view.turnTimerSeconds === null ? '' : String(view.turnTimerSeconds));
  const blinds = useBlinds(view);

  const deal = (event: FormEvent) => {
    event.preventDefault();
    const setBlinds = blinds.check();
    if (!setBlinds) return;
    host({ type: 'set-starting-stack', amount: Number(startingStack) });
    host(setBlinds);
    host({ type: 'set-turn-timer', seconds: turnTimer === '' ? null : Number(turnTimer) });
    host({ type: 'deal-hand' });
  };

  return (
    <form onSubmit={deal}>
      <ChipsInput label="Starting stack" value={startingStack} onChange={setStartingStack} />
      {blinds.fields}
      <label>
        Turn timer (seconds, blank for off)
        <input
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
          value={turnTimer}
          onChange={(event) => setTurnTimer(event.target.value)}
        />
      </label>
      <button type="submit" className="primary">
        Deal
      </button>
    </form>
  );
}

/** The blinds inputs, and `check()` that returns the set-blinds command or shows why it can't be sent. */
function useBlinds(view: PlayerView) {
  const [smallBlind, setSmallBlind] = useState(String(view.smallBlind));
  const [bigBlind, setBigBlind] = useState(String(view.bigBlind));
  const [problem, setProblem] = useState<string | null>(null);

  const check = (): Extract<HostCommand, { type: 'set-blinds' }> | null => {
    if (Number(bigBlind) < Number(smallBlind)) {
      setProblem(blindsProblem);
      return null;
    }
    setProblem(null);
    return { type: 'set-blinds', smallBlind: Number(smallBlind), bigBlind: Number(bigBlind) };
  };

  const fields = (
    <>
      <ChipsInput label="Small blind" value={smallBlind} onChange={setSmallBlind} />
      <ChipsInput label="Big blind" value={bigBlind} onChange={setBigBlind} />
      {problem && <p role="alert">{problem}</p>}
    </>
  );
  return { fields, check };
}

function ChipsInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label>
      {label}
      <input
        type="number"
        inputMode="numeric"
        min={1}
        step={1}
        required
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

export default HostControls;

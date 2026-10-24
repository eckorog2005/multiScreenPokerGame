import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router';
import { QRCodeSVG } from 'qrcode.react';
import { MAX_SEATS } from '@poker/engine';
import type { TableView } from '@poker/protocol';
import { useConnection } from '../connection/use-connection.ts';
import { joinUrl } from '../join-url.ts';

function Table() {
  const [params, setParams] = useSearchParams();
  const requestedCode = params.get('code');
  const { status, code: createdCode, view, error, send } = useConnection();
  const attached = useRef(false);

  useEffect(() => {
    if (status !== 'open' || attached.current) return;
    attached.current = true;
    send(requestedCode ? { type: 'open-table', code: requestedCode } : { type: 'create-game' });
  }, [status, requestedCode, send]);

  useEffect(() => {
    if (createdCode && createdCode !== requestedCode) setParams({ code: createdCode }, { replace: true });
  }, [createdCode, requestedCode, setParams]);

  if (error?.error === 'unknown-game') {
    return (
      <main>
        <h1>Table</h1>
        <p>No Game has the code {requestedCode}.</p>
        <a href="/table">Host a new Table</a>
      </main>
    );
  }

  const code = createdCode ?? (view ? requestedCode : null);
  if (!code) {
    return (
      <main>
        <h1>Table</h1>
        <p>Setting up the Table…</p>
      </main>
    );
  }

  const url = joinUrl(code);
  return (
    <main>
      <h1 className="game-code">{code}</h1>
      <QRCodeSVG value={url} size={256} marginSize={2} title={`QR code to join Game ${code}`} role="img" />
      <p>{url}</p>
      {view?.role === 'table' && <Seats view={view} />}
    </main>
  );
}

function Seats({ view }: { view: TableView }) {
  const seatNumbers = Array.from({ length: MAX_SEATS }, (_, i) => i + 1);
  return (
    <ol className="seats">
      {seatNumbers.map((number) => {
        const seat = view.seats.find((s) => s.seat === number);
        return (
          <li key={number} aria-label={`Seat ${number}`}>
            {seat ? (
              <>
                {seat.name}
                {seat.isHost && <span className="badge">Host</span>}
              </>
            ) : (
              <span className="empty">Empty</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export default Table;

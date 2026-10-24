import { useCallback, useEffect, useRef, useState } from 'react';
import type { ClientMessage, PlayerView, ServerMessage, TableView } from '@poker/protocol';
import { clearToken, saveToken } from './token-store.ts';

export type ConnectionStatus = 'connecting' | 'open' | 'reconnecting';

export type ServerError = Omit<Extract<ServerMessage, { type: 'error' }>, 'type'>;

type View = TableView | PlayerView;

export type Connection = {
  readonly status: ConnectionStatus;
  readonly code: string | null;
  readonly playerId: string | null;
  readonly view: View | null;
  /** The last error from the server, cleared by the next `send`. */
  readonly error: ServerError | null;
  /** Returns false, dropping the message, when the socket isn't open. */
  readonly send: (message: ClientMessage) => boolean;
};

type AttachIntent = Extract<ClientMessage, { type: 'open-table' | 'resume' }>;

const isAttachIntent = (message: ClientMessage): message is AttachIntent =>
  message.type === 'open-table' || message.type === 'resume';

const firstRetryMs = 500;
const maxRetryMs = 10_000;

export function useConnection(): Connection {
  const socketRef = useRef<WebSocket | null>(null);
  const attachRef = useRef<AttachIntent | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [code, setCode] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [view, setView] = useState<View | null>(null);
  const [error, setError] = useState<ServerError | null>(null);

  useEffect(() => {
    let retries = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;

    // The server keeps Games in memory, so after a restart the remembered Game is gone for good.
    const forgetGame = () => {
      const attach = attachRef.current;
      if (attach?.type === 'resume') clearToken(attach.code);
      attachRef.current = null;
      setCode(null);
      setPlayerId(null);
      setView(null);
    };

    const connect = () => {
      const socket = new WebSocket(socketUrl());
      socketRef.current = socket;
      socket.onopen = () => {
        retries = 0;
        if (attachRef.current) socket.send(JSON.stringify(attachRef.current));
        setStatus('open');
      };
      socket.onmessage = (event: MessageEvent) => {
        const message = JSON.parse(String(event.data)) as ServerMessage;
        if (message.type === 'game-created') {
          attachRef.current = { type: 'open-table', code: message.code };
          setCode(message.code);
        } else if (message.type === 'joined') {
          attachRef.current = { type: 'resume', code: message.code, token: message.token };
          saveToken(message.code, message.token);
          setCode(message.code);
          setPlayerId(message.playerId);
        } else if (message.type === 'table-view' || message.type === 'player-view') {
          setView(message.view);
        } else if (message.type === 'error') {
          if (attachRef.current && (message.error === 'unknown-game' || message.error === 'unknown-player')) {
            forgetGame();
          }
          setError({ error: message.error, message: message.message });
        }
      };
      socket.onclose = () => {
        if (disposed) return;
        setStatus('reconnecting');
        retryTimer = setTimeout(connect, Math.min(firstRetryMs * 2 ** retries, maxRetryMs));
        retries += 1;
      };
    };

    connect();
    return () => {
      disposed = true;
      clearTimeout(retryTimer);
      socketRef.current?.close();
    };
  }, []);

  const send = useCallback((message: ClientMessage) => {
    const socket = socketRef.current;
    if (socket?.readyState !== WebSocket.OPEN) return false;
    if (isAttachIntent(message)) attachRef.current = message;
    setError(null);
    socket.send(JSON.stringify(message));
    return true;
  }, []);

  return { status, code, playerId, view, error, send };
}

function socketUrl() {
  return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
}

import type { FastifyInstance } from 'fastify';
import type { ClientMessage, ServerMessage } from '@poker/protocol';

export type TestClient = {
  send(message: ClientMessage): void;
  sendRaw(data: string): void;
  next(): Promise<ServerMessage>;
  nextOfType<T extends ServerMessage['type']>(type: T): Promise<Extract<ServerMessage, { type: T }>>;
  close(): Promise<void>;
  readonly closed: Promise<void>;
};

export async function listen(app: FastifyInstance): Promise<string> {
  await app.listen({ port: 0, host: '127.0.0.1' });
  const address = app.server.address();
  if (address === null || typeof address === 'string') throw new Error('server has no port');
  return `ws://127.0.0.1:${address.port}/ws`;
}

export function connect(url: string): Promise<TestClient> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    const received: ServerMessage[] = [];
    const waiting: ((message: ServerMessage) => void)[] = [];

    socket.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data)) as ServerMessage;
      const waiter = waiting.shift();
      if (waiter) waiter(message);
      else received.push(message);
    });
    socket.addEventListener('error', () => reject(new Error('socket error')));
    const closed = new Promise<void>((resolveClosed) => socket.addEventListener('close', () => resolveClosed()));

    const client: TestClient = {
      send: (message) => socket.send(JSON.stringify(message)),
      sendRaw: (data) => socket.send(data),
      next: () => {
        const message = received.shift();
        if (message) return Promise.resolve(message);
        return new Promise((resolveNext) => waiting.push(resolveNext));
      },
      async nextOfType(type) {
        for (;;) {
          const message = await client.next();
          if (message.type === type) return message as never;
        }
      },
      closed,
      close: () =>
        new Promise((resolveClose) => {
          if (socket.readyState === WebSocket.CLOSED) return resolveClose();
          socket.addEventListener('close', () => resolveClose());
          socket.close();
        }),
    };

    socket.addEventListener('open', () => resolve(client));
  });
}

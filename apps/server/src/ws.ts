import type { FastifyInstance } from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import { randomUUID } from 'node:crypto';
import { dealHand, isGameError, join, playerView, tableView } from '@poker/engine';
import type { ClientMessage, ErrorCode, ServerMessage } from '@poker/protocol';
import { Registry, type Screen, type ServerGame } from './registry.ts';

export async function registerRealtime(app: FastifyInstance) {
  const registry = new Registry();

  await app.register(fastifyWebsocket);

  app.get('/ws', { websocket: true }, (socket) => {
    let session: Session | null = null;
    const screen: Screen = { send: (message) => socket.send(JSON.stringify(message)) };
    const fail = (error: ErrorCode, message: string) => screen.send(errorMessage(error, message));

    const handle = (message: ClientMessage) => {
      if (message.type === 'host') {
        if (!session?.playerId || session.game.players.get(session.playerId)?.screen !== screen) {
          return fail('not-joined', 'Join or resume a Game first');
        }
        const { game, playerId } = session;
        if (message.command?.type !== 'deal-hand') return fail('bad-message', 'Unsupported Host command');
        const next = dealHand(game.state, { by: playerId });
        if (isGameError(next)) return fail(next.error, next.message);
        game.state = next;
        return broadcast(game);
      }
      if (session) return fail('bad-message', 'This socket is already attached to a Game');

      if (message.type === 'create-game') {
        const game = registry.create();
        game.tables.add(screen);
        session = { game, playerId: null };
        screen.send({ type: 'game-created', code: game.code } satisfies ServerMessage);
        return broadcast(game);
      }
      if (message.type !== 'open-table' && message.type !== 'join' && message.type !== 'resume') return;

      const game = registry.get(message.code);
      if (!game) return fail('unknown-game', 'No Game has that code');
      if (message.type === 'open-table') {
        game.tables.add(screen);
        session = { game, playerId: null };
      } else if (message.type === 'join') {
        const playerId = randomUUID();
        const next = join(game.state, { playerId, name: message.name, seat: message.seat });
        if (isGameError(next)) return fail(next.error, next.message);
        const token = randomUUID();
        game.state = next;
        game.players.set(playerId, { id: playerId, token, screen, disconnectedAt: null });
        session = { game, playerId };
        screen.send({ type: 'joined', code: game.code, playerId, token } satisfies ServerMessage);
      } else {
        const player = [...game.players.values()].find((p) => p.token === message.token);
        if (!player) return fail('unknown-player', 'Unknown token');
        player.screen = screen;
        player.disconnectedAt = null;
        session = { game, playerId: player.id };
        screen.send({
          type: 'joined',
          code: game.code,
          playerId: player.id,
          token: player.token,
        } satisfies ServerMessage);
      }
      broadcast(game);
    };

    socket.on('message', (data) => {
      const message = parseMessage(data);
      if (!message) return fail('bad-message', 'Messages must be JSON with a type');
      try {
        handle(message);
      } catch {
        fail('bad-message', 'Malformed message');
      }
    });

    socket.on('close', () => {
      if (!session) return;
      const { game, playerId } = session;
      game.tables.delete(screen);
      const player = playerId ? game.players.get(playerId) : undefined;
      if (player?.screen !== screen) return;
      player.screen = null;
      player.disconnectedAt = Date.now();
      broadcast(game);
    });
  });
}

type Session = { game: ServerGame; playerId: string | null };

function parseMessage(data: unknown): ClientMessage | null {
  try {
    const parsed: unknown = JSON.parse(String(data));
    if (typeof parsed === 'object' && parsed !== null && typeof (parsed as { type?: unknown }).type === 'string') {
      return parsed as ClientMessage;
    }
  } catch {
    // falls through to null
  }
  return null;
}

function errorMessage(error: ErrorCode, message: string): ServerMessage {
  return { type: 'error', error, message };
}

function isConnected(game: ServerGame) {
  return (playerId: string) => game.players.get(playerId)?.screen != null;
}

function broadcast(game: ServerGame) {
  for (const table of game.tables) {
    table.send({ type: 'table-view', view: tableView(game.state, isConnected(game)) } satisfies ServerMessage);
  }
  for (const player of game.players.values()) {
    player.screen?.send({
      type: 'player-view',
      view: playerView(game.state, player.id, isConnected(game)),
    } satisfies ServerMessage);
  }
}

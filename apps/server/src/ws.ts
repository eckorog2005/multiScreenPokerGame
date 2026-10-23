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
    let session: { game: ServerGame; playerId: string } | null = null;
    const screen: Screen = { send: (message) => socket.send(JSON.stringify(message)) };

    socket.on('message', (data) => {
      const message = parseMessage(data);
      if (!message) return screen.send(errorMessage('bad-message', 'Messages must be JSON with a type'));
      if (message.type === 'create-game') {
        const game = registry.create();
        game.tables.add(screen);
        screen.send({ type: 'game-created', code: game.code } satisfies ServerMessage);
        broadcast(game);
      } else if (message.type === 'open-table') {
        const game = registry.get(message.code);
        if (!game) return screen.send(errorMessage('unknown-game', 'No Game has that code'));
        game.tables.add(screen);
        broadcast(game);
      } else if (message.type === 'join') {
        const game = registry.get(message.code);
        if (!game) return screen.send(errorMessage('unknown-game', 'No Game has that code'));
        const playerId = randomUUID();
        const next = join(game.state, { playerId, name: message.name, seat: message.seat });
        if (isGameError(next)) return screen.send({ type: 'error', error: next.error, message: next.message });
        const token = randomUUID();
        game.state = next;
        game.players.set(playerId, { id: playerId, token, screen, disconnectedAt: null });
        session = { game, playerId };
        screen.send({ type: 'joined', code: game.code, playerId, token } satisfies ServerMessage);
        broadcast(game);
      } else if (message.type === 'resume') {
        const game = registry.get(message.code);
        if (!game) return screen.send(errorMessage('unknown-game', 'No Game has that code'));
        const player = [...game.players.values()].find((p) => p.token === message.token);
        if (!player) return screen.send(errorMessage('unknown-player', 'Unknown token'));
        player.screen = screen;
        player.disconnectedAt = null;
        session = { game, playerId: player.id };
        screen.send({ type: 'joined', code: game.code, playerId: player.id, token: player.token } satisfies ServerMessage);
        broadcast(game);
      } else if (message.type === 'host' && session) {
        const { game, playerId } = session;
        if (message.command.type === 'deal-hand') {
          const next = dealHand(game.state, { by: playerId });
          if (isGameError(next)) return screen.send({ type: 'error', error: next.error, message: next.message });
          game.state = next;
          broadcast(game);
        }
      }
    });

    socket.on('close', () => {
      for (const game of registry.all()) {
        game.tables.delete(screen);
        for (const player of game.players.values()) {
          if (player.screen !== screen) continue;
          player.screen = null;
          player.disconnectedAt = Date.now();
          broadcast(game);
        }
      }
    });
  });
}

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
    player.screen?.send({ type: 'player-view', view: playerView(game.state, player.id, isConnected(game)) } satisfies ServerMessage);
  }
}

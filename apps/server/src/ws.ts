import type { FastifyInstance } from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import { randomUUID } from 'node:crypto';
import {
  act,
  claimHost,
  foldFor,
  isGameError,
  join,
  leave,
  playerView,
  setTurnTimer,
  tableView,
  takeSeat,
} from '@poker/engine';
import type { GameState } from '@poker/engine';
import type { ClientMessage, ErrorCode, HostCommand, ServerMessage } from '@poker/protocol';
import type { Clock } from './clock.ts';
import { createLoop, isConnected, type Loop } from './loop.ts';
import type { Registry, Screen, ServerGame } from './registry.ts';

export type RealtimeOptions = { registry: Registry; clock: Clock; autoDealDelayMs: number };

export async function registerRealtime(app: FastifyInstance, { registry, clock, autoDealDelayMs }: RealtimeOptions) {
  await app.register(fastifyWebsocket);

  const loop = createLoop({
    clock,
    autoDealDelayMs,
    publish: (game) => broadcast(game, loop),
    discard: (game) => registry.discard(game),
  });

  app.get('/ws', { websocket: true }, (socket) => {
    let session: Session | null = null;
    const screen: Screen = { send: (message) => socket.send(JSON.stringify(message)) };
    const fail = (error: ErrorCode, message: string) => screen.send(errorMessage(error, message));

    const handle = (message: ClientMessage) => {
      if (
        message.type === 'host' ||
        message.type === 'leave' ||
        message.type === 'take-seat' ||
        message.type === 'claim-host' ||
        message.type === 'action'
      ) {
        if (!session?.playerId || session.game.players.get(session.playerId)?.screen !== screen) {
          return fail('not-joined', 'Join or resume a Game first');
        }
        const { game, playerId } = session;
        let next: GameState | Failure;
        if (message.type === 'leave') {
          next = leave(game.state, playerId);
        } else if (message.type === 'take-seat') {
          next = takeSeat(game.state, playerId, message.seat);
        } else if (message.type === 'action') {
          next = act(game.state, playerId, message.action);
        } else if (message.type === 'claim-host') {
          if (!loop.hostClaimable(game)) {
            return fail('cannot-claim-host', 'The Host can be claimed after 60 seconds disconnected');
          }
          next = claimHost(game.state, playerId);
        } else {
          next = hostCommand(game, playerId, message.command, loop);
        }
        if ('error' in next) return fail(next.error, next.message);
        game.state = next;
        return loop.changed(game);
      }
      if (session) return fail('bad-message', 'This socket is already attached to a Game');

      if (message.type === 'create-game') {
        const game = registry.create();
        game.tables.add(screen);
        session = { game, playerId: null };
        screen.send({ type: 'game-created', code: game.code } satisfies ServerMessage);
        return loop.changed(game);
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
      loop.changed(game);
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
      if (player?.screen === screen) {
        player.screen = null;
        player.disconnectedAt = clock.now();
      }
      loop.changed(game);
    });
  });
}

type Session = { game: ServerGame; playerId: string | null };

type Failure = { error: ErrorCode; message: string };

function hostCommand(game: ServerGame, playerId: string, command: HostCommand, loop: Loop): GameState | Failure {
  if (command?.type === 'deal-hand') return loop.deal(game, playerId);
  if (command?.type === 'set-turn-timer') return setTurnTimer(game.state, playerId, command.seconds);
  if (command?.type === 'fold-for') {
    const toAct = game.state.hand?.toAct;
    if (toAct && game.state.hostId === playerId && isConnected(game)(toAct)) {
      return { error: 'cannot-fold-for', message: 'Only a disconnected Player can be folded for' };
    }
    return foldFor(game.state, playerId);
  }
  if (command?.type === 'set-paused') {
    if (game.state.hostId !== playerId) return { error: 'not-host', message: 'Only the Host can do that' };
    if (typeof command.paused !== 'boolean')
      return { error: 'invalid-setting', message: 'paused must be true or false' };
    game.paused = command.paused;
    return game.state;
  }
  return { error: 'bad-message', message: 'Unsupported Host command' };
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

function broadcast(game: ServerGame, loop: Loop) {
  const context = loop.viewContext(game);
  for (const table of game.tables) {
    table.send({ type: 'table-view', view: tableView(game.state, context) } satisfies ServerMessage);
  }
  for (const player of game.players.values()) {
    player.screen?.send({
      type: 'player-view',
      view: playerView(game.state, player.id, context),
    } satisfies ServerMessage);
  }
}

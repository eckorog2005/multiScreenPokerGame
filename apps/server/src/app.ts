import { fileURLToPath } from 'node:url';
import Fastify, { type FastifyServerOptions } from 'fastify';
import fastifyStatic from '@fastify/static';
import type { ErrorCode, GameSeatsResponse } from '@poker/protocol';
import { systemClock, type Clock } from './clock.ts';
import { DEFAULT_AUTO_DEAL_DELAY_MS } from './loop.ts';
import { Registry } from './registry.ts';
import { registerRealtime } from './ws.ts';

const publicDir = fileURLToPath(new URL('../public', import.meta.url));

export type GameOptions = { clock?: Clock; autoDealDelayMs?: number };

export function buildApp(opts: FastifyServerOptions = {}, game: GameOptions = {}) {
  const { clock = systemClock, autoDealDelayMs = DEFAULT_AUTO_DEAL_DELAY_MS } = game;
  const app = Fastify(opts);

  app.register(fastifyStatic, { root: publicDir, prefix: '/static/' });

  app.get('/', (_request, reply) => reply.sendFile('index.html'));

  app.get('/hello', async () => 'hello');

  const registry = new Registry(clock);

  app.get<{ Params: { code: string } }>('/api/games/:code', async (request, reply) => {
    const game = registry.get(request.params.code);
    if (!game) return reply.code(404).send({ error: 'unknown-game' satisfies ErrorCode });
    const seats = game.state.players.flatMap((p) => (p.seat === null ? [] : [{ seat: p.seat, name: p.name }]));
    return { code: game.code, seats } satisfies GameSeatsResponse;
  });

  app.register(registerRealtime, { registry, clock, autoDealDelayMs });

  return app;
}

import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import Fastify, { type FastifyServerOptions } from 'fastify';
import fastifyStatic from '@fastify/static';
import type { ErrorCode, GameSeatsResponse } from '@poker/protocol';
import { systemClock, type Clock } from './clock.ts';
import { DEFAULT_AUTO_DEAL_DELAY_MS } from './loop.ts';
import { Registry } from './registry.ts';
import { registerRealtime } from './ws.ts';

const clientDir = fileURLToPath(new URL('../../client/dist', import.meta.url));

export type GameOptions = { clock?: Clock; autoDealDelayMs?: number };

export function buildApp(opts: FastifyServerOptions = {}, game: GameOptions = {}) {
  const { clock = systemClock, autoDealDelayMs = DEFAULT_AUTO_DEAL_DELAY_MS } = game;
  const app = Fastify(opts);

  // dist is absent until the client is built; the API and /ws must still start (pnpm dev).
  if (existsSync(clientDir)) {
    app.register(fastifyStatic, { root: clientDir });

    app.setNotFoundHandler((request, reply) => {
      const path = request.url.split('?')[0]!;
      const isClientRoute =
        request.method === 'GET' && !path.startsWith('/api') && path !== '/ws' && !path.includes('.');
      return isClientRoute ? reply.sendFile('index.html') : reply.code(404).send({ error: 'not-found' });
    });
  }

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

import { fileURLToPath } from 'node:url';
import Fastify, { type FastifyServerOptions } from 'fastify';
import fastifyStatic from '@fastify/static';
import type { ErrorCode, GameSeatsResponse } from '@poker/protocol';
import { Registry } from './registry.ts';
import { registerRealtime } from './ws.ts';

const publicDir = fileURLToPath(new URL('../public', import.meta.url));

export function buildApp(opts: FastifyServerOptions = {}) {
  const app = Fastify(opts);

  app.register(fastifyStatic, { root: publicDir, prefix: '/static/' });

  app.get('/', (_request, reply) => reply.sendFile('index.html'));

  app.get('/hello', async () => 'hello');

  const registry = new Registry();

  app.get<{ Params: { code: string } }>('/api/games/:code', async (request, reply) => {
    const game = registry.get(request.params.code);
    if (!game) return reply.code(404).send({ error: 'unknown-game' satisfies ErrorCode });
    const seats = game.state.players.flatMap((p) => (p.seat === null ? [] : [{ seat: p.seat, name: p.name }]));
    return { code: game.code, seats } satisfies GameSeatsResponse;
  });

  app.register(registerRealtime, { registry });

  return app;
}

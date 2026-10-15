import { fileURLToPath } from 'node:url';
import Fastify, { type FastifyServerOptions } from 'fastify';
import fastifyStatic from '@fastify/static';

const publicDir = fileURLToPath(new URL('../public', import.meta.url));

export function buildApp(opts: FastifyServerOptions = {}) {
  const app = Fastify(opts);

  app.register(fastifyStatic, { root: publicDir, prefix: '/static/' });

  app.get('/', (_request, reply) => reply.sendFile('index.html'));

  app.get('/hello', async () => 'hello');

  return app;
}

import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';

const publicDir = fileURLToPath(new URL('../public', import.meta.url));

export function buildApp(opts = {}) {
  const app = Fastify(opts);

  app.register(fastifyStatic, { root: publicDir, prefix: '/static/' });

  app.get('/', (request, reply) => reply.sendFile('index.html'));

  app.get('/hello', async () => 'hello');

  return app;
}

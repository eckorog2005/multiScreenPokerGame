import { buildApp } from './app.ts';
import { seededRng } from './seeded-rng.ts';

// Test-only: makes shuffles reproducible for the end-to-end test.
const seed = process.env.POKER_TEST_SEED;
const app = buildApp({ logger: true }, seed === undefined ? {} : { rng: seededRng(Number(seed)) });

const port = Number(process.env.PORT ?? 9090);
const host = process.env.HOST ?? '0.0.0.0';

try {
  await app.listen({ port, host });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

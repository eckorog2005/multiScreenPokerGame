import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildApp } from '../src/app.ts';

const indexHtml = readFileSync(new URL('../../client/dist/index.html', import.meta.url), 'utf8');

for (const url of ['/', '/table', '/play?code=ABCD', '/table/anything']) {
  test(`GET ${url} serves the client's index.html`, async (t) => {
    const app = buildApp();
    t.after(() => app.close());

    const res = await app.inject({ method: 'GET', url });

    assert.equal(res.statusCode, 200);
    assert.match(res.headers['content-type'] ?? '', /text\/html/);
    assert.equal(res.body, indexHtml);
  });
}

test('unknown /api routes stay 404 instead of falling back to the client', async (t) => {
  const app = buildApp();
  t.after(() => app.close());

  const res = await app.inject({ method: 'GET', url: '/api/nope' });

  assert.equal(res.statusCode, 404);
});

test('/api routes take priority over the client', async (t) => {
  const app = buildApp();
  t.after(() => app.close());

  const res = await app.inject({ method: 'GET', url: '/api/games/ZZZZ' });

  assert.equal(res.statusCode, 404);
  assert.match(res.headers['content-type'] ?? '', /application\/json/);
});

test('a missing asset is a 404, not the client', async (t) => {
  const app = buildApp();
  t.after(() => app.close());

  const res = await app.inject({ method: 'GET', url: '/assets/old-hash.js' });

  assert.equal(res.statusCode, 404);
});

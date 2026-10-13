import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';

test('GET / serves the index page', async (t) => {
  const app = buildApp();
  t.after(() => app.close());

  const res = await app.inject({ method: 'GET', url: '/' });

  assert.equal(res.statusCode, 200);
  assert.match(res.headers['content-type'], /text\/html/);
  assert.match(res.body, /\/static\/css\/style\.css/);
});

test('GET /hello returns hello', async (t) => {
  const app = buildApp();
  t.after(() => app.close());

  const res = await app.inject({ method: 'GET', url: '/hello' });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body, 'hello');
});

test('GET /static/css/style.css serves static assets', async (t) => {
  const app = buildApp();
  t.after(() => app.close());

  const res = await app.inject({ method: 'GET', url: '/static/css/style.css' });

  assert.equal(res.statusCode, 200);
  assert.match(res.headers['content-type'], /text\/css/);
});

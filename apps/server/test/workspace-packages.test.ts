import { test } from 'node:test';
import assert from 'node:assert/strict';
import { name as engineName } from '@poker/engine';
import { name as protocolName } from '@poker/protocol';

test('imports the shared workspace packages', () => {
  assert.equal(engineName, '@poker/engine');
  assert.equal(protocolName, '@poker/protocol');
});

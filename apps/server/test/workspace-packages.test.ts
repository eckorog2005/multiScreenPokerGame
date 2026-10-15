import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newDeck } from '@poker/engine';
import { name as protocolName } from '@poker/protocol';

test('imports the shared workspace packages', () => {
  assert.equal(newDeck().length, 52);
  assert.equal(protocolName, '@poker/protocol');
});

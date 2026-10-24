import { expect, test } from 'vitest';
import { newDeck } from '@poker/engine';
import { name as protocolName } from '@poker/protocol';

test('imports the shared workspace packages', () => {
  expect(newDeck()).toHaveLength(52);
  expect(protocolName).toBe('@poker/protocol');
});

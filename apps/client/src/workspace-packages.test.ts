import { expect, test } from 'vitest'
import { name as engineName } from '@poker/engine'
import { name as protocolName } from '@poker/protocol'

test('imports the shared workspace packages', () => {
  expect(engineName).toBe('@poker/engine')
  expect(protocolName).toBe('@poker/protocol')
})

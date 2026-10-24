import { expect, test } from 'vitest';
import type { LegalActionsView } from '@poker/protocol';
import { betPresets, clampBet, stepBet } from './bet.ts';

const legal = (overrides: Partial<LegalActionsView>): LegalActionsView => ({
  actions: ['fold', 'call', 'raise', 'all-in'],
  toCall: 10,
  minRaiseTo: 20,
  maxRaiseTo: 1000,
  ...overrides,
});

test('preflop presets with blinds of 5/10: ½ pot raises to 22, pot to 35', () => {
  expect(betPresets(legal({}), { pot: 15, currentBet: 10 })).toEqual([
    { label: 'Min', amount: 20 },
    { label: '½ pot', amount: 22 },
    { label: 'Pot', amount: 35 },
    { label: 'All-in', amount: 1000 },
  ]);
});

test('a bet into a pot of 100 is 50 for ½ pot and 100 for pot', () => {
  const bet = legal({ actions: ['fold', 'check', 'bet', 'all-in'], toCall: 0, minRaiseTo: 10 });

  expect(betPresets(bet, { pot: 100, currentBet: 0 }).map((p) => p.amount)).toEqual([10, 50, 100, 1000]);
});

test('presets above the stack are clamped to all-in', () => {
  const short = legal({ maxRaiseTo: 30 });

  expect(betPresets(short, { pot: 15, currentBet: 10 }).map((p) => p.amount)).toEqual([20, 22, 30, 30]);
});

test('amounts are whole Chips within the legal range', () => {
  expect(clampBet(57.8, legal({}))).toBe(57);
  expect(clampBet(5, legal({}))).toBe(20);
  expect(clampBet(5000, legal({}))).toBe(1000);
  expect(clampBet(Number.NaN, legal({}))).toBe(20);
});

test('steps move by one big blind and stop at the limits', () => {
  expect(stepBet(40, 1, legal({}), 10)).toBe(50);
  expect(stepBet(40, -1, legal({}), 10)).toBe(30);
  expect(stepBet(25, -1, legal({}), 10)).toBe(20);
  expect(stepBet(995, 1, legal({}), 10)).toBe(1000);
});

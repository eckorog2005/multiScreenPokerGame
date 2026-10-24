import type { HandView, LegalActionsView } from '@poker/protocol';

export type BetPreset = { readonly label: string; readonly amount: number };

export function clampBet(amount: number, legal: LegalActionsView): number {
  const min = legal.minRaiseTo ?? 0;
  const max = legal.maxRaiseTo ?? min;
  if (Number.isNaN(amount)) return min;
  return Math.min(max, Math.max(min, Math.floor(amount)));
}

export function stepBet(amount: number, direction: 1 | -1, legal: LegalActionsView, bigBlind: number): number {
  return clampBet(amount + direction * bigBlind, legal);
}

/** "To" amounts; a pot-sized raise first calls, then raises by the pot after the call. */
export function betPresets(
  legal: LegalActionsView,
  { pot, currentBet }: Pick<HandView, 'pot' | 'currentBet'>,
): BetPreset[] {
  const potAfterCall = pot + legal.toCall;
  return [
    { label: 'Min', amount: clampBet(legal.minRaiseTo ?? 0, legal) },
    { label: '½ pot', amount: clampBet(currentBet + potAfterCall / 2, legal) },
    { label: 'Pot', amount: clampBet(currentBet + potAfterCall, legal) },
    { label: 'All-in', amount: clampBet(legal.maxRaiseTo ?? 0, legal) },
  ];
}

import type { Rng } from '@poker/engine';

/** mulberry32: small, fast and reproducible. Not for real games. */
export function seededRng(seed: number): Rng {
  let state = seed >>> 0;
  return (maxExclusive) => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return Math.floor((((t ^ (t >>> 14)) >>> 0) / 2 ** 32) * maxExclusive);
  };
}

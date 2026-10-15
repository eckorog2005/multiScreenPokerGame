/** Returns a uniformly random whole number in [0, maxExclusive). */
export type Rng = (maxExclusive: number) => number;

const UINT32_RANGE = 2 ** 32;

export const cryptoRng: Rng = (maxExclusive) => {
  // Rejection sampling avoids modulo bias.
  const limit = UINT32_RANGE - (UINT32_RANGE % maxExclusive);
  const buffer = new Uint32Array(1);
  do {
    crypto.getRandomValues(buffer);
  } while (buffer[0]! >= limit);
  return buffer[0]! % maxExclusive;
};

export function shuffle<T>(items: readonly T[], rng: Rng = cryptoRng): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = rng(i + 1);
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

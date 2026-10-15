# 03: Engine — cards, shuffle and hand evaluation

Status: resolved
Blocked by: 02

## What

Card primitives and hand ranking in `packages/engine`.

## Acceptance criteria

- [x] There are `Card`, `Rank` and `Suit` types and a 52-card deck.
- [x] `shuffle` uses a crypto RNG by default and accepts an injected RNG so tests are deterministic.
- [x] An evaluator takes 2 Hole Cards plus 3–5 Board cards and returns the best five-card hand. The result can be compared (higher, lower, tie) and has a readable description, e.g. "Two Pair, Kings and Sevens", "Straight, Five High" (the wheel), "Royal Flush".
- [x] Unit tests cover every hand category, kicker comparisons, ties, the wheel (A-2-3-4-5), and a Board that plays (both Players' best hand is the five Board cards).

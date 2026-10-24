# 10: Game loop — auto-deal, turn timer, disconnects, cleanup

Status: resolved
Blocked by: 07

## What

The server-side timing around the pure engine.

## Acceptance criteria

- [x] **Auto-deal**: after the Host deals the first Hand, each later Hand deals itself a few seconds (configurable, default 5) after the pot is awarded, unless the Host has paused or too few Players are eligible.
- [x] **Turn timer**: when it's on, a Player who runs out of time checks if checking is allowed and otherwise folds. The remaining time is included in views.
- [x] **Disconnects**: on a disconnected Player's turn, the Game waits (unless the timer is on) and Host views get "fold for them". A Player still disconnected when the next Hand deals is set to Sitting Out, and reconnecting doesn't undo Sitting Out automatically.
- [x] **Host claim**: the claim command is allowed only after the Host has been disconnected for more than 60 seconds.
- [x] **Cleanup**: a Game with no connected screens for 30 minutes is discarded.
- [x] Timers use an injectable clock, and tests use fake timers instead of real waiting.

## Comments

- Done. Timers live in `apps/server/src/loop.ts` (one `Timer` slot per Game for turn, deal, host claim and cleanup) behind the injectable `Clock` in `clock.ts`; `buildApp(opts, { clock, autoDealDelayMs })`. Tests in `apps/server/test/loop.test.ts` use `FakeClock`.
- Views gained `paused`, `hand.turnTimeLeftMs`, `you.canFoldFor` and `you.canClaimHost` (the engine views take a `ViewContext`).
- The server now handles `action`, `claim-host` and the Host commands `set-paused`, `set-turn-timer` and `fold-for`. `action` was needed to test the timer's check rule; issue 11 only needs the UI for it.

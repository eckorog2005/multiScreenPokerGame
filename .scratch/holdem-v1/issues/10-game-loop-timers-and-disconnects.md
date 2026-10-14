# 10: Game loop — auto-deal, turn timer, disconnects, cleanup

Status: ready-for-agent
Blocked by: 07

## What

The server-side timing around the pure engine.

## Acceptance criteria

- [ ] **Auto-deal**: after the Host deals the first Hand, each later Hand deals itself a few seconds (configurable, default 5) after the pot is awarded, unless the Host has paused or too few Players are eligible.
- [ ] **Turn timer**: when it's on, a Player who runs out of time checks if checking is allowed and otherwise folds. The remaining time is included in views.
- [ ] **Disconnects**: on a disconnected Player's turn, the Game waits (unless the timer is on) and Host views get "fold for them". A Player still disconnected when the next Hand deals is set to Sitting Out, and reconnecting doesn't undo Sitting Out automatically.
- [ ] **Host claim**: the claim command is allowed only after the Host has been disconnected for more than 60 seconds.
- [ ] **Cleanup**: a Game with no connected screens for 30 minutes is discarded.
- [ ] Timers use an injectable clock, and tests use fake timers instead of real waiting.

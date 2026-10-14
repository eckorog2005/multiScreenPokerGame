# 06: Protocol messages and per-screen views

Status: ready-for-agent
Blocked by: 05

## What

Define what goes over the wire, and enforce ADR 0002 (each screen is sent only what it may see) in pure, tested code.

## Acceptance criteria

- [ ] `packages/protocol` defines the client→server intents (create Game, open Table for a Game Code, join, resume with token, each betting action, sit out, leave, rebuy, show cards after winning uncontested, and each Host command) and the server→client messages (a full view snapshot plus typed errors).
- [ ] `packages/engine` exposes `tableView(game)` and `playerView(game, playerId)`, which return those view types.
- [ ] `tableView` contains no Hole Cards except Players' revealed cards (at Showdown, in an all-in runout, or when an uncontested winner chooses to show).
- [ ] `playerView` contains that Player's own Hole Cards, their legal actions with min/max amounts, and the amount to call. Other Players' Hole Cards follow the same reveal rules as `tableView`.
- [ ] Neither view contains the deck or any undealt cards.
- [ ] Tests compare the views against a known Game state and assert that no hidden card leaks into any view, e.g. by checking the serialized JSON for card IDs.

## Notes

Sending a full snapshot on every change is fine for v1, since Games are small. That keeps reconnect/resync trivial.

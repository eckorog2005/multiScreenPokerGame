# 12: Table view — showing the Game

Status: resolved
Blocked by: 09

## What

The shared screen (`/table`) during play, readable from across a room on a TV or laptop.

## Acceptance criteria

- [x] Seats are arranged around an oval. Each Seat shows the Player's name, Chip stack, current bet, and status: Sitting Out, disconnected, folded or all-in.
- [x] The Table shows the button and the blind positions, and highlights whose turn it is (with the turn timer, when it's on).
- [x] The Table shows the Board and the pot(s), including side pots.
- [x] Showdown and all-in runouts show each revealed hand, which pot(s) each winner took, and the hand description (e.g. "Two Pair, Kings and Sevens").
- [x] The Game Code and QR code stay visible in a corner so late joiners can find them.
- [x] Between Hands, the Table shows "Paused by Host" or "Waiting for players" when either applies.
- [ ] When the Game ends, the Table shows the Standings sorted by net result. (Built and tested; it shows once issue 13 sets `ended`.)
- [x] The Table never renders Hole Cards that aren't in the view. That's enforced by the server (issue 06), and the Table just renders what it's given.

## Comments

- Done. The Table's play area is `apps/client/src/table/TableTop.tsx`; `screens/Table.tsx` keeps the connection, plus the Game Code and QR code in a corner (`.join-corner`). Seats sit around an oval through CSS trig on a `--seat` variable, falling back to a grid under 700px wide.
- New view fields: `SeatView.blind` (`'small' | 'big' | null`, from new `HandState.smallBlindSeat`/`bigBlindSeat`), `HandView.pots` (main pot then side pots, cut at each live all-in, for use during play), and `ended`.
- `ended` comes from `ViewContext.ended`, which the server doesn't set yet. Issue 13's end-game command should set it. Until then the Standings screen is built and tested but never shown.
- The turn timer counts down locally from `hand.turnTimeLeftMs` and restarts from each new view.
- "Waiting for players" uses the same rule as the server's auto-deal (connected, has Chips, not Sitting Out). Before the first Hand, with enough Players, the Table says "Waiting for the Host to deal" instead.
- An all-in runout completes the Hand at once, so it shows like any Showdown, with the result.
- The oval layout hasn't been checked in a browser; issue 17 owns the visual pass.

# 12: Table view — showing the Game

Status: ready-for-agent
Blocked by: 09

## What

The shared screen (`/table`) during play, readable from across a room on a TV or laptop.

## Acceptance criteria

- [ ] Seats are arranged around an oval. Each Seat shows the Player's name, Chip stack, current bet, and status: Sitting Out, disconnected, folded or all-in.
- [ ] The Table shows the button and the blind positions, and highlights whose turn it is (with the turn timer, when it's on).
- [ ] The Table shows the Board and the pot(s), including side pots.
- [ ] Showdown and all-in runouts show each revealed hand, which pot(s) each winner took, and the hand description (e.g. "Two Pair, Kings and Sevens").
- [ ] The Game Code and QR code stay visible in a corner so late joiners can find them.
- [ ] Between Hands, the Table shows "Paused by Host" or "Waiting for players" when either applies.
- [ ] When the Game ends, the Table shows the Standings sorted by net result.
- [ ] The Table never renders Hole Cards that aren't in the view. That's enforced by the server (issue 06), and the Table just renders what it's given.

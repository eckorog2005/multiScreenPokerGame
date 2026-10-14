# Spec: No-Limit Hold'em v1

A same-room No-Limit Texas Hold'em cash game. A **Table** (TV or laptop) creates a **Game** and shows it. Each **Player** joins from their **Player Device** (phone) with the **Game Code** and plays from there.

Vocabulary is defined in `CONTEXT.md`. Use those terms in code, tests and UI copy. Scope and architecture decisions are in `docs/adr/0001-v1-scope-same-room-play-money.md` and `docs/adr/0002-server-authoritative-hidden-information.md`.

## Rules of the Game

- No-Limit Hold'em cash game with 2–9 Seats, including heads-up rules (the button posts the small blind and acts first before the flop).
- Standard rules (TDA): the minimum raise equals the previous raise, an all-in smaller than a full raise doesn't reopen betting for Players who already acted, a side pot is built for each all-in amount, and the odd Chip in a split pot goes to the first winner clockwise from the button. No straddles, no running the board twice and no rabbit hunting.
- Defaults are a 1,000-Chip starting stack and 5/10 blinds. The Host can change both before the first Hand and blinds between Hands (effective from the next Hand).
- The button starts at a random Seat. A Hand is dealt only when at least two Players who have Chips and aren't Sitting Out are seated.
- Late joiners are dealt in from the next Hand and pay no extra blind.
- **Rebuy**: when a Player has 0 Chips, they can take a full starting stack between Hands, as often as they like, with no approval.
- **Sitting Out** is a toggle that takes effect from the next Hand, and a returning Player owes no missed blinds.
- **Seats** are picked when joining and can't be changed.
- **Leaving** (between Hands, or by folding first) frees the Seat but keeps the Player and their Chips. When the same Player Device rejoins, that Player gets their Chips back and picks any empty Seat.
- **Removal by the Host** folds the Player if they're in a Hand. Their Chips leave with them, and they keep their row in the Standings. If they rejoin, they come back as a new Player.
- **Showdown** reveals every hand still in the pot on the Table, along with the winner and the hand rank (e.g. "Two Pair, Kings and Sevens"). When everyone else folds, the winner can choose to show. When every Player left in the Hand is all-in, their Hole Cards are shown right away and the Board is dealt out.

## Flow

- The Table creates a Game and shows the Game Code (4 uppercase letters, no I or O) plus a QR code for `/play?code=XXXX`.
- A Player enters a display name (unique within the Game) and picks an empty Seat. A token stored on the Player Device identifies them from then on.
- The first Player to join becomes **Host**. If the Host leaves, the role passes to the next occupied Seat clockwise. If the Host has been disconnected for more than 60 seconds, any Player can claim the role.
- The Host deals the first Hand. Each later Hand deals itself a few seconds after the pot is awarded, and the Host can pause between Hands.
- The turn timer is off by default, and the Host can set it (e.g. 30 s). When it runs out, the Player checks if checking is allowed and otherwise folds.
- **Disconnects**: on a disconnected Player's turn, the Game waits and the Host can fold for them. A Player still disconnected when the next Hand starts is automatically Sitting Out, and reconnecting restores their Seat.
- **Table disconnects**: the Game keeps going. Any browser can open the Table view with the Game Code, and several Table views at once is fine.
- A Game ends when the Host ends it, or after 30 minutes with no screens connected. When it ends, the Table shows the **Standings** (each Player's Chips minus their starting stack and all Rebuys).

## Screens

- **Table**: the Board, pot(s), Seats with names, Chip stacks and current bets, the button and blinds, whose turn it is, Showdown reveals, and the Standings when the Game ends. It never shows Hole Cards before Showdown.
- **Player Device**:
  - Hole Cards, face down until the Player holds a finger on them to peek.
  - The Player's Chip stack, the amount to call, and a compact copy of the Board and pot.
  - Bet controls: preset buttons (min-raise, ½ pot, pot, all-in) plus a slider with ±1 big blind steps, in whole Chips.
  - On the Player's turn, the phone vibrates and goes to a full-screen "Your turn" state.
  - The screen stays awake during a Game.
  - Sit Out, Leave and Rebuy controls, plus Host controls when the Player is Host.

## Architecture

- The server is authoritative (ADR 0002). Clients send intents and render the views the server sends. Each Player Device gets only its own Hole Cards, and the Table gets none until Showdown or an all-in runout.
- `packages/engine`: pure TypeScript rules (cards, shuffle, hand evaluation, the Hand state machine, Game-level rules and per-screen views). It has no I/O and is fully unit tested.
- `packages/protocol`: TypeScript types for the WebSocket messages, imported by both apps.
- `apps/server`: TypeScript, Fastify 5, `@fastify/websocket` on `/ws`. Games are kept in memory (ADR 0001).
- `apps/client`: React, with `/` (host a Table or join a Game), `/table` and `/play` routes.

## Out of scope for v1

Remote play, chat, spectators, accounts, persistence, real-money settle-up, tournaments, other poker variants, pre-actions (e.g. check/fold), hand history.

# Bots

Status: needs-triage

## What

The Host can fill empty Seats with Bots: Players run by the server, with no Player Device. See **Bot** in `CONTEXT.md`.

## Decisions

- A Bot is a Player (Seat, Chips, blinds, Hands, Standings). It is never the Host, so `transfer-host` stays human-only.
- Only the Host adds and removes Bots, from the Host controls, between Hands (lobby included). A Bot added mid-Game joins the next Hand. There is no Bot count when creating a Game.
- A new Bot takes the lowest free Seat and a unique name ("Bot Ada", "Bot Ben", ...).
- One fixed, simple strategy using `evaluateHand`: check/call medium hands, raise strong ones, fold weak hands to big bets. No difficulty levels, no bluffing.
- A Bot acts after a fixed ~1.5s delay. The turn timer does not apply to Bots.
- Bots never use the optional `show` action.
- The loop treats Bots as always connected and never Sitting Out; the Host cannot Sit One Out.
- Auto-deal needs at least 2 connected Players, at least one of them human.
- A Bot that busts is removed automatically (no Rebuy).
- The Table shows a "Bot" tag on the Seat. Standings lists Bots, marked as Bots.
- Bots are in-memory and end with the Game (ADR 0001). No ADR needed.

## Acceptance criteria

- [ ] The Host sees "Add Bot" and "Remove" controls for Bots between Hands; other Players do not.
- [ ] Adding a Bot with no free Seat returns an error.
- [ ] A Game with one human and one Bot deals Hands automatically and the Bot acts after ~1.5s.
- [ ] The Bot never acts out of turn and only takes legal actions.
- [ ] If every human is disconnected, auto-deal stops until a human returns.
- [ ] A busted Bot is removed after the Hand.
- [ ] A Bot is never Host, including when the Host leaves or is claimed.
- [ ] The Table shows the "Bot" tag; Standings lists Bots as Bots.
- [ ] Bots never reveal Hole Cards in any view (ADR 0002).

## Touchpoints (unverified)

- `packages/protocol`: `add-bot` / `remove-bot` Host commands; Bot flag on the Seat and Standings views.
- `packages/engine`: Bot flag on the player; a pure Bot decision function.
- `apps/server/src/loop.ts`: connectivity rules, Bot action timer, auto-remove on bust.
- `apps/client`: Host-controls button, Seat tag on the Table.

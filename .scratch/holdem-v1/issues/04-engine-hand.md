# 04: Engine — the Hand state machine

Status: ready-for-agent
Blocked by: 03

## What

A pure state machine for one **Hand** of No-Limit Hold'em: it takes the dealt-in Players (Seat, Chips), the button, the blinds and a deck, and plays out to an awarded pot. Its shape is `applyAction(state, playerId, action) → new state | rule error`.

## Acceptance criteria

- [ ] Blinds are posted correctly, including heads-up (the button posts the small blind and acts first before the flop, last after it) and Players with fewer Chips than a blind (all-in for less).
- [ ] The betting rounds are pre-flop, flop, turn and river, in the correct action order.
- [ ] Legal actions are fold, check, call, bet and raise (to an amount), and all-in. The state exposes the current Player's legal actions and min/max amounts, which the Player Device UI needs.
- [ ] The minimum raise equals the previous raise amount, and an all-in smaller than a full raise doesn't reopen betting for Players who already acted.
- [ ] Side pots are built for each all-in amount, and each pot is awarded to its best eligible hand. A split pot divides evenly, with the odd Chip going to the first winner clockwise from the button.
- [ ] When everyone else folds, the Hand ends without a Showdown, and the winner can choose to show.
- [ ] When no more betting is possible (all-in runout), the state marks Hole Cards as revealed and deals the rest of the Board.
- [ ] At Showdown, the result lists each pot, its winner(s) and the hand descriptions from issue 03.
- [ ] Chips are conserved: every test checks that the total Chips before the Hand equals the total after.
- [ ] Table-driven tests cover each rule above, including a three-way all-in that creates two side pots.

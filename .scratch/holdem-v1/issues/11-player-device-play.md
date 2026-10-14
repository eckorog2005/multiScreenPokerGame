# 11: Player Device — playing a Hand

Status: ready-for-agent
Blocked by: 09

## What

The phone screen (`/play`) once a Player is seated. Design it for phones first.

## Acceptance criteria

- [ ] **Hole Cards** are face down by default and show only while the Player holds a finger on them (pointer down → face up, pointer up or cancel → face down).
- [ ] The screen shows the Player's Chip stack, the amount to call, and a compact copy of the Board and pot.
- [ ] Only the legal actions from the view are offered: fold, check or call (labelled with the amount), and bet or raise.
- [ ] **Bet controls**: preset buttons for min-raise, ½ pot, pot and all-in, plus a slider with +/− steps of one big blind. Amounts are whole Chips, clamped to the legal min/max.
- [ ] **On the Player's turn**: the phone vibrates (`navigator.vibrate`, where supported) and shows a full-screen "Your turn" state.
- [ ] The Screen Wake Lock API keeps the screen awake while the Player is in a Game, and the lock is re-acquired when the page becomes visible again.
- [ ] A Sit Out toggle, a Leave button (enabled between Hands or after folding), a Rebuy button (shown at 0 Chips between Hands) and a "Show cards" button (after winning uncontested).
- [ ] When disconnected, the screen shows a banner that says it's reconnecting.
- [ ] Component tests cover the peek behavior, bet clamping and preset math, and which actions are offered for sample views.

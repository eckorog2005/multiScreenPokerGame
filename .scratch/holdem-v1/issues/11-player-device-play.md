# 11: Player Device — playing a Hand

Status: resolved
Blocked by: 09

## What

The phone screen (`/play`) once a Player is seated. Design it for phones first.

## Acceptance criteria

- [x] **Hole Cards** are face down by default and show only while the Player holds a finger on them (pointer down → face up, pointer up or cancel → face down).
- [x] The screen shows the Player's Chip stack, the amount to call, and a compact copy of the Board and pot.
- [x] Only the legal actions from the view are offered: fold, check or call (labelled with the amount), and bet or raise.
- [x] **Bet controls**: preset buttons for min-raise, ½ pot, pot and all-in, plus a slider with +/− steps of one big blind. Amounts are whole Chips, clamped to the legal min/max.
- [x] **On the Player's turn**: the phone vibrates (`navigator.vibrate`, where supported) and shows a full-screen "Your turn" state.
- [x] The Screen Wake Lock API keeps the screen awake while the Player is in a Game, and the lock is re-acquired when the page becomes visible again.
- [x] A Sit Out toggle, a Leave button (enabled between Hands or after folding), a Rebuy button (shown at 0 Chips between Hands) and a "Show cards" button (after winning uncontested).
- [x] When disconnected, the screen shows a banner that says it's reconnecting.
- [x] Component tests cover the peek behavior, bet clamping and preset math, and which actions are offered for sample views.

## Comments

- Done. The seated screen is `apps/client/src/play/Seated.tsx`. Hole Cards peek is in `HoleCards.tsx`, the bet math (presets, clamping, big-blind steps) is in `bet.ts`, and the wake lock is `use-wake-lock.ts`, held from the moment a Player is in a Game (including the seat picker).
- A pot-sized raise is `currentBet + pot + toCall` (the view's `pot` already includes this street's bets); ½ pot uses half of `pot + toCall`. All presets are rounded down and clamped to the legal range.
- The server now handles `sit-out` and `rebuy`. A shared `CardFace` component in `apps/client/src/CardFace.tsx` is ready for the Table view (issue 12).
- Show cards is decided on the client from `hand.result`; a `you.canShow` flag from the server would match `canFoldFor` if this rule ever grows.
- Also fixed a flaky loop test from issue 10 that hung whenever Bob was dealt the button.

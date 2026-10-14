# 05: Engine — Game-level rules

Status: ready-for-agent
Blocked by: 04

## What

A pure model of a **Game** that holds Players, Seats, settings and the current Hand, and enforces the rules between Hands. It doesn't know about timers or sockets: callers send it commands and timestamps.

## Acceptance criteria

- [ ] **Joining**: a Player joins with a display name that's unique within the Game and an empty Seat (at most 9 Seats). A Player who joins mid-Hand is dealt in from the next Hand with no extra blind.
- [ ] **Seats are fixed**: there's no command to change Seat.
- [ ] **Host**: the first Player to join becomes Host. When the Host leaves or is removed, the role passes to the next occupied Seat clockwise. The Game also exposes a "claim Host" command that a caller can allow when the Host has been disconnected for more than 60 seconds.
- [ ] **Settings**: the starting stack (default 1,000) and blinds (default 5/10) can be changed by the Host before the first Hand. Blinds can also be changed between Hands, taking effect from the next Hand. The turn timer setting (off or a number of seconds) is stored here, and enforcement lives in issue 10.
- [ ] **Dealing**: a Hand can start only when at least two seated Players have Chips and aren't Sitting Out. For the first Hand, the button goes to a random Seat. After that, it moves to the next eligible Seat.
- [ ] **Sitting Out**: the toggle takes effect from the next Hand, and returning Players owe no missed blinds.
- [ ] **Rebuy**: allowed only with 0 Chips, only between Hands, and for exactly the starting stack. The Game counts Rebuys per Player.
- [ ] **Leaving**: possible between Hands (or after folding). It frees the Seat but keeps the Player and their Chips. Rejoining from the same Player (same identity) restores their Chips into any empty Seat.
- [ ] **Removal**: when the Host removes a Player, that Player folds if they're in a Hand, and their Chips leave with them. They keep their row in the Standings, and if they rejoin, they come back as a new Player with a fresh identity. A removed Player doesn't keep their display name reserved, so they can rejoin under the same name.
- [ ] **Fold for**: the Host can fold for the Player whose turn it is. The caller decides when this is allowed (when that Player is disconnected).
- [ ] **Standings**: a Player's net result is their current Chips minus their starting stack and all Rebuys. Removed Players are included, using the Chips they had when removed.
- [ ] Every command checks permissions (Host-only commands, acting only on your own turn) and returns a typed error otherwise.

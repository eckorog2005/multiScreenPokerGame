# 09: Join flow (Table creates, Players join)

Status: ready-for-agent
Blocked by: 07, 08

## What

The first end-to-end slice: a Table creates a Game, and Players join it from their phones and pick Seats.

## Acceptance criteria

- [ ] "Host a Table" creates a Game, and `/table` shows the Game Code in large type plus a QR code for `<origin>/play?code=XXXX`.
- [ ] Opening `/table?code=XXXX` reattaches to an existing Game.
- [ ] `/play` asks for the Game Code (pre-filled from `?code=`) and a display name, then shows the Seats so the Player can pick an empty one. Name-taken, Seat-taken and unknown-code errors are shown inline.
- [ ] Seats on the Table fill in live as Players join, and the Table marks which Player is Host.
- [ ] Reloading `/play` resumes the same Player and Seat using the stored token. A Player who left and rejoins from the same phone gets their Chips back and picks an empty Seat.
- [ ] The QR code works on a phone on the same LAN. In development, the Table should use the machine's LAN address rather than `localhost` in the QR link; document how in `PROGRESS.md`.

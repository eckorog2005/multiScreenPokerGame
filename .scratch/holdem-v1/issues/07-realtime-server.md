# 07: Real-time Game server

Status: ready-for-agent
Blocked by: 01, 06

## What

Add `@fastify/websocket` on `/ws` and an in-memory registry of Games (ADR 0001) that connects sockets to the engine.

## Acceptance criteria

- [ ] **Create Game**: the server generates a unique Game Code of 4 uppercase letters with no I or O, and the creating socket becomes a Table view of that Game.
- [ ] **Open Table**: any socket can attach as a Table view using a Game Code. Several Table views per Game are fine, and the Game keeps going with none attached.
- [ ] **Join**: a Player joins with a Game Code, display name and Seat, and receives a secret token. **Resume** with that token reattaches the socket to the same Player, including after a page reload or network drop.
- [ ] After every change, every Table view gets `tableView` and every connected Player Device gets its own `playerView`. Nothing else is broadcast.
- [ ] The server tracks connected/disconnected status for each Player (shown in views), the time each disconnect started (needed for the 60-second Host claim), and whether any screen is connected.
- [ ] Several Games run at once without affecting each other.
- [ ] Integration tests use real WebSocket clients against `buildApp()` to cover create, join, resume after disconnect, wrong token, unknown Game Code, and checks that a Player socket never receives another Player's Hole Cards.

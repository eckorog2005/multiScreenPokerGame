# Progress

Game server for a multi-screen poker game: a shared "table" screen plus each player's phone as their private hand.

## Status

Early scaffold. The server serves a placeholder page and static assets. No game logic yet.

## Done

- [x] 2016-05: Initial CherryPy (Python) skeleton: index page, `/hello`, static files on `/static`.
- [x] 2026-10-12: Ported to Node.js + Fastify 5 (ESM, Node >= 22).
  - `src/app.js` builds the app (`buildApp()`), so tests can use `app.inject()` without opening a port.
  - `src/server.js` starts it on `PORT` (default `9090`, same as before) and `HOST` (default `0.0.0.0`).
  - `index.html` moved into `public/`; `@fastify/static` serves `public/` under `/static/`.
  - Tests use the built-in `node:test` runner (`npm test`).
  - Removed `CardServer.py`, `app.conf`, `server.conf`; `.gitignore` is now set up for Node.

## Next up

- [ ] Real-time transport: add WebSockets (`@fastify/websocket`) so the table and the phones stay in sync.
- [ ] Rooms: create or join a game with a short room code; tell table clients and player clients apart.
- [ ] Card engine: deck, shuffle (crypto RNG), deal. Pure module with unit tests.
- [ ] Texas Hold'em rules: blinds, betting rounds, side pots, hand evaluation, showdown.
- [ ] Table view: community cards, pot, seats, whose turn it is.
- [ ] Player view (mobile): hole cards, chip stack, fold/check/call/raise.
- [ ] Reconnects: a player who drops can rejoin their seat.
- [ ] Linting and formatting (ESLint + Prettier), CI to run the tests.

## Open questions

- Which poker variants to support beyond Hold'em?
- Is state in memory enough, or do games need to survive a restart?
- Frontend: plain HTML/JS, or a framework (e.g. Vite + something)?

## Running

```sh
npm install
npm run dev   # restarts on file changes
npm start
npm test
```

Then open http://localhost:9090.

# Progress

Multi-screen poker game: a shared "table" screen plus each player's phone as their private hand.

## Layout

pnpm workspace (Node >= 22):

- `apps/server`: game server, Node.js + Fastify 5 (ESM), port `9090`.
- `apps/client`: table and player screens, React 19 + Vite + TypeScript, dev server on port `5173`.

## Status

Early scaffold. The server serves a placeholder page and static assets. The client is a blank React app that proxies `/api` and `/ws` to the server in development. No game logic yet.

## Done

- [x] 2016-05: Initial CherryPy (Python) server skeleton; separate Ember CLI 2.5.1 client repo (`multiScreenPokerGameClient`, scaffold only, no app code).
- [x] 2026-10-12: Ported the server to Node.js + Fastify 5 (ESM, Node >= 22).
  - `src/app.js` builds the app (`buildApp()`), so tests can use `app.inject()` without opening a port.
  - `src/server.js` starts it on `PORT` (default `9090`) and `HOST` (default `0.0.0.0`).
  - `@fastify/static` serves `public/` under `/static/`.
  - Tests use the built-in `node:test` runner.
- [x] 2026-10-12: Merged into a monorepo.
  - Server moved to `apps/server`; npm lockfile replaced by a root `pnpm-lock.yaml`.
  - The Ember 2.5 client was dropped (its toolchain doesn't run on current Node, and it had no app code). Its git history stays in the old `multiScreenPokerGameClient` repo.
  - New `apps/client`: Vite + React + TypeScript, Vitest + Testing Library (jsdom), oxlint.
  - Vite dev proxy: `/api` and `/ws` → `SERVER_URL` (default `http://localhost:9090`).

## Next up

- [ ] Real-time transport: `@fastify/websocket` on `/ws`, plus a client hook that connects, reconnects and resyncs state.
- [ ] Shared protocol: a `packages/protocol` workspace package with the message types both apps import.
- [ ] Rooms: create or join a game with a short room code; tell table clients and player clients apart.
- [ ] Card engine: deck, shuffle (crypto RNG), deal. Pure module with unit tests (could live in `packages/` so the client can reuse card types).
- [ ] Texas Hold'em rules: blinds, betting rounds, side pots, hand evaluation, showdown.
- [ ] Client routes: landing (host a table / join a game), `/table`, `/play`.
- [ ] Join flow: enter a room code on the phone and/or scan a QR code shown on the table screen.
- [ ] Table view: community cards, pot, seats, chip stacks, whose turn it is.
- [ ] Player view (mobile first): hole cards, chip stack, fold / check / call / raise with a bet slider.
- [ ] Reconnects: a player who drops can rejoin their seat.
- [ ] Serve the built client from Fastify (`apps/client/dist`) so production is one process on one origin.
- [ ] Card art and styling that works on a TV/laptop for the table and a phone for players.
- [ ] Playwright end-to-end test: one table and two phones in separate browser contexts.
- [ ] Linting for the server (it has none yet; the client uses oxlint) and formatting; CI to run lint, tests and build.
- [ ] Rename the GitHub repo (e.g. `multiScreenPoker`) and archive `multiScreenPokerGameClient`.

## Open questions

- Which poker variants to support beyond Hold'em?
- Is state in memory enough, or do games need to survive a restart?
- Should the server move to TypeScript to share types directly with the client?

## Running

```sh
corepack enable pnpm   # once
pnpm install
pnpm dev     # server on :9090 and client on :5173, both with reload
pnpm test
pnpm build
pnpm lint
```

Then open http://localhost:5173 for the client (or http://localhost:9090 for the server directly).

Run a single app with `pnpm --filter server <script>` or `pnpm --filter client <script>`.

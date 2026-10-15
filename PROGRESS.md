# Progress

Multi-screen poker game: a shared "table" screen plus each player's phone as their private hand.

## Layout

pnpm workspace (Node >= 22.18):

- `apps/server`: game server, TypeScript + Fastify 5 (ESM), port `9090`.
- `apps/client`: table and player screens, React 19 + Vite + TypeScript, dev server on port `5173`.
- `packages/engine` (`@poker/engine`): pure game rules, no I/O.
- `packages/protocol` (`@poker/protocol`): WebSocket message types.

## Status

Early scaffold. The server serves a placeholder page and static assets. The client is a blank React app that proxies `/api` and `/ws` to the server in development. No game logic yet.

## Done

- [x] 2016-05: Initial CherryPy (Python) server skeleton; separate Ember CLI 2.5.1 client repo (scaffold only, no app code; since deleted).
- [x] 2026-10-12: Ported the server to Node.js + Fastify 5 (ESM, Node >= 22).
  - `src/app.js` builds the app (`buildApp()`), so tests can use `app.inject()` without opening a port.
  - `src/server.js` starts it on `PORT` (default `9090`) and `HOST` (default `0.0.0.0`).
  - `@fastify/static` serves `public/` under `/static/`.
  - Tests use the built-in `node:test` runner.
- [x] 2026-10-12: Merged into a monorepo.
  - Server moved to `apps/server`; npm lockfile replaced by a root `pnpm-lock.yaml`.
  - The Ember 2.5 client was dropped (its toolchain doesn't run on current Node, and it had no app code).
  - New `apps/client`: Vite + React + TypeScript, Vitest + Testing Library (jsdom), oxlint.
  - Vite dev proxy: `/api` and `/ws` → `SERVER_URL` (default `http://localhost:9090`).
- [x] 2026-10-15: Converted the server to TypeScript.
  - `dev` and `test` run the `.ts` sources directly with Node's built-in type stripping (Node >= 22.18), so source imports use `.ts` extensions and only erasable syntax is allowed.
  - `build` typechecks `src` and `test`, then emits `src` to `dist/` (rewriting imports to `.js`); `start` runs `dist/server.js`.
  - The server has an oxlint `lint` script, like the client.
- [x] 2026-10-15: Scaffolded `packages/engine` and `packages/protocol`.
  - Both apps import the packages' `.ts` source directly (`exports` points at `src/index.ts`), so Vite and `node --watch` pick up changes with no rebuild, and the server's `dist/` build loads them through Node's type stripping.
  - So package code must use erasable syntax only (no enums, namespaces or parameter properties) and `.ts` extensions on relative imports. Their `build` script only typechecks.
  - Each package uses Vitest and oxlint. The placeholder `name` export and the `workspace-packages` tests in both apps go away once real exports exist.
- [x] 2026-10-15: Engine cards, shuffle and hand evaluation (issue 03).
  - `newDeck()` builds 52 `Card`s (`{ rank, suit }`, ranks `2`–`9`, `T`, `J`, `Q`, `K`, `A`; suits `c`, `d`, `h`, `s`).
  - `shuffle(items, rng?)` is a Fisher–Yates shuffle that returns a new array. `Rng` returns a whole number below a limit; the default `cryptoRng` uses `crypto.getRandomValues` with rejection sampling.
  - `evaluateHand(holeCards, board)` takes the best five of 2 Hole Cards plus 3–5 Board cards and returns a `HandValue` (category, best five cards, a description such as "Two Pair, Kings and Sevens", and a `strength` for comparing). `compareHands(a, b)` returns 1, -1 or 0.
  - Engine tests write cards as strings with the `cards('As Kd')` helper in `src/test-cards.ts`.

## Next up

The v1 plan is now specified in `.scratch/holdem-v1/` (`spec.md`, plus one issue per file under `issues/`). Those issues replace the list below wherever the two differ.

- [ ] Real-time transport: `@fastify/websocket` on `/ws`, plus a client hook that connects, reconnects and resyncs state.
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
- [ ] Formatting; CI to run lint, tests and build.
- [ ] Rename the GitHub repo (e.g. `multiScreenPoker`).

## Open questions

- ~~Which poker variants to support beyond Hold'em?~~ None for now: No-Limit Hold'em only, with no abstractions for other variants.
- ~~Is state in memory enough, or do games need to survive a restart?~~ In memory is enough (see `docs/adr/0001-v1-scope-same-room-play-money.md`).
- ~~Should the server move to TypeScript to share types directly with the client?~~ Yes (done). Message types go in `packages/protocol`, and the rules go in a pure `packages/engine`.

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

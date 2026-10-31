# Progress

Multi-screen poker game: a shared "table" screen plus each player's phone as their private hand.

## Layout

pnpm workspace (Node >= 24):

- `apps/server`: game server, TypeScript + Fastify 5 (ESM), port `9090`.
- `apps/client`: table and player screens, React 19 + Vite + TypeScript, dev server on port `5173`.
- `packages/engine` (`@poker/engine`): pure game rules, no I/O.
- `packages/protocol` (`@poker/protocol`): WebSocket message types.

## Status

The engine (rules, Game, views) and the WebSocket server (create, join, resume, leave, deal) are done. The join flow works end to end: the Table creates a Game and shows its Game Code, QR code and Seats, and Players join from `/play`. The server loop (auto-deal, turn timer, disconnects, Host claim, cleanup) is done; the Player Device can play a Hand (issue 11), the Table shows the Game (issue 12) and the Host has admin controls on their phone (issue 13). In development the client proxies `/api` and `/ws` to the server.

## Done

- [x] 2016-05: Initial CherryPy (Python) server skeleton; separate Ember CLI 2.5.1 client repo (scaffold only, no app code; since deleted).
- [x] 2026-10-12: Ported the server to Node.js + Fastify 5 (ESM, Node >= 22).
  - `src/app.js` builds the app (`buildApp()`), so tests can use `app.inject()` without opening a port.
  - `src/server.js` starts it on `PORT` (default `9090`) and `HOST` (default `0.0.0.0`).
  - `@fastify/static` serves the built client (`apps/client/dist`) at `/`, with SPA fallback.
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
- [x] 2026-10-16: Engine Game-level rules (issue 05), in `packages/engine/src/game.ts`.
  - Pure commands over an immutable `GameState`, each returning the new state or a typed `GameError` (`isGameError`): `join`, `leave`, `removePlayer`, `claimHost`, `setStartingStack`, `setBlinds`, `setTurnTimer`, `setSittingOut`, `rebuy`, `dealHand`, `act`, `foldFor`, plus `standings`.
  - `dealHand` takes an optional `rng`; the first Hand must be dealt by the Host. Chips are written back to Players when a Hand completes.
  - `foldPlayer` in `hand.ts` folds a Player out of turn so a removal can't stall a Hand.
- [x] 2026-10-16: Protocol messages and per-screen views (issue 06).
  - `@poker/protocol` defines `ClientMessage` (intents, incl. `HostCommand`), `ServerMessage`, and the view types. It stays types-only; its own copies of `Card` etc. must stay structurally in sync with the engine.
  - `tableView(game)` and `playerView(game, playerId)` in `packages/engine/src/views.ts` project a `GameState` into those views. Hole Cards appear only for the Player themself, at Showdown (live hands only) or when an uncontested winner shows; the deck is never included. `playerView` throws `RangeError` for an unknown Player, so the server must check first.

- [x] 2026-10-23: Real-time Game server (issue 07).
  - `@fastify/websocket` on `/ws`, wired in `apps/server/src/ws.ts`; the in-memory `Registry` of Games is in `registry.ts`. Messages follow `ClientMessage`/`ServerMessage` in `@poker/protocol`.
  - Handled so far: `create-game`, `open-table`, `join`, `resume`, and `host` → `deal-hand`. Other messages (`action`, `sit-out`, other Host commands, ...) were ignored until issues 10, 11 and 13.
  - After every change each Table view gets `table-view` and each connected Player Device gets its own `player-view`. The server stores each Player's `disconnectedAt` and `hasConnectedScreen(game)` for issue 10's timers.
  - `SeatView` gained `connected`; the engine's `tableView`/`playerView` take an optional `isConnected` predicate (default: everyone connected) that the server supplies.
  - Server tests drive real WebSocket clients (`test/ws-client.ts`) against `buildApp()`.

- [x] 2026-10-23: CI and formatting (issue 15).
  - Prettier (`.prettierrc.json`, single quotes, width 120) formats the whole repo. The reformat commit is listed in `.git-blame-ignore-revs`.
  - `.github/workflows/ci.yml` runs on pushes and PRs to `main`: a "Format and lint" job and a "Build and test" job, both on Node 26 (the Node 22 job was dropped on 2026-10-24, when `engines` moved to Node >= 24; both moved to Node 26 on 2026-10-25, with `engines` at Node >= 26 and `.nvmrc` pinning 26). A newer push to a PR cancels the older run.
  - The shared `.github/actions/setup` action enables pnpm through corepack and caches the pnpm store by lockfile hash.
  - `pnpm check` runs the same steps locally.

- [x] 2026-10-23: Client connection hook and routes (issue 08).
  - `react-router` routes in `apps/client/src/App.tsx`: `/` (landing with "Host a Table" and "Join a Game"), `/table` and `/play`. The two screens are placeholders until issue 09.
  - `useConnection()` in `src/connection/use-connection.ts` opens `/ws` on the page origin and exposes `status` (`connecting`, `open`, `reconnecting`), `code`, `playerId`, the latest `view` and the last server `error` (cleared by the next `send`).
  - `send` returns `false` and drops the message unless the socket is open, so screens send their first intent once `status` is `open`.
  - On a drop it retries after 0.5 s, doubling up to 10 s, and resets after a successful connect. On reconnect it re-sends `resume` (after `joined`) or `open-table` (after `game-created` or an `open-table` send), so screens don't handle resync themselves: a screen sends its first `open-table`/`resume` once, not on every `open`, or the server rejects the second one as "already attached". If that re-sent intent gets `unknown-game` or `unknown-player` (e.g. the server restarted), the hook forgets the Game, clears its token and resets `code`, `playerId` and `view`. It doesn't yet forget anything on `leave` (issue 09).
  - Player tokens are saved per Game Code by `token-store.ts` (`loadToken`, `saveToken`, `clearToken`); every `localStorage` access is wrapped so a blocked storage just means no resume.
  - Hook tests use `FakeWebSocket` (`src/connection/fake-websocket.ts`) via `vi.stubGlobal` plus fake timers.

- [x] 2026-10-23: Join flow (issue 09).
  - `/table` sends `create-game` (or `open-table` with `?code=`) and puts the Game Code in the URL, so a reload reattaches. It shows the Game Code, a QR code (`qrcode.react`) for `<origin>/play?code=XXXX`, and the nine Seats with the Host marked.
  - `/play` asks for the Game Code (pre-filled from `?code=`) and a name, then loads the Seats from `GET /api/games/:code` (`GameSeatsResponse`; 404 for an unknown code). A socket can attach only once, so the phone can't watch the Table view before joining. Name-taken, Seat-taken and unknown-code errors show inline; a seat-taken error reloads the Seats.
  - With a stored token for `?code=`, `/play` sends `resume` instead. If the token is unknown, it falls back to the join form.
  - New `take-seat` message (engine `takeSeat`): a joined Player with no Seat (after `leave`) picks an empty one and keeps their Chips. Typing the Game Code on bare `/play` also resumes when a token is stored for it. The server now handles `leave` and `take-seat`. The hook keeps the token after leaving, since rejoining from the same phone needs it.
  - The Player Device shows a minimal seated screen with a Leave button until issue 11.

- [x] 2026-10-24: Game loop: auto-deal, turn timer, disconnects, cleanup (issue 10).
  - `apps/server/src/loop.ts` keeps four `Timer`s per Game (turn, deal, host claim, cleanup). After every change the server calls `loop.changed(game)`, which re-arms them for the new state and then broadcasts. Timers use an injectable `Clock` (`clock.ts`; `buildApp(opts, { clock, autoDealDelayMs })`), and tests drive a `FakeClock`.
  - After the first Hand, each Hand deals itself 5 s after the pot is awarded unless the Host paused (`set-paused`) or fewer than two connected Players with Chips aren't Sitting Out. Every deal first sets still-disconnected Players to Sitting Out; reconnecting doesn't undo it.
  - With the turn timer on, a timed-out Player checks if they can and otherwise folds. With it off, a disconnected Player's turn waits and the Host can `fold-for` them (refused with `cannot-fold-for` if they're connected).
  - `claim-host` works once the Host has been disconnected for 60 s (`cannot-claim-host` before). A Game with no connected screens for 30 minutes is discarded.
  - Views gained `paused`, `hand.turnTimeLeftMs` (time left when the view was sent), `you.canFoldFor` and `you.canClaimHost`. The engine's `tableView`/`playerView` now take a `ViewContext` instead of a bare `isConnected`.
  - The server also handles `action` and `set-turn-timer` now.

- [x] 2026-10-24: Player Device play screen (issue 11).
  - Once seated, `/play` renders `src/play/Seated.tsx`: Chips, the amount to call, a compact Board and pot, Hole Cards that show only while held (`HoleCards.tsx`), and only the legal actions from the view.
  - Bet controls: Min, ½ pot, Pot and All-in presets plus a slider with ±1 big blind steps; `src/play/bet.ts` holds the math (whole Chips, clamped to `minRaiseTo`/`maxRaiseTo`, pot raise = `currentBet + pot + toCall`).
  - On the Player's turn the phone vibrates and the screen switches to a full-screen "Your turn" state. `useWakeLock()` keeps the screen awake while the Player is in a Game and re-requests the lock when the page is visible again.
  - Sit Out toggle, Leave (enabled between Hands or after folding), Rebuy (at 0 Chips between Hands), Show cards (after winning uncontested) and a reconnecting banner. The server now handles `sit-out` and `rebuy`.
  - Cards render through `src/CardFace.tsx`; client tests share view builders in `src/test-views.ts`.

- [x] 2026-10-29: Table view (issue 12).
  - `/table` renders `src/table/TableTop.tsx`: Seats around an oval (name, Chips, bet, Sitting Out / Disconnected / Folded / All-in, button and blind markers), the Board, the pot or main and side pots, and the Player to act highlighted with a local countdown of `hand.turnTimeLeftMs`. The Game Code and QR code stay in a corner.
  - Showdown shows revealed cards and hand descriptions on the Seats and each pot's winners. Between Hands it says "Paused by Host", "Waiting for players" or, before the first Hand, "Waiting for the Host to deal".
  - Views gained `SeatView.blind`, `HandView.pots` (`PotInPlayView`, cut at each live all-in) and `ended` (from `ViewContext.ended`). When `ended` is set, the Table shows the Standings sorted by net result; the server sets it once issue 13 adds end-game.

- [x] 2026-10-29: Host controls (issue 13).
  - The Host's phone shows a Host panel (`src/play/HostControls.tsx`). Before the first Hand it has a settings form (starting stack, blinds, turn timer with blank meaning off) whose Deal button sends `set-starting-stack`, `set-blinds`, `set-turn-timer` and `deal-hand` in that order. Between Hands it has Pause/Resume dealing and a blinds form. It also has Fold for <name> (when `you.canFoldFor`), Make <name> Host, Remove <name> and End Game; Remove and End Game ask for confirmation inline. Any Player sees Claim Host when `you.canClaimHost`.
  - New engine command `transferHost` and Host command `transfer-host`. The server now handles every `HostCommand`; an unknown one is still `bad-message`.
  - Removal deletes the server's Player, sends that phone a `removed` error and closes its socket. The connection hook forgets the Game on `removed` (as on `unknown-player`), so the phone goes back to the join form and rejoining makes a new Player.
  - `end-game` sets `ServerGame.ended` (reaching views as `ended`): the turn, deal and host-claim timers stop, and every Player intent and `join` gets `game-ended`. `open-table` and `resume` still work, so the Table keeps showing the Standings until the Game is discarded as idle. A Hand in progress is abandoned, so Standings use the Chips from the last finished Hand. The phone shows "The Game has ended" with the Player's own net result.
  - Server tests share their helpers through `test/helpers.ts`; Host tests are in `test/host.test.ts`.

## Next up

The v1 plan is now specified in `.scratch/holdem-v1/` (`spec.md`, plus one issue per file under `issues/`). Those issues replace the list below wherever the two differ.

- [ ] Real-time transport: `@fastify/websocket` on `/ws`, plus a client hook that connects, reconnects and resyncs state.
- [ ] Rooms: create or join a game with a short room code; tell table clients and player clients apart.
- [x] Card engine: deck, shuffle (crypto RNG). Dealing comes with the Hand state machine (issue 04).
- [ ] Texas Hold'em rules: blinds, betting rounds, side pots, hand evaluation, showdown.
- [x] Client routes: landing (host a table / join a game), `/table`, `/play`.
- [x] Join flow: enter a room code on the phone and/or scan a QR code shown on the table screen.
- [ ] Table view: community cards, pot, seats, chip stacks, whose turn it is.
- [ ] Player view (mobile first): hole cards, chip stack, fold / check / call / raise with a bet slider.
- [ ] Reconnects: a player who drops can rejoin their seat.
- [x] Serve the built client from Fastify (`apps/client/dist`) so production is one process on one origin.
- [ ] Card art and styling that works on a TV/laptop for the table and a phone for players.
- [ ] Playwright end-to-end test: one table and two phones in separate browser contexts.
- [x] Formatting; CI to run lint, tests and build.
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
pnpm format  # Prettier, writes changes
pnpm check   # what CI runs: format check, lint, build, test
```

Then open http://localhost:5173 for the client.

In production it is one process on one origin:

```sh
pnpm build
pnpm --filter server start   # serves the client, /api and /ws on :9090 (PORT, HOST)
```

To join from a phone in development, put the phone on the same Wi-Fi as your machine. The Vite dev server listens on all interfaces, and when the Table runs on `localhost` the QR link uses your machine's first non-internal IPv4 address instead (e.g. `http://192.168.1.20:5173/play?code=ABCD`). If it picks the wrong interface, set it yourself: `LAN_HOST=192.168.1.20 pnpm dev`. Your firewall must allow incoming connections on port 5173.

Run a single app with `pnpm --filter server <script>` or `pnpm --filter client <script>`.

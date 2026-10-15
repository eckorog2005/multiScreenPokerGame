# 01: Convert the server to TypeScript

Status: resolved
Blocked by: none

## What

Convert `apps/server` from JavaScript to TypeScript before any game logic is written, so it can import `packages/protocol` and `packages/engine` (see `PROGRESS.md` open questions).

## Acceptance criteria

- [x] `src/app.ts` and `src/server.ts` replace the `.js` files, and their behavior is unchanged (`buildApp()`, `PORT`/`HOST` env vars, `/static/`, `/`, `/hello`).
- [x] `pnpm --filter server dev` runs with reload, `build` emits runnable JS to `dist/`, and `start` runs the built output.
- [x] The existing tests are ported to TypeScript and pass under `pnpm --filter server test`.
- [x] The server has a `lint` script using oxlint, matching the client's setup.
- [x] `pnpm test`, `pnpm build` and `pnpm lint` pass from the repo root.

## Comments

- 2026-10-15: Done. `dev`/`test` use Node's native type stripping (no `tsx`), so relative imports in server sources use `.ts` extensions; `tsc` rewrites them to `.js` in `dist/`. Root and server `engines` raised to Node >= 22.18 for unflagged type stripping.
- Note for 02: if the server imports `packages/*` as `.ts` source, those packages must use erasable syntax only (no enums, namespaces or parameter properties), and `start` (which runs `dist/`) would still load their `.ts` at runtime, so either keep that working or have the packages emit JS.

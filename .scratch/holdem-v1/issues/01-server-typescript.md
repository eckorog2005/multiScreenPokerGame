# 01: Convert the server to TypeScript

Status: ready-for-agent
Blocked by: none

## What

Convert `apps/server` from JavaScript to TypeScript before any game logic is written, so it can import `packages/protocol` and `packages/engine` (see `PROGRESS.md` open questions).

## Acceptance criteria

- [ ] `src/app.ts` and `src/server.ts` replace the `.js` files, and their behavior is unchanged (`buildApp()`, `PORT`/`HOST` env vars, `/static/`, `/`, `/hello`).
- [ ] `pnpm --filter server dev` runs with reload, `build` emits runnable JS to `dist/`, and `start` runs the built output.
- [ ] The existing tests are ported to TypeScript and pass under `pnpm --filter server test`.
- [ ] The server has a `lint` script using oxlint, matching the client's setup.
- [ ] `pnpm test`, `pnpm build` and `pnpm lint` pass from the repo root.

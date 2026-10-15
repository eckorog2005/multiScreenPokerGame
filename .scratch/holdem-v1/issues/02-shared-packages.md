# 02: Scaffold `packages/engine` and `packages/protocol`

Status: resolved
Blocked by: none

## What

Add `packages/*` to the pnpm workspace and create two empty TypeScript packages:

- `packages/engine`: pure game rules with no I/O and no Node- or browser-only APIs beyond `crypto.getRandomValues`.
- `packages/protocol`: WebSocket message types shared by the server and client.

## Acceptance criteria

- [x] `pnpm-workspace.yaml` includes `packages/*`.
- [x] Each package has `build`, `test` (Vitest) and `lint` (oxlint) scripts, plus one passing placeholder test.
- [x] `apps/client` can import from both packages, and the Vite dev server picks up changes without a manual rebuild.
- [x] `pnpm test`, `pnpm build` and `pnpm lint` pass from the repo root.

## Notes

`apps/server` imports these packages once issue 01 lands. Whether packages are consumed as source or through built output is the implementer's call, as long as dev reload works in both apps.

## Comments

- 2026-10-15: Done. Packages are `@poker/engine` and `@poker/protocol`, consumed as `.ts` source by both apps (`exports` → `src/index.ts`); `build` is a typecheck. Checked by hand: Vite reloads on package edits, `node --watch` restarts on them, and the server's `dist/` build loads them at runtime. Each package exports a placeholder `name`, covered by a `workspace-packages` test in each app; replace or delete those when 03/06 add real exports. The engine typechecks with no DOM or Node types; `src/globals.d.ts` declares only `crypto.getRandomValues`.

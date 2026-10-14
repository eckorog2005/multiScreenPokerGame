# 02: Scaffold `packages/engine` and `packages/protocol`

Status: ready-for-agent
Blocked by: none

## What

Add `packages/*` to the pnpm workspace and create two empty TypeScript packages:

- `packages/engine`: pure game rules with no I/O and no Node- or browser-only APIs beyond `crypto.getRandomValues`.
- `packages/protocol`: WebSocket message types shared by the server and client.

## Acceptance criteria

- [ ] `pnpm-workspace.yaml` includes `packages/*`.
- [ ] Each package has `build`, `test` (Vitest) and `lint` (oxlint) scripts, plus one passing placeholder test.
- [ ] `apps/client` can import from both packages, and the Vite dev server picks up changes without a manual rebuild.
- [ ] `pnpm test`, `pnpm build` and `pnpm lint` pass from the repo root.

## Notes

`apps/server` imports these packages once issue 01 lands. Whether packages are consumed as source or through built output is the implementer's call, as long as dev reload works in both apps.

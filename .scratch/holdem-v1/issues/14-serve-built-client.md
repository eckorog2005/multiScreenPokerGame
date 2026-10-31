# 14: Serve the built client from Fastify

Status: resolved
Blocked by: 01

## What

In production, run a single process on a single origin: Fastify serves `apps/client/dist` alongside `/ws` and `/api`.

## Acceptance criteria

- [x] After `pnpm build`, `pnpm --filter server start` serves the client at `/`, with SPA fallback for `/table` and `/play` (including query strings).
- [x] `/ws` and any `/api` routes still take priority over the client files.
- [x] The placeholder `apps/server/public/index.html` and the `/hello` route are removed, along with `/static/` if nothing uses it.
- [x] A server test checks that a client route returns the SPA's `index.html`.
- [x] `PROGRESS.md` documents how to run in production.

# 14: Serve the built client from Fastify

Status: ready-for-agent
Blocked by: 01

## What

In production, run a single process on a single origin: Fastify serves `apps/client/dist` alongside `/ws` and `/api`.

## Acceptance criteria

- [ ] After `pnpm build`, `pnpm --filter server start` serves the client at `/`, with SPA fallback for `/table` and `/play` (including query strings).
- [ ] `/ws` and any `/api` routes still take priority over the client files.
- [ ] The placeholder `apps/server/public/index.html` and the `/hello` route are removed, along with `/static/` if nothing uses it.
- [ ] A server test checks that a client route returns the SPA's `index.html`.
- [ ] `PROGRESS.md` documents how to run in production.

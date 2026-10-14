# 08: Client connection hook and routes

Status: ready-for-agent
Blocked by: 06

## What

Client-side setup that every screen builds on.

## Acceptance criteria

- [ ] There's a client router with routes `/` (landing page with "Host a Table" and "Join a Game"), `/table` and `/play`.
- [ ] A connection hook connects to `/ws`, sends typed intents from `packages/protocol`, exposes the latest view snapshot and connection status, and reconnects automatically with backoff. After reconnecting, it re-sends the resume intent so state resyncs.
- [ ] The Player token is stored per Game Code in `localStorage`. Every access is wrapped so the app still works when storage is unavailable (the Player just can't resume).
- [ ] Hook tests use a fake WebSocket and cover connecting, receiving a snapshot, dropping and reconnecting with resume, and server errors.

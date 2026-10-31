# 01: Host adds and removes a Bot

**What to build:** Between Hands (lobby included), the Host taps "Add Bot" on their Player Device. A Bot takes the lowest free Seat with a unique auto name ("Bot Ada", "Bot Ben", ...) and joins from the next Hand. The Table shows it with a "Bot" tag. The Host can remove it. The Bot does not act yet.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Only the Host sees and can use Add Bot / Remove Bot; others get `not-host`.
- [ ] Adding a Bot with no free Seat returns an error.
- [ ] Bot names are unique within the Game.
- [ ] A Bot is never Host, including when the Host leaves, is removed or is claimed.
- [ ] The Table shows a "Bot" tag on the Seat.
- [ ] No view ever exposes a Bot's Hole Cards beyond what Players already see (ADR 0002).

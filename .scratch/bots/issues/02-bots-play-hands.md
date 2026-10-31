# 02: Bots play Hands

**What to build:** A Game with one human and one Bot deals and plays Hands automatically. The Bot uses one fixed, simple strategy built on hand strength: check/call medium hands, raise strong ones, fold weak hands to big bets. No bluffing, no difficulty levels.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] A Bot acts after a fixed ~1.5s delay; the turn timer does not apply to it.
- [ ] A Bot only takes legal actions and never acts out of turn.
- [ ] Bots never use the optional `show` action.
- [ ] Bots count as always connected and are never Sat Out; the Host cannot Sit One Out.
- [ ] Auto-deal needs at least 2 connected Players, at least one of them human; if every human disconnects, dealing stops until one returns.
- [ ] The strategy has unit tests for fold, call and raise outcomes.

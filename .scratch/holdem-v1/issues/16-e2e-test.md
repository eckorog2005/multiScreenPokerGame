# 16: End-to-end test with one Table and two phones

Status: ready-for-agent
Blocked by: 12, 13, 14

## What

A Playwright test that drives a whole Game in separate browser contexts: one Table and two Player Devices with a mobile viewport.

## Acceptance criteria

- [ ] The Table creates a Game, and two Players join using the Game Code and pick Seats.
- [ ] The Host deals, and the Players play a Hand through to Showdown. The Table shows the winner and the pot is awarded.
- [ ] One Player's page reloads mid-Hand and resumes into the same Seat with the same Hole Cards.
- [ ] Throughout the test, the Table's page and the other Player's page never contain a Player's Hole Cards before Showdown.
- [ ] The test uses a seeded shuffle (via a test-only server option) so card outcomes are deterministic.
- [ ] It runs locally with one command and in CI (issue 15).

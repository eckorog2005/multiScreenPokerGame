# v1 scope: same room, play money, no accounts, in-memory

v1 assumes every Player is in the same physical room as one Table screen, so there's no chat, no remote view of the Table and no spectators. Chips are play money only, with no ledger and no settle-up. Players have no accounts: they pick a display name, and a token stored on the Player Device lets them reclaim their Seat. All Game state lives in server memory, so a restart ends every Game in progress.

We chose this to ship a playable party game without authentication, a database or real-money concerns. Remote play, persistence or accounts would each reopen this decision.

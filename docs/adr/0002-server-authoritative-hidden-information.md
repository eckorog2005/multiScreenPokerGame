# Server is authoritative; screens only receive what they may see

The server shuffles, deals and enforces every rule. Each Player Device is sent only its own Hole Cards, and the Table is sent no Hole Cards until Showdown (or an all-in runout). Clients send intents ("raise to 120") and render whatever state the server sends back. They never compute game outcomes.

We considered broadcasting the full state and hiding cards in the UI. It's simpler, but anyone with browser dev tools could read every Player's cards, and adding per-screen filtering later would mean reshaping every message.

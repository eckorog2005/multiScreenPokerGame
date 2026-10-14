# Multi-Screen Poker

No-Limit Texas Hold'em for people in the same room: one shared screen shows the game, and each player plays from their own phone.

## Language

### Games

**Game**:
A poker session created by a Table that Players join; it runs many Hands until it's closed.
_Avoid_: Room, session, lobby, table (for the session)

**Game Code**:
The short code shown on the Table that Players enter on their Player Device to join that Game.
_Avoid_: Room code, PIN

**Standings**:
Each Player's net result when a Game ends: their Chips minus their starting stack and all Rebuys.
_Avoid_: Leaderboard, results, score

### Screens

**Table**:
The shared screen (TV or laptop) everyone in the room looks at; it shows the Board, pot, Seats and whose turn it is, but never anyone's Hole Cards.
_Avoid_: Board (for the screen), host screen, main screen

**Player Device**:
A player's own phone, showing their Hole Cards and their betting controls.
_Avoid_: Client, controller, hand (for the device)

### People

**Player**:
A person in a Game, identified by their Player Device and a display name; leaving frees their Seat but keeps the Player and their Chips in the Game until they return.
_Avoid_: User, account

**Host**:
The Player with admin controls (game settings, starting play, removing Players); initially the first Player to join, and transferable.
_Avoid_: Admin, owner, dealer

**Seat**:
One of up to nine positions at the Table; a Player picks one when joining and keeps it until they leave.
_Avoid_: Slot, position (reserved for betting order)

**Sitting Out**:
A Player who keeps their Seat and Chips but isn't dealt into Hands, and owes no missed blinds when they return.
_Avoid_: Away, paused, inactive

**Rebuy**:
A Player with no Chips taking a fresh starting stack between Hands.
_Avoid_: Top-up, reload, buy-back

### Cards and play

**Hand**:
One round of play, from the shuffle until the pot is awarded.
_Avoid_: Round, deal (for the whole round)

**Hole Cards**:
The two private cards dealt to a Player in a Hand.
_Avoid_: Hand (for the cards), pocket

**Board**:
The up-to-five community cards shared by all Players (flop, turn, river).
_Avoid_: Community (alone), Table (for the cards)

**Showdown**:
The end of a Hand with two or more Players left, when every hand still in the pot is revealed on the Table and the best one wins.
_Avoid_: Reveal

**Chips**:
Play-money units Players bet with; they have no real-money value.
_Avoid_: Money, credits

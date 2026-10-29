import { test } from 'node:test';
import assert from 'node:assert/strict';
import { connect } from './ws-client.ts';
import { dealt, foldOut, game, playerViewWhere, settle, start, tableViews, tableViewWhere } from './helpers.ts';

test('before the first Hand the Host sets the starting stack, blinds and turn timer, then deals', async (t) => {
  const { url } = await start(t);
  const { table, players } = await game(url, 'Ann', 'Bob');
  const [ann] = players;

  ann!.client.send({ type: 'host', command: { type: 'set-starting-stack', amount: 500 } });
  ann!.client.send({ type: 'host', command: { type: 'set-blinds', smallBlind: 10, bigBlind: 20 } });
  ann!.client.send({ type: 'host', command: { type: 'set-turn-timer', seconds: 20 } });
  ann!.client.send({ type: 'host', command: { type: 'deal-hand' } });

  const view = await tableViewWhere(table, dealt);
  assert.deepEqual([view.startingStack, view.smallBlind, view.bigBlind, view.turnTimerSeconds], [500, 10, 20, 20]);
  assert.equal(view.hand!.pot, 30);
  assert.equal(
    view.seats.reduce((sum, s) => sum + s.chips + s.bet, 0),
    1000,
  );
});

test('blinds changed between Hands apply from the next Hand', async (t) => {
  const { url, clock } = await start(t);
  const { table, players } = await game(url, 'Ann', 'Bob');
  const [ann] = players;
  ann!.client.send({ type: 'host', command: { type: 'deal-hand' } });
  const first = await tableViewWhere(table, dealt);

  ann!.client.send({ type: 'host', command: { type: 'set-blinds', smallBlind: 25, bigBlind: 50 } });
  assert.equal((await ann!.client.nextOfType('error')).error, 'hand-in-progress');

  await foldOut(table, players, ann!, first);
  ann!.client.send({ type: 'host', command: { type: 'set-blinds', smallBlind: 25, bigBlind: 50 } });
  await tableViewWhere(table, (v) => v.bigBlind === 50);
  clock.advance(5_000);
  assert.equal((await tableViewWhere(table, dealt)).hand!.pot, 75);
});

test('the Host removes a Player, whose phone is told and disconnected', async (t) => {
  const { url } = await start(t);
  const { table, players } = await game(url, 'Ann', 'Bob', 'Cat');
  const [ann, bob] = players;

  ann!.client.send({ type: 'host', command: { type: 'remove-player', playerId: bob!.playerId } });

  assert.equal((await bob!.client.nextOfType('error')).error, 'removed');
  await bob!.client.closed;
  const view = await tableViewWhere(table, (v) => v.seats.length === 2);
  assert.deepEqual(
    view.standings.map((s) => [s.name, s.removed]),
    [
      ['Ann', false],
      ['Cat', false],
      ['Bob', true],
    ],
  );
});

test('only the Host can remove a Player', async (t) => {
  const { url } = await start(t);
  const { players } = await game(url, 'Ann', 'Bob');
  const [ann, bob] = players;

  bob!.client.send({ type: 'host', command: { type: 'remove-player', playerId: ann!.playerId } });

  assert.equal((await bob!.client.nextOfType('error')).error, 'not-host');
});

test('the Host hands the role to another Player', async (t) => {
  const { url } = await start(t);
  const { players } = await game(url, 'Ann', 'Bob');
  const [ann, bob] = players;

  ann!.client.send({ type: 'host', command: { type: 'transfer-host', playerId: bob!.playerId } });

  const view = await playerViewWhere(bob!.client, (v) => v.you.isHost);
  assert.equal(view.hostId, bob!.playerId);
  ann!.client.send({ type: 'host', command: { type: 'deal-hand' } });
  assert.equal((await ann!.client.nextOfType('error')).error, 'not-host');
});

test('the Host ends the Game: the Table shows the Standings and nothing more is dealt or timed', async (t) => {
  const { url, clock } = await start(t);
  const { table, players } = await game(url, 'Ann', 'Bob');
  const [ann, bob] = players;
  ann!.client.send({ type: 'host', command: { type: 'set-turn-timer', seconds: 30 } });
  ann!.client.send({ type: 'host', command: { type: 'deal-hand' } });
  await tableViewWhere(table, dealt);

  bob!.client.send({ type: 'host', command: { type: 'end-game' } });
  assert.equal((await bob!.client.nextOfType('error')).error, 'not-host');
  ann!.client.send({ type: 'host', command: { type: 'end-game' } });

  const ended = await tableViewWhere(table, (v) => v.ended);
  assert.deepEqual(
    ended.standings.map((s) => [s.name, s.net]),
    [
      ['Ann', 0],
      ['Bob', 0],
    ],
  );
  clock.advance(10 * 60_000);
  assert.deepEqual(tableViews(await settle(table)), []);
});

test('an ended Game refuses play and joins but can still be watched', async (t) => {
  const { url } = await start(t);
  const { code, players } = await game(url, 'Ann', 'Bob');
  const [ann, bob] = players;
  ann!.client.send({ type: 'host', command: { type: 'end-game' } });
  await playerViewWhere(bob!.client, (v) => v.ended);

  bob!.client.send({ type: 'sit-out', sittingOut: true });
  assert.equal((await bob!.client.nextOfType('error')).error, 'game-ended');
  const late = await connect(url);
  late.send({ type: 'join', code, name: 'Cat', seat: 3 });
  assert.equal((await late.nextOfType('error')).error, 'game-ended');
  const watcher = await connect(url);
  watcher.send({ type: 'open-table', code });
  assert.equal((await watcher.nextOfType('table-view')).view.ended, true);
});

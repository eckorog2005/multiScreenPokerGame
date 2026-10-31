import { test } from 'node:test';
import assert from 'node:assert/strict';
import { connect, type TestClient } from './ws-client.ts';
import type { FakeClock } from './fake-clock.ts';
import {
  complete,
  dealt,
  foldOut,
  game,
  playerViewWhere,
  type Seated,
  settle,
  start,
  tableViews,
  tableViewWhere,
  until,
} from './helpers.ts';

test('auto-deals each later Hand 5 seconds after the pot is awarded', async (t) => {
  const { url, clock } = await start(t);
  const { table, players } = await game(url, 'Ann', 'Bob');
  const [ann] = players;

  clock.advance(60_000);
  assert.deepEqual(tableViews(await settle(table)), [], 'the Host deals the first Hand');

  ann!.client.send({ type: 'host', command: { type: 'deal-hand' } });
  await foldOut(table, players, ann!, await tableViewWhere(table, dealt));

  clock.advance(4_999);
  assert.deepEqual(tableViews(await settle(table)), []);
  clock.advance(1);
  await tableViewWhere(table, dealt);
});

test('does not auto-deal while the Host has paused', async (t) => {
  const { url, clock } = await start(t);
  const { table, players } = await game(url, 'Ann', 'Bob');
  const [ann, bob] = players;
  ann!.client.send({ type: 'host', command: { type: 'deal-hand' } });
  await foldOut(table, players, ann!, await tableViewWhere(table, dealt));

  ann!.client.send({ type: 'host', command: { type: 'set-paused', paused: true } });
  await tableViewWhere(table, (v) => v.paused);
  clock.advance(60_000);
  assert.deepEqual(tableViews(await settle(table)), []);

  bob!.client.send({ type: 'host', command: { type: 'set-paused', paused: false } });
  assert.equal((await bob!.client.nextOfType('error')).error, 'not-host');
  ann!.client.send({ type: 'host', command: { type: 'set-paused', paused: false } });
  await tableViewWhere(table, (v) => !v.paused);
  clock.advance(5_000);
  await tableViewWhere(table, dealt);
});

test('a Player still disconnected at the next deal Sits Out, and stays Sitting Out on return', async (t) => {
  const { url, clock } = await start(t);
  const { table, code, players } = await game(url, 'Ann', 'Bob', 'Cat');
  const [ann, , cat] = players;
  ann!.client.send({ type: 'host', command: { type: 'deal-hand' } });
  await tableViewWhere(table, dealt);

  await cat!.client.close();
  await foldOut(table, players, ann!, await tableViewWhere(table, (v) => !v.seats[2]!.connected));
  clock.advance(5_000);

  const next = await tableViewWhere(table, dealt);
  assert.deepEqual(
    next.seats.map((s) => [s.name, s.sittingOut, s.inHand]),
    [
      ['Ann', false, true],
      ['Bob', false, true],
      ['Cat', true, false],
    ],
  );

  const back = await connect(url);
  back.send({ type: 'resume', code, token: cat!.token });
  const view = await playerViewWhere(back, () => true);
  assert.equal(view.you.sittingOut, true);
});

test('waits for enough connected Players before auto-dealing', async (t) => {
  const { url, clock } = await start(t);
  const { table, code, players } = await game(url, 'Ann', 'Bob');
  const [ann, bob] = players;
  ann!.client.send({ type: 'host', command: { type: 'deal-hand' } });
  await tableViewWhere(table, dealt);
  await bob!.client.close();
  await foldOut(table, players, ann!, await tableViewWhere(table, (v) => !v.seats[1]!.connected));

  clock.advance(60_000);
  assert.deepEqual(tableViews(await settle(table)), []);

  const back = await connect(url);
  back.send({ type: 'resume', code, token: bob!.token });
  await tableViewWhere(table, (v) => v.seats.every((s) => s.connected));
  clock.advance(5_000);
  const next = await tableViewWhere(table, dealt);
  assert.ok(next.seats.every((s) => s.inHand && !s.sittingOut));
});

test('the turn timer checks when it can and shows the time left', async (t) => {
  const { url, clock } = await start(t);
  const { table, players } = await game(url, 'Ann', 'Bob');
  const [ann] = players;
  ann!.client.send({ type: 'host', command: { type: 'set-turn-timer', seconds: 30 } });
  ann!.client.send({ type: 'host', command: { type: 'deal-hand' } });
  const first = await tableViewWhere(table, dealt);
  assert.equal(first.hand!.turnTimeLeftMs, 30_000);

  players.find((p) => p.playerId === first.hand!.toAct)!.client.send({ type: 'action', action: { type: 'call' } });
  const option = await tableViewWhere(table, (v) => v.hand!.toAct !== first.hand!.toAct);
  assert.equal(option.hand!.turnTimeLeftMs, 30_000);

  clock.advance(29_999);
  assert.deepEqual(tableViews(await settle(table)), []);
  clock.advance(1);
  const flop = await tableViewWhere(table, () => true);
  assert.equal(flop.hand!.street, 'flop');
  assert.equal(flop.hand!.turnTimeLeftMs, 30_000);
});

test('the turn timer folds when checking is not allowed', async (t) => {
  const { url, clock } = await start(t);
  const { table, players } = await game(url, 'Ann', 'Bob');
  const [ann] = players;
  ann!.client.send({ type: 'host', command: { type: 'set-turn-timer', seconds: 30 } });
  ann!.client.send({ type: 'host', command: { type: 'deal-hand' } });
  const first = await tableViewWhere(table, dealt);

  clock.advance(30_000);
  const done = await tableViewWhere(table, () => true);
  assert.equal(done.hand!.street, 'complete');
  assert.equal(done.seats.find((s) => s.playerId === first.hand!.toAct)!.folded, true);
});

test("on a disconnected Player's turn the Game waits and the Host can fold for them", async (t) => {
  const { url, clock } = await start(t);
  const { table, players } = await game(url, 'Ann', 'Bob');
  const [ann, bob] = players;
  ann!.client.send({ type: 'host', command: { type: 'deal-hand' } });
  const first = await tableViewWhere(table, dealt);
  if (first.hand!.toAct === ann!.playerId) {
    ann!.client.send({ type: 'action', action: { type: 'call' } });
    await tableViewWhere(table, (v) => v.hand!.toAct === bob!.playerId);
  }
  await settle(ann!.client);

  ann!.client.send({ type: 'host', command: { type: 'fold-for' } });
  assert.equal((await ann!.client.nextOfType('error')).error, 'cannot-fold-for');

  await bob!.client.close();
  const hostView = await playerViewWhere(ann!.client, (v) => v.you.canFoldFor);
  assert.equal(hostView.hand!.toAct, bob!.playerId);
  await settle(table);
  clock.advance(10 * 60_000);
  assert.deepEqual(tableViews(await settle(table)), []);

  ann!.client.send({ type: 'host', command: { type: 'fold-for' } });
  const done = await tableViewWhere(table, complete);
  assert.equal(done.seats.find((s) => s.playerId === bob!.playerId)!.folded, true);
});

test('Host can be claimed only after the Host is disconnected for 60 seconds', async (t) => {
  const { url, clock } = await start(t);
  const { players } = await game(url, 'Ann', 'Bob');
  const [ann, bob] = players;

  await ann!.client.close();
  await playerViewWhere(bob!.client, (v) => !v.seats[0]!.connected);
  bob!.client.send({ type: 'claim-host' });
  assert.equal((await bob!.client.nextOfType('error')).error, 'cannot-claim-host');

  clock.advance(59_999);
  bob!.client.send({ type: 'claim-host' });
  assert.equal((await bob!.client.nextOfType('error')).error, 'cannot-claim-host');

  clock.advance(1);
  await playerViewWhere(bob!.client, (v) => v.you.canClaimHost);
  bob!.client.send({ type: 'claim-host' });
  const view = await playerViewWhere(bob!.client, (v) => v.you.isHost);
  assert.equal(view.you.canClaimHost, false);
});

test('a Game with no connected screens for 30 minutes is discarded', async (t) => {
  const { app, url, clock } = await start(t);
  const { table, code } = await game(url);
  const exists = async () => (await app.inject(`/api/games/${code}`)).statusCode === 200;

  await table.close();
  await until(() => clock.pending > 0);
  clock.advance(29 * 60_000);
  const again = await connect(url);
  again.send({ type: 'open-table', code });
  await again.nextOfType('table-view');
  clock.advance(2 * 60_000);
  assert.equal(await exists(), true, 'reattaching a screen restarts the wait');

  await again.close();
  await until(() => clock.pending > 0);
  clock.advance(30 * 60_000 - 1);
  assert.equal(await exists(), true);
  clock.advance(1);
  assert.equal(await exists(), false);
});

async function humanVsBot(t: Parameters<typeof start>[0]) {
  const { url, clock } = await start(t);
  const { table, players } = await game(url, 'Ann');
  const [ann] = players;
  ann!.client.send({ type: 'host', command: { type: 'add-bot' } });
  await tableViewWhere(table, (v) => v.seats.some((s) => s.bot));
  ann!.client.send({ type: 'host', command: { type: 'deal-hand' } });
  return { table, clock, ann: ann! };
}

test('a Bot acts 1.5 seconds after its turn comes', async (t) => {
  const { table, clock, ann } = await humanVsBot(t);
  let view = await tableViewWhere(table, dealt);
  if (view.hand!.toAct === ann.playerId) {
    ann.client.send({ type: 'action', action: { type: 'call' } });
    view = await tableViewWhere(table, (v) => v.hand!.toAct !== ann.playerId);
  }
  clock.advance(1_499);
  assert.deepEqual(tableViews(await settle(table)), []);
  clock.advance(1);
  await tableViewWhere(table, (v) => v.hand!.toAct !== view.hand!.toAct || complete(v));
});

async function playOut(table: TestClient, clock: FakeClock, ann: Seated) {
  for (let view = await tableViewWhere(table, dealt); !complete(view);) {
    if (view.hand!.toAct === ann.playerId) {
      ann.client.send({ type: 'action', action: { type: 'fold' } });
    } else {
      clock.advance(1_500);
    }
    view = await tableViewWhere(table, () => true);
  }
}

test('a Game with one human and one Bot keeps dealing', async (t) => {
  const { table, clock, ann } = await humanVsBot(t);
  await playOut(table, clock, ann);
  clock.advance(5_000);
  await tableViewWhere(table, dealt);
});

test('auto-deal waits when no human is connected', async (t) => {
  const { table, clock, ann } = await humanVsBot(t);
  await playOut(table, clock, ann);
  await ann.client.close();
  await tableViewWhere(table, (v) => !v.seats.find((s) => s.playerId === ann.playerId)!.connected);
  clock.advance(60_000);
  assert.deepEqual(
    tableViews(await settle(table)).filter((m) => dealt(m.view)),
    [],
  );
});

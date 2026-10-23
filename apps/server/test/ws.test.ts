import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.ts';
import { connect, listen } from './ws-client.ts';

async function start(t: { after(fn: () => unknown): void }) {
  const app = buildApp();
  t.after(() => app.close());
  const url = await listen(app);
  return { app, url };
}

test('create-game returns a Game Code and makes the socket a Table view', async (t) => {
  const { url } = await start(t);
  const table = await connect(url);

  table.send({ type: 'create-game' });

  const created = await table.next();
  assert.equal(created.type, 'game-created');
  assert.match((created as { code: string }).code, /^[A-HJ-NP-Z]{4}$/);
  const view = await table.next();
  assert.equal(view.type, 'table-view');
});

test('open-table attaches another Table view to an existing Game', async (t) => {
  const { url } = await start(t);
  const first = await connect(url);
  first.send({ type: 'create-game' });
  const { code } = await first.nextOfType('game-created');
  await first.next();

  const second = await connect(url);
  second.send({ type: 'open-table', code });

  assert.equal((await second.next()).type, 'table-view');
});

test('the Game survives with no Table attached', async (t) => {
  const { url } = await start(t);
  const first = await connect(url);
  first.send({ type: 'create-game' });
  const { code } = await first.nextOfType('game-created');
  await first.close();

  const second = await connect(url);
  second.send({ type: 'open-table', code });

  assert.equal((await second.next()).type, 'table-view');
});

test('open-table with an unknown Game Code is an error', async (t) => {
  const { url } = await start(t);
  const table = await connect(url);

  table.send({ type: 'open-table', code: 'ZZZZ' });

  const reply = await table.next();
  assert.equal(reply.type, 'error');
  assert.equal((reply as { error: string }).error, 'unknown-game');
});

test('join seats a Player, gives them a token and updates every screen', async (t) => {
  const { url } = await start(t);
  const table = await connect(url);
  table.send({ type: 'create-game' });
  const { code } = await table.nextOfType('game-created');
  await table.next();

  const phone = await connect(url);
  phone.send({ type: 'join', code, name: 'Ann', seat: 2 });

  const joined = await phone.next();
  assert.equal(joined.type, 'joined');
  assert.ok((joined as { token: string }).token.length > 0);
  const own = await phone.next();
  assert.equal(own.type, 'player-view');
  assert.equal((own as { view: { you: { name: string; seat: number } } }).view.you.name, 'Ann');
  const tableUpdate = await table.nextOfType('table-view');
  assert.deepEqual(
    tableUpdate.view.seats.map((s) => [s.name, s.seat]),
    [['Ann', 2]],
  );
});

test('join with an unknown Game Code is an error', async (t) => {
  const { url } = await start(t);
  const phone = await connect(url);

  phone.send({ type: 'join', code: 'ZZZZ', name: 'Ann', seat: 1 });

  const reply = await phone.next();
  assert.equal((reply as { error: string }).error, 'unknown-game');
});

test('join into a taken Seat is an error and changes nothing', async (t) => {
  const { url } = await start(t);
  const table = await connect(url);
  table.send({ type: 'create-game' });
  const { code } = await table.nextOfType('game-created');
  const ann = await connect(url);
  ann.send({ type: 'join', code, name: 'Ann', seat: 2 });
  await ann.nextOfType('player-view');

  const bob = await connect(url);
  bob.send({ type: 'join', code, name: 'Bob', seat: 2 });

  const reply = await bob.next();
  assert.equal((reply as { error: string }).error, 'seat-taken');
});

async function seatedPlayer(url: string) {
  const table = await connect(url);
  table.send({ type: 'create-game' });
  const { code } = await table.nextOfType('game-created');
  const phone = await connect(url);
  phone.send({ type: 'join', code, name: 'Ann', seat: 1 });
  const { token, playerId } = await phone.nextOfType('joined');
  await phone.nextOfType('player-view');
  return { table, phone, code, token, playerId };
}

test('resume reattaches a new socket to the same Player after a drop', async (t) => {
  const { url } = await start(t);
  const { phone, code, token, playerId } = await seatedPlayer(url);
  await phone.close();

  const again = await connect(url);
  again.send({ type: 'resume', code, token });

  const joined = await again.next();
  assert.deepEqual(
    [joined.type, (joined as { playerId: string }).playerId],
    ['joined', playerId],
  );
  const view = await again.next();
  assert.equal((view as { view: { you: { playerId: string } } }).view.you.playerId, playerId);
});

test('resume with a wrong token is an error', async (t) => {
  const { url } = await start(t);
  const { code } = await seatedPlayer(url);

  const intruder = await connect(url);
  intruder.send({ type: 'resume', code, token: 'nope' });

  const reply = await intruder.next();
  assert.equal((reply as { error: string }).error, 'unknown-player');
});

test('resume with an unknown Game Code is an error', async (t) => {
  const { url } = await start(t);
  const phone = await connect(url);

  phone.send({ type: 'resume', code: 'ZZZZ', token: 'nope' });

  assert.equal(((await phone.next()) as { error: string }).error, 'unknown-game');
});

test('Games running at once do not affect each other', async (t) => {
  const { url } = await start(t);
  const tableA = await connect(url);
  tableA.send({ type: 'create-game' });
  const { code: codeA } = await tableA.nextOfType('game-created');
  const tableB = await connect(url);
  tableB.send({ type: 'create-game' });
  const { code: codeB } = await tableB.nextOfType('game-created');
  await tableB.next();
  assert.notEqual(codeA, codeB);

  const ann = await connect(url);
  ann.send({ type: 'join', code: codeA, name: 'Ann', seat: 1 });
  await ann.nextOfType('player-view');
  const bob = await connect(url);
  bob.send({ type: 'join', code: codeB, name: 'Bob', seat: 1 });
  await bob.nextOfType('player-view');

  const viewB = await tableB.nextOfType('table-view');
  assert.deepEqual(
    viewB.view.seats.map((s) => s.name),
    ['Bob'],
  );
});

test('a screen never receives Hole Cards that are not its own', async (t) => {
  const { url } = await start(t);
  const table = await connect(url);
  table.send({ type: 'create-game' });
  const { code } = await table.nextOfType('game-created');
  const ann = await connect(url);
  ann.send({ type: 'join', code, name: 'Ann', seat: 1 });
  const bob = await connect(url);
  bob.send({ type: 'join', code, name: 'Bob', seat: 2 });
  await bob.nextOfType('player-view');

  ann.send({ type: 'host', command: { type: 'deal-hand' } });

  type Seen = { view: { you: { holeCards: unknown[] | null } } };
  const holeCards = async (client: typeof ann) => {
    for (;;) {
      const message = await client.nextOfType('player-view');
      if ((message as unknown as Seen).view.you.holeCards) return JSON.stringify((message as unknown as Seen).view.you.holeCards);
    }
  };
  const annCards = await holeCards(ann);
  const bobCards = await holeCards(bob);
  assert.notEqual(annCards, bobCards);

  let dealt = await table.nextOfType('table-view');
  while (!dealt.view.hand) dealt = await table.nextOfType('table-view');
  const tableMessage = JSON.stringify(dealt);
  assert.ok(!tableMessage.includes(annCards.slice(1, -1)));
  assert.ok(!tableMessage.includes(bobCards.slice(1, -1)));
});

test('views show whether each Player is connected', async (t) => {
  const { url } = await start(t);
  const { table, phone, code, token } = await seatedPlayer(url);
  const connectedOf = async () => {
    const { view } = await table.nextOfType('table-view');
    return view.seats.map((s) => s.connected);
  };
  assert.deepEqual(await connectedOf(), []);
  assert.deepEqual(await connectedOf(), [true]);

  await phone.close();
  assert.deepEqual(await connectedOf(), [false]);

  const again = await connect(url);
  again.send({ type: 'resume', code, token });
  assert.deepEqual(await connectedOf(), [true]);
});

test('a malformed message is a bad-message error and the socket stays usable', async (t) => {
  const { url } = await start(t);
  const table = await connect(url);

  table.sendRaw('not json');
  const reply = await table.next();
  assert.equal((reply as { error: string }).error, 'bad-message');

  table.send({ type: 'create-game' });
  assert.equal((await table.next()).type, 'game-created');
});

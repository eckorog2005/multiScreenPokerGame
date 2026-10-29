import { setTimeout as sleep } from 'node:timers/promises';
import type { PlayerView, ServerMessage, TableView } from '@poker/protocol';
import { buildApp } from '../src/app.ts';
import { FakeClock } from './fake-clock.ts';
import { connect, listen, type TestClient } from './ws-client.ts';

export async function start(t: { after(fn: () => unknown): void }) {
  const clock = new FakeClock();
  const app = buildApp({}, { clock });
  t.after(() => app.close());
  const url = await listen(app);
  return { app, url, clock };
}

export type Seated = { client: TestClient; playerId: string; token: string };

export async function game(url: string, ...names: string[]) {
  const table = await connect(url);
  table.send({ type: 'create-game' });
  const { code } = await table.nextOfType('game-created');
  const players: Seated[] = [];
  for (const [i, name] of names.entries()) {
    const client = await connect(url);
    client.send({ type: 'join', code, name, seat: i + 1 });
    const { playerId, token } = await client.nextOfType('joined');
    players.push({ client, playerId, token });
  }
  for (const p of players) await settle(p.client);
  await settle(table);
  return { table, code, players };
}

/** Everything the server sent up to now, using an error reply as a marker. */
export async function settle(client: TestClient): Promise<ServerMessage[]> {
  client.sendRaw('not json');
  const seen: ServerMessage[] = [];
  for (;;) {
    const message = await client.next();
    if (message.type === 'error' && message.error === 'bad-message') return seen;
    seen.push(message);
  }
}

export async function tableViewWhere(client: TestClient, matches: (view: TableView) => boolean): Promise<TableView> {
  for (;;) {
    const { view } = await client.nextOfType('table-view');
    if (matches(view)) return view;
  }
}

export async function playerViewWhere(client: TestClient, matches: (view: PlayerView) => boolean): Promise<PlayerView> {
  for (;;) {
    const { view } = await client.nextOfType('player-view');
    if (matches(view)) return view;
  }
}

export const dealt = (view: TableView) => view.hand?.street === 'preflop' && view.hand.result === null;
export const complete = (view: TableView) => view.hand?.street === 'complete';
export const tableViews = (messages: ServerMessage[]) => messages.filter((m) => m.type === 'table-view');

/** Folds everyone out: connected Players fold themselves, the Host folds for disconnected ones. */
export async function foldOut(table: TestClient, players: Seated[], host: Seated, from: TableView) {
  const folded = new Set<string>();
  for (let view = from; ; view = await tableViewWhere(table, () => true)) {
    if (complete(view)) return view;
    const toAct = view.hand?.toAct;
    if (!toAct || folded.has(toAct)) continue;
    folded.add(toAct);
    if (view.seats.find((s) => s.playerId === toAct)!.connected) {
      players.find((p) => p.playerId === toAct)!.client.send({ type: 'action', action: { type: 'fold' } });
    } else {
      host.client.send({ type: 'host', command: { type: 'fold-for' } });
    }
  }
}

export async function until(condition: () => boolean) {
  for (let i = 0; !condition(); i++) {
    if (i > 400) throw new Error('timed out waiting');
    await sleep(5);
  }
}

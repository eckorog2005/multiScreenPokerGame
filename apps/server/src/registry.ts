import { createGame, type GameState } from '@poker/engine';
import { Timer, type Clock } from './clock.ts';

const CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const CODE_LENGTH = 4;

export type Screen = { send(message: unknown): void; close(): void };

export type ServerPlayer = {
  readonly id: string;
  readonly token: string;
  screen: Screen | null;
  disconnectedAt: number | null;
};

export type GameTimers = {
  readonly turn: Timer;
  readonly deal: Timer;
  readonly bot: Timer;
  readonly hostClaim: Timer;
  readonly cleanup: Timer;
};

export type ServerGame = {
  readonly code: string;
  state: GameState;
  /** The Host paused auto-dealing between Hands. */
  paused: boolean;
  /** The Host ended the Game; it stays watchable until it's discarded. */
  ended: boolean;
  readonly tables: Set<Screen>;
  readonly players: Map<string, ServerPlayer>;
  readonly timers: GameTimers;
};

export function hasConnectedScreen(game: ServerGame): boolean {
  return game.tables.size > 0 || [...game.players.values()].some((p) => p.screen !== null);
}

export class Registry {
  readonly #games = new Map<string, ServerGame>();
  readonly #clock: Clock;

  constructor(clock: Clock) {
    this.#clock = clock;
  }

  create(): ServerGame {
    const timers: GameTimers = {
      turn: new Timer(this.#clock),
      deal: new Timer(this.#clock),
      bot: new Timer(this.#clock),
      hostClaim: new Timer(this.#clock),
      cleanup: new Timer(this.#clock),
    };
    const game: ServerGame = {
      code: this.#newCode(),
      state: createGame(),
      paused: false,
      ended: false,
      tables: new Set(),
      players: new Map(),
      timers,
    };
    this.#games.set(game.code, game);
    return game;
  }

  get(code: string): ServerGame | undefined {
    return this.#games.get(code);
  }

  discard(game: ServerGame): void {
    for (const timer of Object.values(game.timers)) timer.clear();
    this.#games.delete(game.code);
  }

  #newCode(): string {
    for (;;) {
      let code = '';
      for (let i = 0; i < CODE_LENGTH; i++) {
        code += CODE_LETTERS[Math.floor(Math.random() * CODE_LETTERS.length)];
      }
      if (!this.#games.has(code)) return code;
    }
  }
}

import { createGame, type GameState } from '@poker/engine';

const CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const CODE_LENGTH = 4;

export type Screen = { send(message: unknown): void };

export type ServerPlayer = {
  readonly id: string;
  readonly token: string;
  screen: Screen | null;
  disconnectedAt: number | null;
};

export type ServerGame = {
  readonly code: string;
  state: GameState;
  readonly tables: Set<Screen>;
  readonly players: Map<string, ServerPlayer>;
};

export function hasConnectedScreen(game: ServerGame): boolean {
  return game.tables.size > 0 || [...game.players.values()].some((p) => p.screen !== null);
}

export class Registry {
  readonly #games = new Map<string, ServerGame>();

  create(): ServerGame {
    const game: ServerGame = { code: this.#newCode(), state: createGame(), tables: new Set(), players: new Map() };
    this.#games.set(game.code, game);
    return game;
  }

  get(code: string): ServerGame | undefined {
    return this.#games.get(code);
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

export type Clock = {
  now(): number;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
};

export const systemClock: Clock = {
  now: () => Date.now(),
  // Unref'd so pending Game timers never keep the process (or a test run) alive.
  setTimeout: (fn, ms) => setTimeout(fn, ms).unref(),
  clearTimeout: (handle) => clearTimeout(handle as NodeJS.Timeout),
};

/** One pending callback, re-armed only when its key changes. */
export class Timer {
  readonly #clock: Clock;
  #key: unknown = undefined;
  #handle: unknown = null;
  #at: number | null = null;

  constructor(clock: Clock) {
    this.#clock = clock;
  }

  /** When the pending callback fires, or null if none is pending. */
  get at(): number | null {
    return this.#at;
  }

  set(key: unknown, delayMs: number, fn: () => void): void {
    if (this.#at !== null && this.#key === key) return;
    this.clear();
    this.#key = key;
    this.#at = this.#clock.now() + delayMs;
    this.#handle = this.#clock.setTimeout(() => {
      this.#at = null;
      this.#handle = null;
      fn();
    }, delayMs);
  }

  clear(): void {
    if (this.#handle !== null) this.#clock.clearTimeout(this.#handle);
    this.#handle = null;
    this.#at = null;
  }
}

import type { Clock } from '../src/clock.ts';

export class FakeClock implements Clock {
  #now = 1_000_000;
  #nextId = 1;
  readonly #timers = new Map<number, { at: number; fn: () => void }>();

  get pending(): number {
    return this.#timers.size;
  }

  now(): number {
    return this.#now;
  }

  setTimeout(fn: () => void, ms: number): number {
    const id = this.#nextId++;
    this.#timers.set(id, { at: this.#now + ms, fn });
    return id;
  }

  clearTimeout(handle: unknown): void {
    this.#timers.delete(handle as number);
  }

  /** Moves time forward, firing due timers in order, including ones they schedule. */
  advance(ms: number): void {
    const end = this.#now + ms;
    for (;;) {
      let due: [number, { at: number; fn: () => void }] | undefined;
      for (const entry of this.#timers) {
        if (entry[1].at <= end && (!due || entry[1].at < due[1].at)) due = entry;
      }
      if (!due) break;
      this.#timers.delete(due[0]);
      this.#now = due[1].at;
      due[1].fn();
    }
    this.#now = end;
  }
}

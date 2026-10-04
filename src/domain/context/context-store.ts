import type { PassageContext, PassageContextPatch } from './types.js';

export type ContextListener = (context: Readonly<PassageContext>, previous: Readonly<PassageContext>) => void;

export class PassageContextStore {
  #context: PassageContext;
  #listeners = new Set<ContextListener>();

  constructor(initial: PassageContext) {
    this.#context = structuredClone(initial);
  }

  get(): Readonly<PassageContext> {
    return this.#context;
  }

  set(next: PassageContext): void {
    const previous = this.#context;
    this.#context = structuredClone(next);
    this.#emit(previous);
  }

  patch(patch: PassageContextPatch): void {
    const previous = this.#context;
    this.#context = { ...this.#context, ...structuredClone(patch) };
    this.#emit(previous);
  }

  clearSelection(): void {
    if (!this.#context.selection && !this.#context.activeVerse) return;
    const { selection: _selection, activeVerse: _activeVerse, ...rest } = this.#context;
    this.set(rest);
  }

  subscribe(listener: ContextListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  #emit(previous: PassageContext): void {
    for (const listener of this.#listeners) listener(this.#context, previous);
  }
}

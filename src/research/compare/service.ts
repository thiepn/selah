import type { ScripturePassage, ScriptureProvider, TranslationMetadata } from '../../bible/types.js';
import type { PassageRef } from '../../domain/references/types.js';

export interface ComparisonResult {
  passage: PassageRef;
  translations: Array<{ metadata: TranslationMetadata; scripture: ScripturePassage }>;
  unavailable: string[];
}

export class TranslationRegistry {
  #providers = new Map<string, ScriptureProvider>();

  constructor(providers: readonly ScriptureProvider[] = []) {
    for (const provider of providers) this.register(provider);
  }

  register(provider: ScriptureProvider): void {
    this.#providers.set(provider.translation.id, provider);
  }

  list(): TranslationMetadata[] {
    return [...this.#providers.values()].map((x) => structuredClone(x.translation));
  }

  get(id: string): ScriptureProvider | undefined {
    return this.#providers.get(id);
  }

  async compare(passage: PassageRef, translationIds: readonly string[]): Promise<ComparisonResult> {
    const translations: ComparisonResult['translations'] = [];
    const unavailable: string[] = [];
    for (const id of translationIds) {
      const provider = this.#providers.get(id);
      if (!provider || !(await provider.hasPassage(passage))) {
        unavailable.push(id);
        continue;
      }
      translations.push({ metadata: structuredClone(provider.translation), scripture: await provider.getPassage(passage) });
    }
    return { passage: structuredClone(passage), translations, unavailable };
  }
}

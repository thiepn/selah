import type { ScriptureLanguage, ScriptureToken, ScriptureVerse } from '../../bible/types.js';
import type { VerseRef } from '../../domain/references/types.js';

interface BsbStructureEntry {
  headings?: Array<{ level?: string; text?: string }>;
  para?: string[];
}

interface BsbDisplayLine {
  eng?: Record<string, Array<[string, string?]>>;
  grk?: Record<string, Array<[string, string?]>>;
  heb?: Record<string, Array<[string, string?]>>;
  structure?: Record<string, BsbStructureEntry>;
}

const tokenId = (translation: string, ref: VerseRef, language: ScriptureLanguage, index: number) =>
  `${translation}:${ref.book}.${ref.chapter}.${ref.verse}:${language}:${String(index).padStart(3, '0')}`;

function toTokens(
  values: Array<[string, string?]>,
  ref: VerseRef,
  language: ScriptureLanguage,
  translation: string,
): ScriptureToken[] {
  return values.map(([text, strongs], index) => {
    const token: ScriptureToken = { id: tokenId(translation, ref, language, index), text, language };
    if (strongs) token.strongs = strongs;
    return token;
  });
}

export function parseBsbDisplayJsonl(jsonl: string, book: string, chapter: number): ScriptureVerse[] {
  const verses: ScriptureVerse[] = [];
  for (const rawLine of jsonl.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const parsed = JSON.parse(line) as BsbDisplayLine;
    const entries = Object.entries(parsed.eng ?? {});
    for (const [verseKey, english] of entries) {
      const verse = Number(verseKey);
      if (!Number.isInteger(verse) || verse < 1) throw new Error(`Invalid BSB verse key: ${verseKey}`);
      const ref: VerseRef = { book, chapter, verse };
      const structure = parsed.structure?.[verseKey];
      const heading = structure?.headings?.map((h) => h.text).filter(Boolean).join(' · ') || undefined;
      const para = structure?.para ?? [];
      const result: ScriptureVerse = {
        ref,
        tokens: toTokens(english, ref, 'en', 'BSB'),
      };
      if (heading) result.heading = heading;
      if (para.length) result.paragraphStart = true;
      if (para.some((code) => /q|po/i.test(code))) result.poetry = true;
      verses.push(result);
    }
  }
  verses.sort((a, b) => a.ref.verse - b.ref.verse);
  return verses;
}

export function parseBsbOriginalTokens(jsonl: string, book: string, chapter: number): Map<number, ScriptureToken[]> {
  const output = new Map<number, ScriptureToken[]>();
  for (const rawLine of jsonl.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const parsed = JSON.parse(line) as BsbDisplayLine;
    const source = parsed.grk ?? parsed.heb;
    if (!source) continue;
    const language: ScriptureLanguage = parsed.grk ? 'grc' : 'hbo';
    for (const [verseKey, values] of Object.entries(source)) {
      const verse = Number(verseKey);
      const ref: VerseRef = { book, chapter, verse };
      output.set(verse, toTokens(values, ref, language, language === 'grc' ? 'GRC' : 'HBO'));
    }
  }
  return output;
}

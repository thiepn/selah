export interface CanonicalUsjVerse {
  verse: number;
  text: string;
  headings: Array<{ level: string; text: string }>;
  para: string[];
}

export interface CanonicalUsjBook {
  book: string;
  chapters: Record<number, Record<number, CanonicalUsjVerse>>;
}

type UnknownRecord = Record<string, unknown>;

const HEADING_MARKERS = new Set(['r', 'd', 'sp', 'qa']);
const SKIP_TYPES = new Set(['note', 'figure', 'sidebar']);
const SKIP_MARKERS = new Set(['f', 'fe', 'ef', 'x', 'ex']);

const asRecord = (value: unknown): UnknownRecord | undefined =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as UnknownRecord : undefined;

const markerIsHeading = (marker: string): boolean =>
  HEADING_MARKERS.has(marker) || /^s\d*$/.test(marker) || /^ms\d*$/.test(marker);

function plainText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(plainText).join('');
  const node = asRecord(value);
  if (!node) return '';
  if (SKIP_TYPES.has(String(node.type ?? '')) || SKIP_MARKERS.has(String(node.marker ?? ''))) return '';
  return plainText(node.content);
}

const clean = (value: string): string =>
  value.replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\s+/g, ' ').trim();

/**
 * Parses the official BSB USJ form into canonical English verse text.
 *
 * USJ is sequential: a verse marker may be a sibling of the text that follows
 * it inside a paragraph. The parser therefore keeps chapter/verse state while
 * walking the document rather than assuming text is nested in the verse node.
 */
export function parseBsbUsjDocument(input: string | unknown): CanonicalUsjBook {
  const document = typeof input === 'string' ? JSON.parse(input) as unknown : input;
  let book = '';
  let chapter = 0;
  let verse = 0;
  let pendingHeadings: Array<{ level: string; text: string }> = [];
  let pendingPara: string[] = [];
  const chapters: Record<number, Record<number, CanonicalUsjVerse>> = {};

  const ensureVerse = (): CanonicalUsjVerse => {
    if (!book || chapter < 1 || verse < 1) throw new Error('USJ text appeared before a valid book/chapter/verse marker');
    const chapterData = chapters[chapter] ??= {};
    return chapterData[verse] ??= { verse, text: '', headings: pendingHeadings.splice(0), para: pendingPara.splice(0) };
  };

  const appendText = (text: string): void => {
    if (!text || verse < 1) return;
    ensureVerse().text += text;
  };

  const walk = (value: unknown): void => {
    if (typeof value === 'string') {
      appendText(value);
      return;
    }
    if (Array.isArray(value)) {
      for (const child of value) walk(child);
      return;
    }
    const node = asRecord(value);
    if (!node) return;

    const type = String(node.type ?? '');
    const marker = String(node.marker ?? '');

    if (type === 'book') {
      const candidate = typeof node.code === 'string'
        ? node.code
        : typeof node.content === 'string'
          ? node.content.split(/\s+/)[0]
          : '';
      if (candidate) book = candidate.toUpperCase();
      verse = 0;
      return;
    }

    if (type === 'chapter') {
      const number = Number(node.number);
      if (Number.isInteger(number) && number > 0) chapter = number;
      verse = 0;
      pendingHeadings = [];
      pendingPara = [];
      if (node.content) walk(node.content);
      return;
    }

    if (type === 'verse') {
      const number = Number.parseInt(String(node.number ?? ''), 10);
      if (!Number.isInteger(number) || number < 1) throw new Error(`Invalid USJ verse number: ${String(node.number)}`);
      verse = number;
      ensureVerse();
      if (node.content) walk(node.content);
      return;
    }

    if (SKIP_TYPES.has(type) || SKIP_MARKERS.has(marker)) return;

    if (type === 'para' && markerIsHeading(marker)) {
      const text = clean(plainText(node.content));
      if (text) pendingHeadings.push({ level: marker || 's', text });
      return;
    }

    if (type === 'para') {
      if (marker) pendingPara.push(marker);
      walk(node.content);
      return;
    }

    // Inline USJ chars (wj/add/nd/etc.) are Scripture text. Notes/xrefs were
    // already excluded above.
    if (node.content !== undefined) walk(node.content);
  };

  walk(document);

  if (!book) throw new Error('USJ document does not contain a Bible book code');
  for (const chapterData of Object.values(chapters)) {
    for (const entry of Object.values(chapterData)) entry.text = clean(entry.text);
  }
  return { book, chapters };
}

import type { ScripturePassage, ScriptureToken } from '../../bible/types.js';

export interface PatternOccurrence {
  verse: number;
  tokenId: string;
  text: string;
}

export interface TextPattern {
  type: 'word' | 'strongs';
  key: string;
  label: string;
  count: number;
  occurrences: PatternOccurrence[];
}

export interface StructuralMarker {
  key: string;
  label: string;
  category: 'contrast' | 'reason' | 'inference' | 'condition' | 'purpose-result' | 'sequence';
  occurrences: PatternOccurrence[];
}

const normalizeWord = (text: string) => text.toLocaleLowerCase('en').normalize('NFKD').replace(/[^\p{L}\p{N}]/gu, '');
const wordsInToken = (text: string) => text.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu) ?? [];
const STOP_WORDS = new Set(['a','an','and','as','at','be','but','by','for','from','he','her','him','his','i','in','is','it','of','on','or','that','the','their','them','they','this','to','was','were','which','who','with','you']);

const MARKERS: ReadonlyArray<{ phrase: string[]; category: StructuralMarker['category'] }> = [
  { phrase:['even','though'], category:'contrast' },
  { phrase:['so','that'], category:'purpose-result' },
  { phrase:['in','order','that'], category:'purpose-result' },
  { phrase:['for','this','reason'], category:'inference' },
  { phrase:['therefore'], category:'inference' },
  { phrase:['thus'], category:'inference' },
  { phrase:['however'], category:'contrast' },
  { phrase:['but'], category:'contrast' },
  { phrase:['yet'], category:'contrast' },
  { phrase:['because'], category:'reason' },
  { phrase:['since'], category:'reason' },
  { phrase:['for'], category:'reason' },
  { phrase:['if'], category:'condition' },
  { phrase:['then'], category:'sequence' },
  { phrase:['now'], category:'sequence' },
];

function occurrence(token: ScriptureToken, verse: number): PatternOccurrence {
  return { verse, tokenId: token.id, text: token.text };
}

export function analyzePatterns(passage: ScripturePassage, minOccurrences = 2): TextPattern[] {
  const words = new Map<string, PatternOccurrence[]>();
  const strongs = new Map<string, PatternOccurrence[]>();
  for (const verse of passage.verses) {
    for (const token of verse.tokens) {
      for (const rawWord of wordsInToken(token.text)) {
        const word = normalizeWord(rawWord);
        if (!word || STOP_WORDS.has(word)) continue;
        const list = words.get(word) ?? [];
        list.push({ ...occurrence(token, verse.ref.verse), text: rawWord });
        words.set(word, list);
      }
      if (token.strongs) {
        const list = strongs.get(token.strongs) ?? [];
        list.push(occurrence(token, verse.ref.verse));
        strongs.set(token.strongs, list);
      }
    }
  }
  const result: TextPattern[] = [];
  for (const [key, occurrences] of words) {
    if (occurrences.length >= minOccurrences) result.push({ type:'word', key, label: occurrences[0]?.text ?? key, count: occurrences.length, occurrences });
  }
  for (const [key, occurrences] of strongs) {
    if (occurrences.length >= minOccurrences) result.push({ type:'strongs', key, label: key, count: occurrences.length, occurrences });
  }
  return result.sort((a,b) => b.count - a.count || a.key.localeCompare(b.key));
}

export function analyzeStructuralMarkers(passage: ScripturePassage): StructuralMarker[] {
  const flattened: Array<{ word: string; raw: string; token: ScriptureToken; verse: number }> = [];
  for (const verse of passage.verses) {
    for (const token of verse.tokens) {
      for (const raw of wordsInToken(token.text)) {
        const word = normalizeWord(raw);
        if (word) flattened.push({ word, raw, token, verse: verse.ref.verse });
      }
    }
  }

  const output = new Map<string, StructuralMarker>();
  const consumed = new Set<number>();
  const markers = [...MARKERS].sort((a,b)=>b.phrase.length-a.phrase.length);

  for (let index = 0; index < flattened.length; index += 1) {
    for (const marker of markers) {
      if (marker.phrase.length > 1 && marker.phrase.some((word, offset)=>flattened[index + offset]?.word !== word)) continue;
      if (marker.phrase.length === 1 && flattened[index]?.word !== marker.phrase[0]) continue;
      const indices = marker.phrase.map((_, offset)=>index + offset);
      if (indices.some((i)=>consumed.has(i))) continue;
      const first = flattened[index]!;
      const key = `${marker.category}:${marker.phrase.join(' ')}`;
      const existing = output.get(key) ?? { key, label: marker.phrase.join(' '), category: marker.category, occurrences: [] };
      existing.occurrences.push({ verse:first.verse, tokenId:first.token.id, text:marker.phrase.join(' ') });
      output.set(key, existing);
      for (const i of indices) consumed.add(i);
      break;
    }
  }

  return [...output.values()].sort((a,b)=>a.occurrences[0]!.verse-b.occurrences[0]!.verse || a.label.localeCompare(b.label));
}

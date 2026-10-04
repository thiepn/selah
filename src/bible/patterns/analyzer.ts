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

const normalizeWord = (text: string) => text.toLocaleLowerCase('en').normalize('NFKD').replace(/[^\p{L}\p{N}]/gu, '');
const wordsInToken = (text: string) => text.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu) ?? [];
const STOP_WORDS = new Set(['a','an','and','as','at','be','but','by','for','from','he','her','him','his','i','in','is','it','of','on','or','that','the','their','them','they','this','to','was','were','which','who','with','you']);

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

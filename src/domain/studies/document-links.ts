import { parseReference } from '../references/reference.js';
import type { PassageRef } from '../references/types.js';

export interface StudyDocumentScriptureLink {
  raw: string;
  label: string;
  passage: PassageRef;
  start: number;
  end: number;
}

export function extractStudyDocumentScriptureLinks(text: string): StudyDocumentScriptureLink[] {
  const links: StudyDocumentScriptureLink[] = [];
  const pattern = /\[\[([^\]\n]+)\]\]/g;
  for (const match of text.matchAll(pattern)) {
    const label = match[1]?.trim();
    const start = match.index;
    if (!label || start === undefined || /^study:/i.test(label)) continue;
    try {
      const parsed = parseReference(label);
      if (parsed.kind !== 'passage' || !parsed.passage) continue;
      links.push({ raw: match[0], label, passage: parsed.passage, start, end: start + match[0].length });
    } catch {}
  }
  return links;
}

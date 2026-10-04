import { BOOK_BY_ID } from '../domain/references/books.js';
import type { PassageRef } from '../domain/references/types.js';

export interface ExternalStudyResource {
  id: string;
  name: string;
  category: 'commentary' | 'original-language' | 'parallel' | 'overview';
  buildUrl(passage: PassageRef): string;
}

const bookSlug = (passage: PassageRef) => BOOK_BY_ID.get(passage.start.book)?.name.toLowerCase().replace(/\s+/g,'-') ?? passage.start.book.toLowerCase();

export const EXTERNAL_RESOURCES: readonly ExternalStudyResource[] = [
  {
    id:'enduring-word', name:'Enduring Word', category:'commentary',
    buildUrl:(p)=>`https://enduringword.com/bible-commentary/${bookSlug(p)}-${p.start.chapter}/`,
  },
  {
    id:'step-bible', name:'STEP Bible', category:'original-language',
    buildUrl:()=> 'https://www.stepbible.org/',
  },
  {
    id:'bible-hub', name:'Bible Hub', category:'parallel',
    buildUrl:(p)=>`https://biblehub.com/${bookSlug(p)}/${p.start.chapter}.htm`,
  },
];

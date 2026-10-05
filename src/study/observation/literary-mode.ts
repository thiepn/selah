import type { PassageRef } from '../../domain/references/types.js';

export type LiteraryMode = 'narrative' | 'gospel' | 'law' | 'poetry' | 'wisdom' | 'prophecy' | 'epistle' | 'apocalyptic';

const GROUPS: Record<LiteraryMode, readonly string[]> = {
  narrative:['GEN','JOS','JDG','RUT','1SA','2SA','1KI','2KI','1CH','2CH','EZR','NEH','EST','ACT'],
  gospel:['MAT','MRK','LUK','JHN'],
  law:['EXO','LEV','NUM','DEU'],
  poetry:['PSA','SNG','LAM'],
  wisdom:['JOB','PRO','ECC'],
  prophecy:['ISA','JER','EZK','DAN','HOS','JOL','AMO','OBA','JON','MIC','NAM','HAB','ZEP','HAG','ZEC','MAL'],
  epistle:['ROM','1CO','2CO','GAL','EPH','PHP','COL','1TH','2TH','1TI','2TI','TIT','PHM','HEB','JAS','1PE','2PE','1JN','2JN','3JN','JUD'],
  apocalyptic:['REV'],
};

const MODE_BY_BOOK=new Map<string,LiteraryMode>(
  Object.entries(GROUPS).flatMap(([mode,books])=>books.map((book)=>[book,mode as LiteraryMode])),
);

export function defaultLiteraryMode(passage:PassageRef):LiteraryMode {
  return MODE_BY_BOOK.get(passage.start.book)??'narrative';
}

export const LITERARY_MODE_LABELS:Record<LiteraryMode,string>={
  narrative:'Narrative',
  gospel:'Gospel',
  law:'Law',
  poetry:'Poetry',
  wisdom:'Wisdom',
  prophecy:'Prophecy',
  epistle:'Epistle',
  apocalyptic:'Apocalyptic',
};

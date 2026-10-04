import type { BookDefinition } from './types.js';

const B = (
  id: string,
  osis: string,
  name: string,
  testament: 'OT' | 'NT',
  order: number,
  chapters: number,
  aliases: string[],
): BookDefinition => ({ id, osis, name, testament, order, chapters, aliases });

export const BOOKS: readonly BookDefinition[] = [
  B('GEN','Gen','Genesis','OT',1,50,['gen','ge','gn','genesis']),
  B('EXO','Exod','Exodus','OT',2,40,['exo','exod','ex','exodus']),
  B('LEV','Lev','Leviticus','OT',3,27,['lev','lv','leviticus']),
  B('NUM','Num','Numbers','OT',4,36,['num','nu','nm','numbers']),
  B('DEU','Deut','Deuteronomy','OT',5,34,['deu','deut','dt','deuteronomy']),
  B('JOS','Josh','Joshua','OT',6,24,['jos','josh','joshua']),
  B('JDG','Judg','Judges','OT',7,21,['jdg','judg','judges']),
  B('RUT','Ruth','Ruth','OT',8,4,['rut','ruth']),
  B('1SA','1Sam','1 Samuel','OT',9,31,['1sa','1sam','1 sam','1 samuel','first samuel']),
  B('2SA','2Sam','2 Samuel','OT',10,24,['2sa','2sam','2 sam','2 samuel','second samuel']),
  B('1KI','1Kgs','1 Kings','OT',11,22,['1ki','1kgs','1 kings','first kings']),
  B('2KI','2Kgs','2 Kings','OT',12,25,['2ki','2kgs','2 kings','second kings']),
  B('1CH','1Chr','1 Chronicles','OT',13,29,['1ch','1chr','1 chronicles','first chronicles']),
  B('2CH','2Chr','2 Chronicles','OT',14,36,['2ch','2chr','2 chronicles','second chronicles']),
  B('EZR','Ezra','Ezra','OT',15,10,['ezr','ezra']),
  B('NEH','Neh','Nehemiah','OT',16,13,['neh','nehemiah']),
  B('EST','Esth','Esther','OT',17,10,['est','esth','esther']),
  B('JOB','Job','Job','OT',18,42,['job']),
  B('PSA','Ps','Psalms','OT',19,150,['ps','psa','psalm','psalms']),
  B('PRO','Prov','Proverbs','OT',20,31,['pro','prov','pr','proverbs']),
  B('ECC','Eccl','Ecclesiastes','OT',21,12,['ecc','eccl','ecclesiastes','qoheleth']),
  B('SNG','Song','Song of Songs','OT',22,8,['sng','song','song of songs','song of solomon','canticles']),
  B('ISA','Isa','Isaiah','OT',23,66,['isa','isaiah']),
  B('JER','Jer','Jeremiah','OT',24,52,['jer','jeremiah']),
  B('LAM','Lam','Lamentations','OT',25,5,['lam','lamentations']),
  B('EZK','Ezek','Ezekiel','OT',26,48,['ezk','ezek','ezekiel']),
  B('DAN','Dan','Daniel','OT',27,12,['dan','da','daniel']),
  B('HOS','Hos','Hosea','OT',28,14,['hos','hosea']),
  B('JOL','Joel','Joel','OT',29,3,['jol','joel']),
  B('AMO','Amos','Amos','OT',30,9,['amo','amos']),
  B('OBA','Obad','Obadiah','OT',31,1,['oba','obad','obadiah']),
  B('JON','Jonah','Jonah','OT',32,4,['jon','jonah']),
  B('MIC','Mic','Micah','OT',33,7,['mic','micah']),
  B('NAM','Nah','Nahum','OT',34,3,['nam','nah','nahum']),
  B('HAB','Hab','Habakkuk','OT',35,3,['hab','habakkuk']),
  B('ZEP','Zeph','Zephaniah','OT',36,3,['zep','zeph','zephaniah']),
  B('HAG','Hag','Haggai','OT',37,2,['hag','haggai']),
  B('ZEC','Zech','Zechariah','OT',38,14,['zec','zech','zechariah']),
  B('MAL','Mal','Malachi','OT',39,4,['mal','malachi']),
  B('MAT','Matt','Matthew','NT',40,28,['mat','matt','mt','matthew']),
  B('MRK','Mark','Mark','NT',41,16,['mrk','mark','mk']),
  B('LUK','Luke','Luke','NT',42,24,['luk','luke','lk']),
  B('JHN','John','John','NT',43,21,['jhn','john','jn']),
  B('ACT','Acts','Acts','NT',44,28,['act','acts','ac']),
  B('ROM','Rom','Romans','NT',45,16,['rom','ro','romans']),
  B('1CO','1Cor','1 Corinthians','NT',46,16,['1co','1cor','1 cor','1 corinthians','first corinthians']),
  B('2CO','2Cor','2 Corinthians','NT',47,13,['2co','2cor','2 cor','2 corinthians','second corinthians']),
  B('GAL','Gal','Galatians','NT',48,6,['gal','galatians']),
  B('EPH','Eph','Ephesians','NT',49,6,['eph','ephesians']),
  B('PHP','Phil','Philippians','NT',50,4,['php','phil','philip','philippians']),
  B('COL','Col','Colossians','NT',51,4,['col','colossians']),
  B('1TH','1Thess','1 Thessalonians','NT',52,5,['1th','1thess','1 thess','1 thessalonians','first thessalonians']),
  B('2TH','2Thess','2 Thessalonians','NT',53,3,['2th','2thess','2 thess','2 thessalonians','second thessalonians']),
  B('1TI','1Tim','1 Timothy','NT',54,6,['1ti','1tim','1 tim','1 timothy','first timothy']),
  B('2TI','2Tim','2 Timothy','NT',55,4,['2ti','2tim','2 tim','2 timothy','second timothy']),
  B('TIT','Titus','Titus','NT',56,3,['tit','titus']),
  B('PHM','Phlm','Philemon','NT',57,1,['phm','phlm','philemon']),
  B('HEB','Heb','Hebrews','NT',58,13,['heb','hebrews']),
  B('JAS','Jas','James','NT',59,5,['jas','james','jm']),
  B('1PE','1Pet','1 Peter','NT',60,5,['1pe','1pet','1 pet','1 peter','first peter']),
  B('2PE','2Pet','2 Peter','NT',61,3,['2pe','2pet','2 pet','2 peter','second peter']),
  B('1JN','1John','1 John','NT',62,5,['1jn','1john','1 john','first john']),
  B('2JN','2John','2 John','NT',63,1,['2jn','2john','2 john','second john']),
  B('3JN','3John','3 John','NT',64,1,['3jn','3john','3 john','third john']),
  B('JUD','Jude','Jude','NT',65,1,['jud','jude']),
  B('REV','Rev','Revelation','NT',66,22,['rev','revelation','revelations','apocalypse'])
];

export const BOOK_BY_ID = new Map(BOOKS.map((book) => [book.id, book]));
export const BOOK_BY_OSIS = new Map(BOOKS.map((book) => [book.osis.toLowerCase(), book]));

const normalizeAlias = (value: string) => value
  .trim()
  .toLowerCase()
  .replace(/[._]/g, ' ')
  .replace(/\s+/g, ' ');

export const BOOK_BY_ALIAS = new Map<string, BookDefinition>();
for (const book of BOOKS) {
  const aliases = new Set([book.id, book.osis, book.name, ...book.aliases]);
  for (const alias of aliases) BOOK_BY_ALIAS.set(normalizeAlias(alias), book);
}

export function findBook(alias: string): BookDefinition | undefined {
  return BOOK_BY_ALIAS.get(normalizeAlias(alias));
}

import type { ScripturePassage, ScriptureProvider, ScriptureVerse, TranslationMetadata } from '../../bible/types.js';
import type { PassageRef, VerseRef } from '../../domain/references/types.js';
import { compareVerseRefs } from '../../domain/references/reference.js';

export interface WebTextAssetLoader {
  load(path:string):Promise<string>;
}

export class FetchWebAssetLoader implements WebTextAssetLoader {
  constructor(private readonly baseUrl='/data/web') {}
  async load(path:string):Promise<string>{
    const response=await fetch(`${this.baseUrl}/${path}`);
    if(!response.ok)throw new Error(`Failed to load WEB asset: ${response.status} ${path}`);
    return response.text();
  }
}

interface WebChapterAsset {
  book:string;
  chapter:number;
  verses:Record<string,string>;
}

export function parseWebChapter(text:string,book:string,chapter:number):ScriptureVerse[]{
  const parsed=JSON.parse(text) as Partial<WebChapterAsset>;
  if(parsed.book!==book||parsed.chapter!==chapter||!parsed.verses||typeof parsed.verses!=='object'){
    throw new Error(`Invalid WEB chapter asset: ${book} ${chapter}`);
  }
  return Object.entries(parsed.verses)
    .map(([verse,text])=>({verse:Number(verse),text}))
    .filter((entry)=>Number.isInteger(entry.verse)&&entry.verse>0&&typeof entry.text==='string'&&entry.text.length>0)
    .sort((a,b)=>a.verse-b.verse)
    .map(({verse,text})=>({
      ref:{book,chapter,verse},
      tokens:[{id:`WEB:${book}.${chapter}.${verse}:0`,text,language:'en' as const}],
    }));
}

export class WebScriptureProvider implements ScriptureProvider {
  readonly translation:TranslationMetadata={
    id:'WEB',
    name:'World English Bible',
    abbreviation:'WEB',
    language:'en',
    license:'Public Domain',
    attribution:'World English Bible text; upstream source: worldenglish.bible.',
  };

  #chapterCache=new Map<string,Promise<ScriptureVerse[]>>();

  constructor(private readonly loader:WebTextAssetLoader){}

  async #chapter(book:string,chapter:number):Promise<ScriptureVerse[]>{
    const key=`${book}.${chapter}`;
    let pending=this.#chapterCache.get(key);
    if(!pending){
      pending=this.loader.load(`display/${book}/${book}${chapter}.json`).then((text)=>parseWebChapter(text,book,chapter));
      this.#chapterCache.set(key,pending);
    }
    return pending;
  }

  async getChapter(book:string,chapter:number):Promise<ScriptureVerse[]>{
    return structuredClone(await this.#chapter(book,chapter));
  }

  async getVerse(ref:VerseRef):Promise<ScriptureVerse>{
    const verse=(await this.#chapter(ref.book,ref.chapter)).find((item)=>item.ref.verse===ref.verse);
    if(!verse)throw new Error(`Verse not found in WEB: ${ref.book}.${ref.chapter}.${ref.verse}`);
    return structuredClone(verse);
  }

  async getPassage(ref:PassageRef):Promise<ScripturePassage>{
    if(ref.start.book!==ref.end.book)throw new Error('Cross-book passages are not supported by WEB provider');
    const verses:ScriptureVerse[]=[];
    for(let chapter=ref.start.chapter;chapter<=ref.end.chapter;chapter+=1){
      for(const verse of await this.#chapter(ref.start.book,chapter)){
        if(compareVerseRefs(verse.ref,ref.start)>=0&&compareVerseRefs(verse.ref,ref.end)<=0)verses.push(verse);
      }
    }
    return {translationId:this.translation.id,passage:structuredClone(ref),verses};
  }

  async hasPassage(ref:PassageRef):Promise<boolean>{
    try{
      const passage=await this.getPassage(ref);
      return passage.verses.length>0;
    }catch{return false;}
  }
}

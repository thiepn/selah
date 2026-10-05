import type { ScripturePassage } from '../../bible/types.js';
import { analyzePatterns, analyzeStructuralMarkers, type StructuralMarker } from '../../bible/patterns/analyzer.js';

export type ObservationPromptCategory = 'baseline' | 'repetition' | 'logic' | 'structure' | 'limits';

export interface ObservationPrompt {
  id: string;
  category: ObservationPromptCategory;
  prompt: string;
  tokenIds: string[];
  verses: number[];
}

const verseList=(verses:number[])=>[...new Set(verses)].sort((a,b)=>a-b).map((verse)=>`v.${verse}`).join(', ');

function markerQuestion(marker:StructuralMarker):string {
  const where=verseList(marker.occurrences.map((occurrence)=>occurrence.verse));
  if(marker.category==='contrast')return `What is being contrasted around “${marker.label}” (${where})?`;
  if(marker.category==='reason')return `What reason does “${marker.label}” give, and what claim does that reason support (${where})?`;
  if(marker.category==='inference')return `What conclusion follows at “${marker.label}”, and what earlier statement supports it (${where})?`;
  if(marker.category==='condition')return `What condition and consequence are connected by “${marker.label}” (${where})?`;
  if(marker.category==='purpose-result')return `What purpose or result is introduced by “${marker.label}” (${where})?`;
  return `What sequence or progression is signaled by “${marker.label}” (${where})?`;
}

export function buildObservationPrompts(scripture:ScripturePassage):ObservationPrompt[] {
  const prompts:ObservationPrompt[]=[
    {
      id:'baseline-explicit',
      category:'baseline',
      prompt:'What does this passage explicitly say before I move to explanation or application?',
      tokenIds:[],
      verses:[],
    },
    {
      id:'structure-shift',
      category:'structure',
      prompt:'Where does the thought, scene, speaker, subject, or argument shift? What words in the text signal that change?',
      tokenIds:[],
      verses:[],
    },
  ];

  const repetitions=analyzePatterns(scripture)
    .filter((pattern)=>pattern.type==='word')
    .slice(0,3);
  for(const pattern of repetitions){
    const verses=pattern.occurrences.map((occurrence)=>occurrence.verse);
    prompts.push({
      id:`repeat:${pattern.key}`,
      category:'repetition',
      prompt:`“${pattern.label}” appears ${pattern.count} times (${verseList(verses)}). What stays the same, and what changes around each occurrence?`,
      tokenIds:[...new Set(pattern.occurrences.map((occurrence)=>occurrence.tokenId))],
      verses:[...new Set(verses)].sort((a,b)=>a-b),
    });
  }

  for(const marker of analyzeStructuralMarkers(scripture).slice(0,4)){
    prompts.push({
      id:`logic:${marker.key}`,
      category:'logic',
      prompt:markerQuestion(marker),
      tokenIds:[...new Set(marker.occurrences.map((occurrence)=>occurrence.tokenId))],
      verses:[...new Set(marker.occurrences.map((occurrence)=>occurrence.verse))].sort((a,b)=>a-b),
    });
  }

  prompts.push({
    id:'limits-not-say',
    category:'limits',
    prompt:'What does this passage not say that I might be tempted to assume or import into it?',
    tokenIds:[],
    verses:[],
  });

  return prompts.slice(0,9);
}

import type { ScripturePassage } from '../../bible/types.js';
import type { LiteraryMode } from '../../domain/studies/types.js';
import { analyzePatterns, analyzeStructuralMarkers, type StructuralMarker } from '../../bible/patterns/analyzer.js';
import { defaultLiteraryMode } from './literary-mode.js';

export type ObservationPromptCategory = 'baseline' | 'literary' | 'repetition' | 'logic' | 'structure' | 'limits';

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

const LITERARY_PROMPTS:Record<LiteraryMode,readonly string[]>={
  narrative:[
    'Who acts, speaks, or responds in this scene, and what changes from the beginning to the end?',
    'Which details, repetitions, delays, contrasts, or reactions does the narrator give unusual attention to?',
  ],
  gospel:[
    'What does Jesus say or do here, and how do the other people in the passage respond?',
    'What explicit claim, question, conflict, sign, or action moves this scene forward?',
  ],
  law:[
    'What command, prohibition, procedure, distinction, or case is actually stated, and who is addressed?',
    'What reason, purpose, consequence, or covenant setting is attached to the instruction in the text?',
  ],
  poetry:[
    'Which lines echo, contrast, complete, or intensify one another, and what wording creates that relationship?',
    'What images, metaphors, repeated refrains, changes of voice, or emotional turns shape the poem?',
  ],
  wisdom:[
    'Is this unit presenting an observation, comparison, warning, instruction, question, or reflection? What wording shows that?',
    'What contrasts, consequences, exceptions, or limits in the wording keep me from turning this statement into a broader claim than the text makes?',
  ],
  prophecy:[
    'Who is speaking, who is addressed, and where do accusation, warning, judgment, lament, promise, or hope shift in the passage?',
    'Which images, repeated formulas, time markers, or changes of address structure the prophetic message?',
  ],
  epistle:[
    'What claim or instruction is being made, and what reason, evidence, conclusion, or purpose supports it?',
    'Where does the argument turn—through therefore, for, but, so that, if, because, or a change from statement to command?',
  ],
  apocalyptic:[
    'What is explicitly seen, heard, said, or explained in the vision, and which details are left uninterpreted by the passage itself?',
    'Where do the scene, speaker, location, sequence, image, number, or repeated formula change?',
  ],
};

function literaryPrompts(mode:LiteraryMode):ObservationPrompt[] {
  return LITERARY_PROMPTS[mode].map((prompt,index)=>({
    id:`literary:${mode}:${index+1}`,
    category:'literary' as const,
    prompt,
    tokenIds:[],
    verses:[],
  }));
}

export function buildObservationPrompts(scripture:ScripturePassage,mode:LiteraryMode=defaultLiteraryMode(scripture.passage)):ObservationPrompt[] {
  const baseline:ObservationPrompt[]=[
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
    .slice(0,3)
    .map((pattern)=>{
      const verses=pattern.occurrences.map((occurrence)=>occurrence.verse);
      return {
        id:`repeat:${pattern.key}`,
        category:'repetition' as const,
        prompt:`“${pattern.label}” appears ${pattern.count} times (${verseList(verses)}). What stays the same, and what changes around each occurrence?`,
        tokenIds:[...new Set(pattern.occurrences.map((occurrence)=>occurrence.tokenId))],
        verses:[...new Set(verses)].sort((a,b)=>a-b),
      };
    });

  const logic=analyzeStructuralMarkers(scripture).slice(0,3).map((marker)=>({
    id:`logic:${marker.key}`,
    category:'logic' as const,
    prompt:markerQuestion(marker),
    tokenIds:[...new Set(marker.occurrences.map((occurrence)=>occurrence.tokenId))],
    verses:[...new Set(marker.occurrences.map((occurrence)=>occurrence.verse))].sort((a,b)=>a-b),
  }));

  const limits:ObservationPrompt={
    id:'limits-not-say',
    category:'limits',
    prompt:'What does this passage not say that I might be tempted to assume or import into it?',
    tokenIds:[],
    verses:[],
  };

  return [...baseline,...literaryPrompts(mode),...repetitions,...logic,limits];
}

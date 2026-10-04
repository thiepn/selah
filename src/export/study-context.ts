import type { ScripturePassage } from '../bible/types.js';
import { formatPassage } from '../domain/references/reference.js';
import type { Annotation, Study, StudyDocument } from '../domain/studies/types.js';

const passageText = (scripture: ScripturePassage) => scripture.verses
  .map((verse) => `${verse.ref.verse} ${verse.tokens.map((t) => t.text).join('')}`)
  .join('\n');

const annotationLabel = (annotation: Annotation): string => {
  if (annotation.anchor.type === 'reference') return formatPassage(annotation.anchor.passage);
  if (annotation.anchor.type === 'text') return `${annotation.anchor.verse.book} ${annotation.anchor.verse.chapter}:${annotation.anchor.verse.verse} — “${annotation.anchor.quotedText}”`;
  return `Original-language token (${annotation.anchor.tokenIds.join(', ')})`;
};

export interface StudyContextExportOptions {
  includeScripture?: boolean;
  includeAnnotations?: boolean;
  includeDocument?: boolean;
  tutorPrompt?: 'none' | 'socratic' | 'check-interpretation' | 'challenge';
}

export function exportStudyContextMarkdown(input: {
  study: Study;
  scripture?: ScripturePassage;
  annotations?: Annotation[];
  document?: StudyDocument;
  options?: StudyContextExportOptions;
}): string {
  const options = { includeScripture: true, includeAnnotations: true, includeDocument: true, tutorPrompt: 'none' as const, ...input.options };
  const lines = [`# Selah Study Context`, '', `Passage: ${formatPassage(input.study.primaryPassage)}`, ''];
  if (options.includeScripture && input.scripture) lines.push('## Scripture', '', passageText(input.scripture), '');
  if (options.includeAnnotations && input.annotations?.length) {
    lines.push('## Notes and annotations', '');
    for (const annotation of input.annotations) {
      const body = annotation.body?.trim() || (annotation.kind === 'highlight' ? `[Highlight: ${annotation.highlightStyle ?? 'default'}]` : '');
      lines.push(`- **${annotation.kind} — ${annotationLabel(annotation)}:** ${body}`);
    }
    lines.push('');
  }
  if (options.includeDocument && input.document?.plainText.trim()) lines.push('## My study document', '', input.document.plainText.trim(), '');
  if (options.tutorPrompt !== 'none') {
    lines.push('## Requested tutoring mode', '');
    if (options.tutorPrompt === 'socratic') lines.push('Act as a Socratic Bible-study tutor. Ask text-grounded questions before giving conclusions. Distinguish explicit statements, strong inferences, possible interpretations, and disputed interpretations.');
    if (options.tutorPrompt === 'check-interpretation') lines.push('Critically check my interpretation against the passage and its literary context. Identify what the text supports, what is only an inference, and what may be overstated.');
    if (options.tutorPrompt === 'challenge') lines.push('Challenge my understanding with difficult text-grounded questions. Focus on argument, structure, context, cross-references, and claims the passage does not justify.');
    lines.push('');
  }
  return lines.join('\n').trimEnd() + '\n';
}

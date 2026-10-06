import { canonicalPassageId, compareVerseRefs, formatPassage } from '../domain/references/reference.js';
import type { PassageRef } from '../domain/references/types.js';
import type { Study } from '../domain/studies/types.js';
import type { SelahRepository } from '../persistence/types.js';

export function normalizeStudyTags(tags: string[]): string[] {
  const cleaned: string[] = [];
  const seen = new Set<string>();
  for (const raw of tags) {
    const tag=raw.trim().replace(/^#+/,'').trim().replace(/\s+/g,' ');
    if (!tag) continue;
    if (tag.length > 40) throw new Error('Study topics must be 40 characters or fewer');
    const key=tag.toLocaleLowerCase('en');
    if (seen.has(key)) continue;
    seen.add(key);
    cleaned.push(tag);
    if (cleaned.length > 12) throw new Error('A study can have at most 12 topics');
  }
  return cleaned;
}

export function studiesOverlappingPassage(studies: Study[], passage: PassageRef): Study[] {
  return studies
    .filter((study)=>!study.archived)
    .filter((study)=>compareVerseRefs(study.primaryPassage.end,passage.start)>=0&&compareVerseRefs(study.primaryPassage.start,passage.end)<=0)
    .sort((a,b)=>compareVerseRefs(a.primaryPassage.start,b.primaryPassage.start)||compareVerseRefs(a.primaryPassage.end,b.primaryPassage.end)||b.updatedAt-a.updatedAt);
}

export interface StudyServiceOptions {
  idFactory?: () => string;
  now?: () => number;
}

export class StudyService {
  readonly #idFactory: () => string;
  readonly #now: () => number;

  constructor(private readonly repository: SelahRepository, options: StudyServiceOptions = {}) {
    this.#idFactory = options.idFactory ?? (() => crypto.randomUUID());
    this.#now = options.now ?? Date.now;
  }

  async create(primaryPassage: PassageRef, title = formatPassage(primaryPassage)): Promise<Study> {
    const now = this.#now();
    const study: Study = {
      id: this.#idFactory(),
      primaryPassage: structuredClone(primaryPassage),
      title,
      tags: [],
      archived: false,
      createdAt: now,
      updatedAt: now,
    };
    await this.repository.putStudy(study);
    return study;
  }

  async touch(id: string): Promise<Study> {
    const existing = await this.repository.getStudy(id);
    if (!existing) throw new Error(`Study not found: ${id}`);
    const updated: Study = { ...existing, updatedAt: this.#now() };
    await this.repository.putStudy(updated);
    return updated;
  }

  async rename(id: string, title: string): Promise<Study> {
    const existing = await this.repository.getStudy(id);
    if (!existing) throw new Error(`Study not found: ${id}`);
    const clean = title.trim();
    if (!clean) throw new Error('Study title cannot be empty');
    const updated: Study = { ...existing, title: clean, updatedAt: this.#now() };
    await this.repository.putStudy(updated);
    return updated;
  }

  async setTags(id: string, tags: string[]): Promise<Study> {
    const existing = await this.repository.getStudy(id);
    if (!existing) throw new Error(`Study not found: ${id}`);
    const updated: Study = { ...existing, tags: normalizeStudyTags(tags), updatedAt: this.#now() };
    await this.repository.putStudy(updated);
    return updated;
  }

  async updateMetadata(id: string, input: { title: string; tags: string[] }): Promise<Study> {
    const existing = await this.repository.getStudy(id);
    if (!existing) throw new Error(`Study not found: ${id}`);
    const title=input.title.trim();
    if (!title) throw new Error('Study title cannot be empty');
    if (title.length > 120) throw new Error('Study title must be 120 characters or fewer');
    const tags=normalizeStudyTags(input.tags);
    const updated: Study = { ...existing, title, tags, updatedAt: this.#now() };
    await this.repository.putStudy(updated);
    return updated;
  }

  async setLiteraryMode(id: string, literaryMode: Study['literaryMode']): Promise<Study> {
    const existing=await this.repository.getStudy(id);
    if(!existing)throw new Error(`Study not found: ${id}`);
    const updated:Study={...existing,...(literaryMode?{literaryMode}:{}),updatedAt:this.#now()};
    if(!literaryMode)delete updated.literaryMode;
    await this.repository.putStudy(updated);
    return updated;
  }

  async setArchived(id: string, archived: boolean): Promise<Study> {
    const existing = await this.repository.getStudy(id);
    if (!existing) throw new Error(`Study not found: ${id}`);
    const updated: Study = { ...existing, archived, updatedAt: this.#now() };
    await this.repository.putStudy(updated);
    return updated;
  }

  async forPassage(passage: PassageRef): Promise<Study | undefined> {
    const id=canonicalPassageId(passage);
    return (await this.repository.listStudies()).find((study)=>!study.archived&&canonicalPassageId(study.primaryPassage)===id);
  }

  async recent(limit = 20): Promise<Study[]> {
    return (await this.repository.listStudies())
      .filter((study) => !study.archived)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, limit);
  }
}

import { formatPassage } from '../domain/references/reference.js';
import type { PassageRef } from '../domain/references/types.js';
import type { Study } from '../domain/studies/types.js';
import type { SelahRepository } from '../persistence/types.js';

export function normalizeStudyTags(tags: string[]): string[] {
  const cleaned: string[] = [];
  const seen = new Set<string>();
  for (const raw of tags) {
    const tag=raw.replace(/^#+/,'').trim().replace(/\s+/g,' ');
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

  async setArchived(id: string, archived: boolean): Promise<Study> {
    const existing = await this.repository.getStudy(id);
    if (!existing) throw new Error(`Study not found: ${id}`);
    const updated: Study = { ...existing, archived, updatedAt: this.#now() };
    await this.repository.putStudy(updated);
    return updated;
  }

  async recent(limit = 20): Promise<Study[]> {
    return (await this.repository.listStudies())
      .filter((study) => !study.archived)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, limit);
  }
}

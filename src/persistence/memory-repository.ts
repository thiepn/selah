import type { PhrasingDocument } from '../bible/phrasing/model.js';
import type { ReviewCard } from '../review/types.js';
import type { Annotation, Study, StudyDocument, StudySynthesis, WorkspaceState } from '../domain/studies/types.js';
import { defaultMetadata, defaultSettings } from './defaults.js';
import type { SelahMetadata, SelahRepository, SelahSettings, SelahSnapshot } from './types.js';

const clone = <T>(value: T): T => structuredClone(value);

export class MemorySelahRepository implements SelahRepository {
  #metadata: SelahMetadata = defaultMetadata();
  #settings: SelahSettings = defaultSettings();
  #studies = new Map<string, Study>();
  #documents = new Map<string, StudyDocument>();
  #syntheses = new Map<string, StudySynthesis>();
  #review = new Map<string, ReviewCard>();
  #annotations = new Map<string, Annotation>();
  #workspaces = new Map<string, WorkspaceState>();
  #phrasing = new Map<string, PhrasingDocument>();

  async initialize(): Promise<void> {}
  async getMetadata() { return clone(this.#metadata); }
  async setMetadata(value: SelahMetadata) { this.#metadata = clone(value); }
  async getSettings() { return clone(this.#settings); }
  async setSettings(value: SelahSettings) { this.#settings = clone(value); }

  async listStudies() { return [...this.#studies.values()].map(clone); }
  async getStudy(id: string) { const v = this.#studies.get(id); return v ? clone(v) : undefined; }
  async putStudy(value: Study) { this.#studies.set(value.id, clone(value)); }
  async deleteStudy(id: string) { this.#studies.delete(id); this.#documents.delete(id); this.#syntheses.delete(id); for(const [cardId,card] of this.#review)if(card.studyId===id)this.#review.delete(cardId); }

  async getStudyDocument(id: string) { const v = this.#documents.get(id); return v ? clone(v) : undefined; }
  async putStudyDocument(value: StudyDocument) { this.#documents.set(value.studyId, clone(value)); }
  async getStudySynthesis(id: string) { const v=this.#syntheses.get(id); return v ? clone(v) : undefined; }
  async putStudySynthesis(value: StudySynthesis) { this.#syntheses.set(value.studyId, clone(value)); }
  async listReviewCards(studyId?: string) { return [...this.#review.values()].filter((card)=>!studyId||card.studyId===studyId).map(clone); }
  async getReviewCard(id: string) { const v=this.#review.get(id); return v ? clone(v) : undefined; }
  async putReviewCard(value: ReviewCard) { this.#review.set(value.id,clone(value)); }
  async deleteReviewCard(id: string) { this.#review.delete(id); }

  async listAnnotations(studyId?: string) {
    return [...this.#annotations.values()].filter((a) => !studyId || a.studyId === studyId).map(clone);
  }
  async putAnnotation(value: Annotation) { this.#annotations.set(value.id, clone(value)); }
  async deleteAnnotation(id: string) { this.#annotations.delete(id); }

  async listWorkspaces() { return [...this.#workspaces.values()].map(clone); }
  async getWorkspace(id: string) { const v = this.#workspaces.get(id); return v ? clone(v) : undefined; }
  async putWorkspace(value: WorkspaceState) { this.#workspaces.set(value.id, clone(value)); }
  async deleteWorkspace(id: string) { this.#workspaces.delete(id); }

  async listPhrasingDocuments(studyId?: string) { return [...this.#phrasing.values()].filter((x)=>!studyId || x.studyId === studyId).map(clone); }
  async getPhrasingDocument(id: string) { const v = this.#phrasing.get(id); return v ? clone(v) : undefined; }
  async putPhrasingDocument(value: PhrasingDocument) { this.#phrasing.set(value.id, clone(value)); }
  async deletePhrasingDocument(id: string) { this.#phrasing.delete(id); }

  async exportSnapshot(): Promise<SelahSnapshot> {
    return {
      metadata: await this.getMetadata(),
      settings: await this.getSettings(),
      studies: await this.listStudies(),
      studyDocuments: [...this.#documents.values()].map(clone),
      studySyntheses: [...this.#syntheses.values()].map(clone),
      reviewCards: [...this.#review.values()].map(clone),
      annotations: await this.listAnnotations(),
      workspaceStates: await this.listWorkspaces(),
      phrasingDocuments: await this.listPhrasingDocuments(),
    };
  }

  async importSnapshot(snapshot: SelahSnapshot, mode: 'replace' | 'merge' = 'replace'): Promise<void> {
    if (mode === 'replace') {
      this.#studies.clear();
      this.#documents.clear();
      this.#syntheses.clear();
      this.#review.clear();
      this.#annotations.clear();
      this.#workspaces.clear();
      this.#phrasing.clear();
    }
    this.#metadata = clone(snapshot.metadata);
    this.#settings = clone(snapshot.settings);
    for (const item of snapshot.studies) this.#studies.set(item.id, clone(item));
    for (const item of snapshot.studyDocuments) this.#documents.set(item.studyId, clone(item));
    for (const item of snapshot.studySyntheses ?? []) this.#syntheses.set(item.studyId, clone(item));
    for (const item of snapshot.reviewCards ?? []) this.#review.set(item.id, clone(item));
    for (const item of snapshot.annotations) this.#annotations.set(item.id, clone(item));
    for (const item of snapshot.workspaceStates) this.#workspaces.set(item.id, clone(item));
    for (const item of snapshot.phrasingDocuments ?? []) this.#phrasing.set(item.id, clone(item));
  }
}

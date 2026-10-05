import type { PhrasingDocument } from '../bible/phrasing/model.js';
import type { Annotation, Study, StudyDocument, StudySynthesis, WorkspaceState } from '../domain/studies/types.js';
import { defaultMetadata, defaultSettings } from './defaults.js';
import type { SelahMetadata, SelahRepository, SelahSettings, SelahSnapshot } from './types.js';

const DB_NAME = 'selah';
const DB_VERSION = 3;
const STORES = {
  system: 'system',
  studies: 'studies',
  documents: 'studyDocuments',
  syntheses: 'studySyntheses',
  annotations: 'annotations',
  workspaces: 'workspaceStates',
  phrasing: 'phrasingDocuments',
} as const;

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'));
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
  });
}

export class IndexedDbSelahRepository implements SelahRepository {
  #db?: IDBDatabase;

  async initialize(): Promise<void> {
    if (this.#db) return;
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORES.system)) db.createObjectStore(STORES.system, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(STORES.studies)) db.createObjectStore(STORES.studies, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(STORES.documents)) db.createObjectStore(STORES.documents, { keyPath: 'studyId' });
      if (!db.objectStoreNames.contains(STORES.syntheses)) db.createObjectStore(STORES.syntheses, { keyPath: 'studyId' });
      if (!db.objectStoreNames.contains(STORES.annotations)) {
        const store = db.createObjectStore(STORES.annotations, { keyPath: 'id' });
        store.createIndex('studyId', 'studyId', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORES.workspaces)) db.createObjectStore(STORES.workspaces, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(STORES.phrasing)) {
        const store = db.createObjectStore(STORES.phrasing, { keyPath: 'id' });
        store.createIndex('studyId', 'studyId', { unique: false });
      }
    };
    this.#db = await requestResult(request);
    const tx = this.#db.transaction(STORES.system, 'readwrite');
    const store = tx.objectStore(STORES.system);
    const metadata = (await requestResult(store.get('metadata'))) as SelahMetadata | undefined;
    if (!metadata) store.put(defaultMetadata());
    else if (metadata.appSchemaVersion !== 3) store.put({ ...metadata, appSchemaVersion: 3, updatedAt: Date.now() });
    if (!(await requestResult(store.get('settings')))) store.put(defaultSettings());
    await transactionDone(tx);
  }

  #requireDb(): IDBDatabase {
    if (!this.#db) throw new Error('Repository not initialized');
    return this.#db;
  }

  async #get<T>(storeName: string, key: IDBValidKey): Promise<T | undefined> {
    const tx = this.#requireDb().transaction(storeName, 'readonly');
    return (await requestResult(tx.objectStore(storeName).get(key))) as T | undefined;
  }

  async #put<T>(storeName: string, value: T): Promise<void> {
    const tx = this.#requireDb().transaction(storeName, 'readwrite');
    tx.objectStore(storeName).put(value);
    await transactionDone(tx);
  }

  async #delete(storeName: string, key: IDBValidKey): Promise<void> {
    const tx = this.#requireDb().transaction(storeName, 'readwrite');
    tx.objectStore(storeName).delete(key);
    await transactionDone(tx);
  }

  async #all<T>(storeName: string): Promise<T[]> {
    const tx = this.#requireDb().transaction(storeName, 'readonly');
    return (await requestResult(tx.objectStore(storeName).getAll())) as T[];
  }

  async getMetadata() { return (await this.#get<SelahMetadata>(STORES.system, 'metadata')) ?? defaultMetadata(); }
  async setMetadata(v: SelahMetadata) { await this.#put(STORES.system, v); }
  async getSettings() { return (await this.#get<SelahSettings>(STORES.system, 'settings')) ?? defaultSettings(); }
  async setSettings(v: SelahSettings) { await this.#put(STORES.system, v); }
  async listStudies() { return this.#all<Study>(STORES.studies); }
  async getStudy(id: string) { return this.#get<Study>(STORES.studies, id); }
  async putStudy(v: Study) { await this.#put(STORES.studies, v); }
  async deleteStudy(id: string) { await this.#delete(STORES.studies, id); }
  async getStudyDocument(id: string) { return this.#get<StudyDocument>(STORES.documents, id); }
  async putStudyDocument(v: StudyDocument) { await this.#put(STORES.documents, v); }
  async getStudySynthesis(id: string) { return this.#get<StudySynthesis>(STORES.syntheses, id); }
  async putStudySynthesis(v: StudySynthesis) { await this.#put(STORES.syntheses, v); }
  async listAnnotations(studyId?: string) {
    if (!studyId) return this.#all<Annotation>(STORES.annotations);
    const tx = this.#requireDb().transaction(STORES.annotations, 'readonly');
    return (await requestResult(tx.objectStore(STORES.annotations).index('studyId').getAll(studyId))) as Annotation[];
  }
  async putAnnotation(v: Annotation) { await this.#put(STORES.annotations, v); }
  async deleteAnnotation(id: string) { await this.#delete(STORES.annotations, id); }
  async listWorkspaces() { return this.#all<WorkspaceState>(STORES.workspaces); }
  async getWorkspace(id: string) { return this.#get<WorkspaceState>(STORES.workspaces, id); }
  async putWorkspace(v: WorkspaceState) { await this.#put(STORES.workspaces, v); }
  async deleteWorkspace(id: string) { await this.#delete(STORES.workspaces, id); }
  async listPhrasingDocuments(studyId?: string) {
    if (!studyId) return this.#all<PhrasingDocument>(STORES.phrasing);
    const tx = this.#requireDb().transaction(STORES.phrasing, 'readonly');
    return (await requestResult(tx.objectStore(STORES.phrasing).index('studyId').getAll(studyId))) as PhrasingDocument[];
  }
  async getPhrasingDocument(id: string) { return this.#get<PhrasingDocument>(STORES.phrasing, id); }
  async putPhrasingDocument(v: PhrasingDocument) { await this.#put(STORES.phrasing, v); }
  async deletePhrasingDocument(id: string) { await this.#delete(STORES.phrasing, id); }

  async exportSnapshot(): Promise<SelahSnapshot> {
    return {
      metadata: await this.getMetadata(),
      settings: await this.getSettings(),
      studies: await this.listStudies(),
      studyDocuments: await this.#all<StudyDocument>(STORES.documents),
      studySyntheses: await this.#all<StudySynthesis>(STORES.syntheses),
      annotations: await this.listAnnotations(),
      workspaceStates: await this.listWorkspaces(),
      phrasingDocuments: await this.listPhrasingDocuments(),
    };
  }

  async importSnapshot(snapshot: SelahSnapshot, mode: 'replace' | 'merge' = 'replace'): Promise<void> {
    const db = this.#requireDb();
    const names = Object.values(STORES);
    const tx = db.transaction(names, 'readwrite');
    if (mode === 'replace') {
      for (const name of names) tx.objectStore(name).clear();
    }
    tx.objectStore(STORES.system).put(snapshot.metadata);
    tx.objectStore(STORES.system).put(snapshot.settings);
    for (const v of snapshot.studies) tx.objectStore(STORES.studies).put(v);
    for (const v of snapshot.studyDocuments) tx.objectStore(STORES.documents).put(v);
    for (const v of snapshot.studySyntheses ?? []) tx.objectStore(STORES.syntheses).put(v);
    for (const v of snapshot.annotations) tx.objectStore(STORES.annotations).put(v);
    for (const v of snapshot.workspaceStates) tx.objectStore(STORES.workspaces).put(v);
    for (const v of snapshot.phrasingDocuments ?? []) tx.objectStore(STORES.phrasing).put(v);
    await transactionDone(tx);
  }
}

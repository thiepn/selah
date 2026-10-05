import { APP_SCHEMA_VERSION, type SelahSnapshot } from './types.js';

export interface BackupEnvelope {
  format: 'selah-backup';
  formatVersion: 1;
  exportedAt: string;
  appSchemaVersion: number;
  snapshot: SelahSnapshot;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

function requireArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`Invalid Selah backup: ${label} must be an array`);
  return value;
}

function validateSnapshotShape(value: unknown): asserts value is Partial<SelahSnapshot> & Pick<SelahSnapshot,'metadata'|'settings'> {
  if (!isRecord(value)) throw new Error('Invalid Selah backup: snapshot must be an object');
  if (!isRecord(value.metadata) || value.metadata.id !== 'metadata') throw new Error('Invalid Selah backup: metadata is missing or malformed');
  if (!Number.isInteger(value.metadata.appSchemaVersion) || Number(value.metadata.appSchemaVersion) < 1) throw new Error('Invalid Selah backup: app schema version is missing');
  if (Number(value.metadata.appSchemaVersion) > APP_SCHEMA_VERSION) throw new Error(`This Selah backup uses newer schema ${value.metadata.appSchemaVersion}; update Selah before importing it`);
  if (!isRecord(value.settings) || value.settings.id !== 'settings') throw new Error('Invalid Selah backup: settings are missing or malformed');
  if (!['light','dark','system'].includes(String(value.settings.theme))) throw new Error('Invalid Selah backup: theme setting is malformed');
  if (typeof value.settings.primaryTranslationId !== 'string') throw new Error('Invalid Selah backup: primary translation is malformed');
  if (typeof value.settings.fontScale !== 'number' || !Number.isFinite(value.settings.fontScale)) throw new Error('Invalid Selah backup: font scale is malformed');
  for (const key of ['studies','studyDocuments','studySyntheses','studyOutlines','reviewCards','annotations','workspaceStates','phrasingDocuments'] as const) {
    const item=value[key];
    if (item !== undefined) requireArray(item,key);
  }
}

export function createBackup(snapshot: SelahSnapshot, now = new Date()): BackupEnvelope {
  return {
    format: 'selah-backup',
    formatVersion: 1,
    exportedAt: now.toISOString(),
    appSchemaVersion: APP_SCHEMA_VERSION,
    snapshot: structuredClone(snapshot),
  };
}

export function migrateSnapshot(snapshot: SelahSnapshot | (Partial<SelahSnapshot> & Pick<SelahSnapshot,'metadata'|'settings'>)): SelahSnapshot {
  validateSnapshotShape(snapshot);
  return {
    metadata: { ...structuredClone(snapshot.metadata), appSchemaVersion: APP_SCHEMA_VERSION },
    settings: structuredClone(snapshot.settings),
    studies: structuredClone(snapshot.studies ?? []),
    studyDocuments: structuredClone(snapshot.studyDocuments ?? []),
    studySyntheses: structuredClone(snapshot.studySyntheses ?? []),
    studyOutlines: structuredClone(snapshot.studyOutlines ?? []),
    reviewCards: structuredClone(snapshot.reviewCards ?? []),
    annotations: structuredClone(snapshot.annotations ?? []),
    workspaceStates: structuredClone(snapshot.workspaceStates ?? []),
    phrasingDocuments: structuredClone(snapshot.phrasingDocuments ?? []),
  };
}

export function parseBackup(json: string): BackupEnvelope {
  let value: unknown;
  try { value = JSON.parse(json); }
  catch { throw new Error('Invalid Selah backup: file is not valid JSON'); }
  if (!isRecord(value) || value.format !== 'selah-backup' || value.formatVersion !== 1 || !('snapshot' in value)) {
    throw new Error('Unsupported or invalid Selah backup');
  }
  const snapshot=value.snapshot;
  validateSnapshotShape(snapshot);
  const migrated=migrateSnapshot(snapshot);
  return {
    format:'selah-backup',
    formatVersion:1,
    exportedAt:typeof value.exportedAt==='string'?value.exportedAt:new Date(0).toISOString(),
    appSchemaVersion:APP_SCHEMA_VERSION,
    snapshot:migrated,
  };
}

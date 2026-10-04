import test from 'node:test';
import assert from 'node:assert/strict';
import { parseReference } from '../dist/src/domain/references/index.js';
import { MemorySelahRepository, createBackup, parseBackup } from '../dist/src/persistence/index.js';

test('snapshot export/import round-trips durable study state', async () => {
  const repo = new MemorySelahRepository();
  await repo.initialize();
  const now = 1700000000000;
  const passage = parseReference('Phil 2:5-11').passage;
  await repo.putStudy({ id: 'study-1', primaryPassage: passage, tags: ['christology'], archived: false, createdAt: now, updatedAt: now });
  await repo.putAnnotation({
    id: 'note-1', studyId: 'study-1', kind: 'note',
    anchor: { type: 'reference', passage: { start: passage.start, end: passage.start } },
    body: 'Observe the movement from humiliation to exaltation.', tags: [], createdAt: now, updatedAt: now,
  });
  const snapshot = await repo.exportSnapshot();
  const backup = parseBackup(JSON.stringify(createBackup(snapshot, new Date('2026-10-03T10:00:00Z'))));
  const restored = new MemorySelahRepository();
  await restored.initialize();
  await restored.importSnapshot(backup.snapshot);
  assert.deepEqual(await restored.exportSnapshot(), snapshot);
});

test('older backups migrate missing phrasing state forward safely', () => {
  const legacy = JSON.stringify({
    format:'selah-backup',formatVersion:1,exportedAt:'2026-01-01T00:00:00.000Z',appSchemaVersion:1,
    snapshot:{
      metadata:{id:'metadata',appSchemaVersion:1,dataSchemaVersion:1,updatedAt:1},
      settings:{id:'settings',theme:'system',primaryTranslationId:'BSB',fontScale:1},
      studies:[],studyDocuments:[],annotations:[],workspaceStates:[]
    }
  });
  const parsed=parseBackup(legacy);
  assert.deepEqual(parsed.snapshot.phrasingDocuments,[]);
  assert.equal(parsed.snapshot.metadata.appSchemaVersion,2);
});


test('backup parser rejects corrupt and future-schema data before destructive import', () => {
  assert.throws(()=>parseBackup('{broken'),/not valid JSON/);
  const future={
    format:'selah-backup',formatVersion:1,exportedAt:'2026-10-03T00:00:00Z',appSchemaVersion:99,
    snapshot:{metadata:{id:'metadata',appSchemaVersion:99,dataSchemaVersion:1,updatedAt:1},settings:{id:'settings',theme:'system',primaryTranslationId:'BSB',fontScale:1},studies:[],studyDocuments:[],annotations:[],workspaceStates:[],phrasingDocuments:[]}
  };
  assert.throws(()=>parseBackup(JSON.stringify(future)),/newer schema/);
  const malformed={...future,appSchemaVersion:2,snapshot:{...future.snapshot,metadata:{...future.snapshot.metadata,appSchemaVersion:2},studies:'not-an-array'}};
  assert.throws(()=>parseBackup(JSON.stringify(malformed)),/studies must be an array/);
});

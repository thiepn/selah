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
  await repo.putStudySynthesis({studyId:'study-1',mainIdea:'Christ moves from humiliation to exaltation.',explanation:'Paul presents Christ as the pattern for humble obedience.',evidence:'Philippians 2:6-11',application:'Choose humble service.',prayer:'Form this mind in me.',confidence:'clear',updatedAt:now});
  await repo.putStudyOutline({studyId:'study-1',sections:[{id:'o1',passage:parseReference('Phil 2:5-8').passage,label:'Christ humbles himself'},{id:'o2',passage:parseReference('Phil 2:9-11').passage,label:'God exalts Christ'}],updatedAt:now});
  await repo.putBookSynthesis({bookId:'PHP',understanding:'Philippians presents Christ-shaped humility and joy in gospel partnership.',updatedAt:now});
  await repo.putInterpretationClaim({id:'claim-1',studyId:'study-1',claim:'Christ’s humiliation grounds the church’s call to humility.',confidence:'clear',evidence:[{id:'e1',passage:parseReference('Phil 2:5-8').passage,note:'The appeal points to the mind of Christ.'}],createdAt:now,updatedAt:now});
  await repo.putReviewCard({id:'r1',studyId:'study-1',source:'main-idea',prompt:'What is the main idea?',answer:'Christ moves from humiliation to exaltation.',stage:0,dueAt:now,history:[],createdAt:now,updatedAt:now});
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

test('older backups migrate missing phrasing and synthesis state forward safely', () => {
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
  assert.deepEqual(parsed.snapshot.studySyntheses,[]);
  assert.deepEqual(parsed.snapshot.studyOutlines,[]);
  assert.deepEqual(parsed.snapshot.bookSyntheses,[]);
  assert.deepEqual(parsed.snapshot.interpretationClaims,[]);
  assert.deepEqual(parsed.snapshot.reviewCards,[]);
  assert.equal(parsed.snapshot.metadata.appSchemaVersion,7);
});


test('backup parser rejects corrupt and future-schema data before destructive import', () => {
  assert.throws(()=>parseBackup('{broken'),/not valid JSON/);
  const future={
    format:'selah-backup',formatVersion:1,exportedAt:'2026-10-03T00:00:00Z',appSchemaVersion:99,
    snapshot:{metadata:{id:'metadata',appSchemaVersion:99,dataSchemaVersion:1,updatedAt:1},settings:{id:'settings',theme:'system',primaryTranslationId:'BSB',fontScale:1},studies:[],studyDocuments:[],annotations:[],workspaceStates:[],phrasingDocuments:[]}
  };
  assert.throws(()=>parseBackup(JSON.stringify(future)),/newer schema/);
  const malformed={...future,appSchemaVersion:7,snapshot:{...future.snapshot,metadata:{...future.snapshot.metadata,appSchemaVersion:7},studies:'not-an-array'}};
  assert.throws(()=>parseBackup(JSON.stringify(malformed)),/studies must be an array/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { parseReference, formatPassage } from '../dist/src/domain/references/index.js';
import { MemorySelahRepository } from '../dist/src/persistence/index.js';
import { StudyService, WorkspaceService } from '../dist/src/study/index.js';

const p = (x) => parseReference(x).passage;

test('study and workspace services preserve durable work and research navigation', async () => {
  const repo = new MemorySelahRepository();
  const studyService = new StudyService(repo, { idFactory:()=> 's1', now:()=> 10 });
  const workspaceService = new WorkspaceService(repo, { idFactory:()=> 'w1', now:()=> 10 });
  const study = await studyService.create(p('Phil 2:5-11'));
  assert.equal(study.title, 'Philippians 2:5–11');
  let workspace = await workspaceService.create(study.primaryPassage, 'BSB', study.id);
  await workspaceService.markLastOpened(workspace);
  workspace = await workspaceService.navigate(workspace, p('Isa 45:23'));
  workspace = await workspaceService.back(workspace);
  assert.equal(formatPassage(workspace.primaryPassage), 'Philippians 2:5–11');
  workspace = await workspaceService.forward(workspace);
  assert.equal(formatPassage(workspace.primaryPassage), 'Isaiah 45:23');
  assert.equal((await workspaceService.restoreLast()).id, 'w1');
});


test('studies can be renamed and archived without changing their primary passage', async () => {
  const repo = new MemorySelahRepository();
  const clock=(()=>{let n=20;return()=>++n;})();
  const service = new StudyService(repo,{idFactory:()=> 'manage-1',now:clock});
  const study = await service.create(p('John 15:1-17'));
  const renamed = await service.rename(study.id,'Abiding in Christ');
  assert.equal(renamed.title,'Abiding in Christ');
  assert.deepEqual(renamed.primaryPassage,study.primaryPassage);
  const archived = await service.setArchived(study.id,true);
  assert.equal(archived.archived,true);
  assert.equal((await service.recent()).length,0);
});

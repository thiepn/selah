import test from 'node:test';
import assert from 'node:assert/strict';
import { parseReference } from '../dist/src/domain/references/index.js';
import { MemorySelahRepository } from '../dist/src/persistence/index.js';
import { AnnotationService } from '../dist/src/annotations/index.js';
import { StudyService, WorkspaceService, OutlineService, TopicOverviewService } from '../dist/src/study/index.js';
import { InterpretationClaimService } from '../dist/src/study/claims/index.js';
import { defaultLiteraryMode } from '../dist/src/study/observation/index.js';
import { ReviewService } from '../dist/src/review/index.js';

const p=(value)=>parseReference(value).passage;

test('real study workflow keeps observation structure interpretation synthesis review and recall under one study',async()=>{
  const repo=new MemorySelahRepository();
  await repo.initialize();
  let ids=0;
  const studyService=new StudyService(repo,{idFactory:()=>`study-${++ids}`,now:()=>10});
  const annotationService=new AnnotationService(repo,{idFactory:()=>`annotation-${++ids}`,now:()=>20});
  const outlineService=new OutlineService(repo);
  const claimService=new InterpretationClaimService(repo,{idFactory:()=>`claim-${++ids}`,now:()=>30});
  const reviewService=new ReviewService(repo,{idFactory:()=>`review-${++ids}`,now:()=>40});
  const topicService=new TopicOverviewService(repo);

  let study=await studyService.create(p('Phil 2:5-11'),'Christ hymn');
  study=await studyService.updateMetadata(study.id,{title:'Christ-shaped humility',tags:[' #Christology ',' Humility ']});
  assert.deepEqual(study.tags,['Christology','Humility']);

  await annotationService.createReferenceNote(p('Phil 2:5-8'),'Paul moves from appeal to Christ’s example.',study.id);
  await annotationService.createQuestion(p('Phil 2:9-11'),'How does the therefore connect humiliation and exaltation?',study.id);
  const outline=await outlineService.save(study,[
    {id:'o1',passage:p('Phil 2:5-8'),label:'Christ humbles himself'},
    {id:'o2',passage:p('Phil 2:9-11'),label:'God exalts Christ'},
  ],31);
  await claimService.create(study.id,{
    statement:'Christ’s self-humbling grounds Paul’s appeal to the church.',
    confidence:'strong-inference',
    evidence:[{passage:p('Phil 2:5-8'),note:'The appeal immediately introduces Christ’s mindset and action.'}],
  });
  const synthesis={
    studyId:study.id,
    mainIdea:'The church is called to Christ-shaped humility.',
    explanation:'Paul grounds the communal appeal in Christ’s self-humbling and exaltation.',
    evidence:'Philippians 2:5–11',
    application:'Reject status-seeking and serve others.',
    prayer:'Form the mind of Christ in us.',
    confidence:'clear',
    updatedAt:32,
  };
  await repo.putStudySynthesis(synthesis);
  const review=await reviewService.syncFromSynthesis(study,synthesis,outline);
  assert.deepEqual(review,{created:5,updated:0,deleted:0});

  const topic=await topicService.overview('christology');
  assert.equal(topic.studies.length,1);
  assert.equal(topic.studies[0].id,study.id);
  assert.equal(topic.claims.length,1);
  assert.equal(topic.unresolvedQuestions.length,1);
  assert.equal((await reviewService.due(40)).length,5);

  const snapshot=await repo.exportSnapshot();
  const restored=new MemorySelahRepository();
  await restored.initialize();
  await restored.importSnapshot(snapshot,'replace');
  const restoredStudy=await new StudyService(restored).forPassage(p('Phil 2:5-11'));
  assert.equal(restoredStudy?.id,study.id);
  const restoredTopic=await new TopicOverviewService(restored).overview('Christology');
  assert.equal(restoredTopic.claims.length,1);
  assert.equal(restoredTopic.unresolvedQuestions.length,1);
  assert.equal((await restored.listReviewCards(study.id)).length,5);
});

test('research navigation can detach and reattach exact study ownership without contaminating another passage',async()=>{
  const repo=new MemorySelahRepository();
  await repo.initialize();
  let seq=0;
  const studies=new StudyService(repo,{idFactory:()=>`s${++seq}`,now:()=>seq});
  const workspaces=new WorkspaceService(repo,{idFactory:()=>`w${++seq}`,now:()=>seq});
  const phil=await studies.create(p('Phil 2:5-11'),'Philippians study');
  const romans=await studies.create(p('Rom 8:1-4'),'Romans study');
  let workspace=await workspaces.create(phil.primaryPassage,'BSB',phil.id);

  workspace=await workspaces.navigate(workspace,p('Isa 45:23'));
  assert.equal(await studies.forPassage(workspace.primaryPassage),undefined);

  workspace=await workspaces.back(workspace);
  assert.equal((await studies.forPassage(workspace.primaryPassage))?.id,phil.id);

  workspace=await workspaces.navigate(workspace,romans.primaryPassage);
  assert.equal((await studies.forPassage(workspace.primaryPassage))?.id,romans.id);

  await studies.setArchived(romans.id,true);
  assert.equal(await studies.forPassage(romans.primaryPassage),undefined);
});

test('real-study qualification covers all eight literary defaults used by the Guide',async()=>{
  const matrix=[
    ['Gen 22:1-14','narrative'],
    ['Mark 4:1-20','gospel'],
    ['Deut 6:4-9','law'],
    ['Ps 23:1-6','poetry'],
    ['Prov 3:1-12','wisdom'],
    ['Isa 6:1-8','prophecy'],
    ['Phil 2:5-11','epistle'],
    ['Rev 4:1-11','apocalyptic'],
  ];
  const repo=new MemorySelahRepository();
  await repo.initialize();
  let seq=0;
  const service=new StudyService(repo,{idFactory:()=>`genre-${++seq}`,now:()=>seq});
  for(const [reference,mode] of matrix){
    const passage=p(reference);
    assert.equal(defaultLiteraryMode(passage),mode,reference);
    const study=await service.create(passage,`${mode} qualification`);
    assert.equal((await service.forPassage(passage))?.id,study.id);
  }
  assert.equal((await repo.listStudies()).length,8);
});

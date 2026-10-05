import test from 'node:test';
import assert from 'node:assert/strict';
import { MemorySelahRepository } from '../dist/src/persistence/index.js';
import { BookSynthesisService } from '../dist/src/study/book-synthesis/index.js';

test('book synthesis persists one evolving personal understanding per canonical book',async()=>{
  const repo=new MemorySelahRepository();
  await repo.initialize();
  const service=new BookSynthesisService(repo);
  const first=await service.save('PHP','Christ-shaped humility and gospel partnership.',10);
  assert.equal(first.bookId,'PHP');
  assert.equal((await service.get('PHP')).understanding,first.understanding);
  const revised=await service.save('PHP','Joyful gospel partnership is shaped by the mind of Christ.',20);
  assert.equal(revised.updatedAt,20);
  assert.equal((await repo.listBookSyntheses()).length,1);
  assert.equal((await service.get('PHP')).understanding,revised.understanding);
});

test('book synthesis rejects unknown books and oversized understanding text',async()=>{
  const repo=new MemorySelahRepository();
  await repo.initialize();
  const service=new BookSynthesisService(repo);
  await assert.rejects(()=>service.save('NOPE','x'),/Unknown Bible book/);
  await assert.rejects(()=>service.save('PHP','x'.repeat(12001)),/12,000 characters/);
});

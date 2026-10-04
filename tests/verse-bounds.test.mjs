import test from 'node:test';
import assert from 'node:assert/strict';
import { VerseBoundsIndex, parseReference } from '../dist/src/domain/references/index.js';

test('verse bounds adds exact validation without coupling parser to a dataset',()=>{
 const bounds=new VerseBoundsIndex({PHP:{2:11}});
 bounds.validatePassage(parseReference('Phil 2:5-11').passage);
 assert.throws(()=>bounds.validatePassage(parseReference('Phil 2:12').passage),/no verse 12/);
});

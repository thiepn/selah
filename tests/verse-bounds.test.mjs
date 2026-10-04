import test from 'node:test';
import assert from 'node:assert/strict';
import { VerseBoundsIndex, parseReference } from '../dist/src/domain/references/index.js';

test('verse bounds adds exact validation without coupling parser to a dataset',()=>{
 const bounds=new VerseBoundsIndex({PHP:{2:11}});
 bounds.validatePassage(parseReference('Phil 2:5-11').passage);
 assert.throws(()=>bounds.validatePassage(parseReference('Phil 2:12').passage),/no verse 12/);
});


test('exact presence rejects omitted verse numbers without treating the chapter as truncated',()=>{
 const bounds=new VerseBoundsIndex(
   {ACT:{8:40},JHN:{5:47}},
   {ACT:{8:[35,36,38,39,40]},JHN:{5:[1,2,3,5,6,47]}}
 );
 bounds.validatePassage(parseReference('Acts 8:36').passage);
 bounds.validatePassage(parseReference('Acts 8:38').passage);
 assert.throws(()=>bounds.validatePassage(parseReference('Acts 8:37').passage),/not present in this translation/);
 assert.throws(()=>bounds.validatePassage(parseReference('John 5:4').passage),/not present in this translation/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBsbUsjDocument } from '../dist/src/data/bsb/usj.js';

test('USJ parser preserves canonical verses and excludes notes/headings from Scripture text', () => {
  const usj={
    type:'USJ',
    version:'3.1',
    content:[
      {type:'book',marker:'id',code:'PSA',content:'Psalms'},
      {type:'chapter',marker:'c',number:'23'},
      {type:'para',marker:'s1',content:['The LORD Is My Shepherd']},
      {type:'para',marker:'d',content:['A Psalm of David.']},
      {type:'para',marker:'q1',content:[
        {type:'verse',marker:'v',number:'1'},
        {type:'char',marker:'nd',content:['The LORD']},
        ' is my shepherd; I shall not want.',
        {type:'note',marker:'f',content:['not Scripture']},
      ]},
      {type:'para',marker:'q1',content:[
        {type:'verse',marker:'v',number:'2'},
        'He makes me lie down in green pastures.'
      ]},
    ]
  };
  const parsed=parseBsbUsjDocument(usj);
  assert.equal(parsed.book,'PSA');
  assert.equal(parsed.chapters[23][1].text,'The LORD is my shepherd; I shall not want.');
  assert.equal(parsed.chapters[23][2].text,'He makes me lie down in green pastures.');
  assert.deepEqual(parsed.chapters[23][1].headings,[
    {level:'s1',text:'The LORD Is My Shepherd'},
    {level:'d',text:'A Psalm of David.'},
  ]);
  assert.deepEqual(parsed.chapters[23][1].para,['q1']);
});

test('USJ parser handles verse content nested directly in a verse node', () => {
  const parsed=parseBsbUsjDocument({
    type:'USJ',
    content:[
      {type:'book',code:'JHN'},
      {type:'chapter',number:1},
      {type:'para',marker:'p',content:[
        {type:'verse',number:1,content:['In the beginning was the Word.']}
      ]}
    ]
  });
  assert.equal(parsed.chapters[1][1].text,'In the beginning was the Word.');
});

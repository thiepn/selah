import test from 'node:test';
import assert from 'node:assert/strict';
import { connectedReferenceCardHtml, personalStudyLinksHtml } from '../web/personal-reference-ui.js';

test('personal study recall deduplicates studies while keeping overflow reachable', () => {
  const html=personalStudyLinksHtml([
    {id:'a',title:'Alpha'},
    {id:'b',title:'Beta'},
    {id:'b',title:'Duplicate Beta'},
    {id:'c',title:'Gamma'},
    {id:'d',title:'Delta'},
  ],'Fallback',3);

  assert.equal((html.match(/data-personal-snapshot=/g)??[]).length,4);
  assert.equal((html.match(/data-personal-overflow hidden/g)??[]).length,1);
  assert.match(html,/data-personal-expand/);
  assert.match(html,/aria-label="Show 1 more prior studies"/);
  assert.match(html,/\+1 more/);
  assert.doesNotMatch(html,/Duplicate Beta/);
});

test('personal study recall escapes user-authored labels and ids', () => {
  const html=personalStudyLinksHtml([{id:'study"<1',title:'<John & Co>'}],'Fallback');
  assert.match(html,/data-personal-snapshot="study&quot;&lt;1"/);
  assert.match(html,/Studied · &lt;John &amp; Co&gt;/);
  assert.doesNotMatch(html,/<John & Co>/);
});

test('connected reference cards keep reference navigation and prior-study recall together', () => {
  const html=connectedReferenceCardHtml({
    label:'Romans 8:1',
    detail:'Referenced from this passage',
    reference:'Romans 8:1',
    studies:[{id:'rom8',title:'Life in the Spirit'}],
  });
  assert.match(html,/data-reference="Romans 8:1"/);
  assert.match(html,/data-personal-snapshot="rom8"/);
  assert.doesNotMatch(html,/data-personal-expand/);
});

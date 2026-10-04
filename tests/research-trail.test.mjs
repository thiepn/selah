import test from 'node:test';
import assert from 'node:assert/strict';
import { createResearchTrail, currentResearchLocation, goBack, goForward, pushResearchLocation } from '../dist/src/domain/studies/index.js';
import { parseReference, formatPassage } from '../dist/src/domain/references/index.js';

const ref = (input) => parseReference(input).passage;

test('research trail preserves navigation and truncates forward history on branch', () => {
  let trail = createResearchTrail({ passage: ref('Phil 2:10') });
  trail = pushResearchLocation(trail, { passage: ref('Isa 45:23') });
  trail = pushResearchLocation(trail, { passage: ref('Rom 14:11') });
  trail = goBack(trail);
  assert.equal(formatPassage(currentResearchLocation(trail).passage), 'Isaiah 45:23');
  trail = pushResearchLocation(trail, { passage: ref('Isa 45:24') });
  assert.equal(trail.entries.length, 3);
  assert.equal(formatPassage(currentResearchLocation(trail).passage), 'Isaiah 45:24');
  assert.equal(goForward(trail).index, trail.index);
});

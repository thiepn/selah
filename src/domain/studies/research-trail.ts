import type { ResearchLocation, ResearchTrail } from './types.js';

export function createResearchTrail(initial: ResearchLocation): ResearchTrail {
  return { entries: [structuredClone(initial)], index: 0 };
}

export function pushResearchLocation(trail: ResearchTrail, location: ResearchLocation): ResearchTrail {
  const entries = trail.entries.slice(0, trail.index + 1);
  entries.push(structuredClone(location));
  return { entries, index: entries.length - 1 };
}

export function canGoBack(trail: ResearchTrail): boolean {
  return trail.index > 0;
}

export function canGoForward(trail: ResearchTrail): boolean {
  return trail.index < trail.entries.length - 1;
}

export function goBack(trail: ResearchTrail): ResearchTrail {
  return canGoBack(trail) ? { ...trail, index: trail.index - 1 } : trail;
}

export function goForward(trail: ResearchTrail): ResearchTrail {
  return canGoForward(trail) ? { ...trail, index: trail.index + 1 } : trail;
}

export function currentResearchLocation(trail: ResearchTrail): ResearchLocation | undefined {
  return trail.entries[trail.index];
}

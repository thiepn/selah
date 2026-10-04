# Implementation status

## Complete or substantially implemented

### P0–P9 — foundation and core study

- product contract and Bible-study-only scope
- reproducible data-source/license manifests
- canonical reference domain
- optional exact verse-bound index
- shared PassageContext
- versioned IndexedDB persistence
- Scripture and personal-study search engines
- BSB display-data provider
- deployable Scripture reader/workspace
- durable annotation anchors
- Study / Study Document / Workspace separation
- Research Trail back/forward behavior and reference Peek

### P10–P18 — close reading and research

- repeated English-word and Strong's pattern analysis
- token-preserving Phrasing tree model, clause splitting/merging, indentation, labels, and persistence
- bidirectional cross-reference engine (outgoing references + incoming backlinks)
- contextual Lens
- Guide aggregator over shared services, including previous/current/next literary section context
- lexicon provider
- morphology provider
- Strong's concordance provider
- original-language composition service
- translation-provider registry and comparison service
- external resource providers
- external-AI Markdown handoff without API calls

### P19–P23 — usability, offline, ownership

- study archive/search drawer
- mobile Bible-first study-sheet layout
- PWA service worker and runtime Scripture caching
- full backup/restore with forward migration
- Markdown study-context export
- keyboard navigation basics and accessible semantic controls

## Production data pipeline

- full BSB data vendoring via shallow Git clone
- current BSB chapter JSON + historical JSONL display compatibility
- generated exact verse bounds
- generated Scripture search index
- vendored-data integrity validation
- development fixture isolated from generated production data
- Vercel production-build command
- generated reverse cross-reference index
- path-scoped + weekly upstream compatibility workflow

## Verification currently passing

- strict TypeScript core compilation
- source manifest/license validation
- automated Node test suite (38 tests currently passing)
- static application build/integrity validation
- bundle-size budgets for deployable JS/CSS
- backup corruption and future-schema rejection
- local HTTP serving smoke check

## Open qualification work

- full production data workflow must pass against the current upstream BSB dataset
- browser rendering automation is blocked by administrator browser policy in this environment
- full real-device mobile study qualification
- full screen-reader certification (keyboard-resizable panes and semantic toggle state are implemented)
- full-production-data performance measurements (static application bundle budgets are enforced)
- additional translation providers where redistribution terms permit
- V1 multi-genre real-study certification

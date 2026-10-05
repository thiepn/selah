# Implementation status

## Complete or substantially implemented

### P0–P9 — foundation and core study

- product contract and Bible-study-only scope
- reproducible data-source/license manifests
- canonical reference domain with translation-aware exact verse bounds and exact verse-presence maps
- shared PassageContext
- versioned IndexedDB persistence
- Scripture and personal-study search engines
- lazy off-main-thread Scripture search worker with offline precaching
- BSB Scripture provider
- deployable Scripture reader/workspace
- durable annotation anchors, including translation-scoped multi-verse text ranges
- multi-verse notes and highlights, including cross-chapter selections
- Study / Study Document / Passage Outline / Synthesis / Workspace separation
- Research Trail back/forward behavior and reference Peek
- explicit previous/next Bible chapter navigation
- visible chapter boundaries inside cross-chapter passage studies

### P10–P18 — close reading and research

- repeated English-word and Strong's pattern analysis
- high-confidence textual discourse-marker observation aids
- deterministic text-derived observation questions for repetition, logic, structure, explicit claims, and anti-assumption checks
- observation prompts can highlight their source tokens and be saved as passage-anchored study questions
- study questions preserve separate multiline responses that remain searchable and exportable
- token-preserving Phrasing tree model, clause splitting/merging, indentation, labels, and persistence
- bidirectional cross-reference engine (outgoing references + incoming backlinks)
- contextual Lens
- Guide aggregator over shared services, including previous/current/next literary section context
- human-readable Guide lexical entries (lemma, transliteration, gloss, Strong's key, frequency)
- Guide lexical discovery from original-language tokens when conservative English alignment is unavailable
- lexicon provider
- morphology provider
- Strong's concordance provider
- original-language composition service
- translation-provider registry and comparison service
- external resource providers
- external-AI Markdown handoff without API calls

### P19–P23 — usability, offline, ownership

- Bible-book-grouped study archive/search drawer with recoverable archived studies
- rename/archive/restore study management
- mobile Bible-first study-sheet layout
- PWA service worker with network-first freshness and offline fallback
- full backup/restore with forward migration
- Markdown study-context export
- keyboard navigation basics and accessible semantic controls
- resizable keyboard-operable desktop panes
- semantic, arrow-key-operable study tablist
- keyboard-first Scripture annotation shortcuts that stay disabled while editing
- durable Passage Outline with validated in-passage, non-overlapping verse units; manual creation, selection-to-outline, editorial-heading seeding, Guide/Synthesis handoff, and visible Bible-pane boundaries
- structured Synthesis workflow: Main idea → Explain → Evidence → Confidence → Apply → Pray
- deterministic study-derived review cards with 1d / 7d / 30d / 90d / 180d scheduling, including a completed passage-outline retrieval card
- review-card history embedded per card and searchable with personal study content

## Production data pipeline

- full BSB data vendoring via shallow Git clone
- official BSB USJ canonical English-text normalization
- official BSB versification treated as translation authority; generic-English differences are recorded rather than silently coerced
- current BSB chapter JSON + historical JSONL display compatibility
- generated exact BSB verse bounds and verse-presence maps
- generated Scripture search index
- vendored-data integrity validation
- canonical Strong's concordance generation
- semantic full-data research smoke across seven biblical genres, original-language tokens, Hebrew morphology, lexicon/concordance, and bidirectional references
- development fixture isolated from generated production data
- Vercel production-build command
- generated reverse cross-reference index
- path-scoped + weekly upstream compatibility workflow
- production data-size budgets enforced in CI and production builds

## Verification currently passing

- strict TypeScript core compilation
- source manifest/license validation
- automated Node test suite: **59/59 passing** on the current head
- static application build/integrity validation
- browser JavaScript syntax validation for app, search worker, and service worker
- application bundle-size budgets
- backup corruption and future-schema rejection
- local HTTP serving smoke check
- full upstream BSB production qualification succeeds
- full BSB corpus: **1,189 chapters / 30,969 verse records**
- canonical Strong's concordance: **13,859 lexical keys**
- reverse Scripture-reference index: **430,204 edges / 30,034 target verses**
- semantic production-data smoke across seven biblical genres
- production payload qualification:
  - BSB research pack: **135.75 MiB / 3,599 files**
  - Scripture search index: **17.22 MiB**
  - reverse-reference index: **5.00 MiB**
  - Strong's concordance: **4.14 MiB**
  - complete static site: **153.14 MiB / 3,668 files**
- current application code remains small relative to data: about **84 KiB app JS + 114 KiB core JS + 30 KiB CSS** before compression

## Open qualification work

- browser rendering automation remains blocked by administrator browser policy in the implementation environment
- full real-device mobile study qualification
- full screen-reader certification beyond the implemented semantic/keyboard improvements
- additional translation providers where redistribution terms permit
- V1 human multi-genre real-study certification

## Product boundaries still enforced

Selah intentionally has no Today/dashboard surface, streak system, prayer manager, reading-plan layer, social feed, sermon manager, or built-in AI dependency. Observation prompts ask text-grounded questions but do not generate interpretation. Review exists only as a retention layer for conclusions and structure the user deliberately created. The default experience remains Scripture first, with study tools operating contextually around the passage.

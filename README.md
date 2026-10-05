# Selah

Selah is a local-first, passage-centered Bible study workspace for close reading, observation, cross-reference study, original-language investigation, structural analysis, durable synthesis, and long-term retention.

It intentionally has no Today page, dashboard, streaks, reading-plan layer, prayer manager, social feed, or built-in AI dependency. The primary UI is the Scripture study workspace.

## Product model

Selah is built around eleven primitives:

1. canonical Scripture references
2. shared passage/selection context
3. source-independent Scripture and research providers
4. durable annotation anchors
5. studies, freeform study documents, passage outlines, interpretation claims, and structured synthesis
6. recoverable workspace/research state
7. evidence-classified interpretation claims tied back to the studied passage
8. study-derived and custom spaced review cards
9. study snapshots for fast revisitation
10. derived book overviews with one evolving personal book understanding
11. versioned local persistence, backup, and migration

Every study tool consumes those primitives instead of maintaining its own competing state.

## Current implementation

Implemented and wired into the deployable static application:

- 66-book canonical reference parser and formatter
- exact verse-bound validation when the full data pack is present
- BSB Scripture provider with stable token IDs and original-language tokens
- passage context engine
- native IndexedDB persistence with schema-v7 migration
- Study / Workspace / Research Trail separation
- reference, text, and original-token annotation anchors
- notes, highlights, and answerable passage-anchored questions with unresolved-question continuity into Guide and Synthesis
- persistent Study Document
- durable Passage Outline with validated non-overlapping verse sections, selection-to-outline, editorial-heading seeding, and in-Scripture boundaries
- text-derived observation questions that highlight their evidence without supplying interpretations
- genre-aware observation calibration across Narrative, Gospel, Law, Poetry, Wisdom, Prophecy, Epistle, and Apocalyptic lenses, with reversible per-study overrides
- interpretation Claims workspace with Explicit / Strong inference / Tentative / Disputed support levels and exact in-passage Scripture evidence
- Claims precede Synthesis in the visible study workflow and remain visible inside Synthesis so final explanations stay traceable to explicit user-authored reasoning
- detailed verse evidence lives in Claims; Synthesis keeps only an optional decisive-evidence summary to avoid duplicate data entry
- structured Synthesis for main idea, explanation, evidence, confidence, application, and prayer
- study-derived Review cards with Forgot / Difficult / Good scheduling, including completed passage structure
- custom review cards that remain independent from Synthesis-derived cards
- automatic reconciliation of opted-in derived cards after Synthesis/Outline edits without silently creating new cards
- study-scoped review queues, review-to-source-study remediation, and read-only Study Snapshots
- Study Snapshots now retain support-classified interpretation claims and their evidence references alongside structure and main idea
- persistent Phrasing (token-preserving clause splitting, merging, indentation) documents
- textual and Strong's pattern analysis
- cross-reference provider and in-workspace Peek model
- contextual Lens and Passage Guide
- lexicon, morphology, concordance, and original-language composition layer
- real local verse-aligned translation comparison between primary BSB and public-domain WEB, with explicit missing-verse handling
- Scripture search and source-aware personal search that returns Claims, Outline, Synthesis, Notes, and book understanding to their originating study surface
- Books / Topics archive views with manually curated, normalized study topics
- topic-level cross-study overview derived from explicitly tagged studies, preserving main ideas, support-classified claims/evidence, represented books, and unresolved questions without generated theological conclusions
- personal Book Overviews derived from actual passage studies, recurring topics, main ideas, and unresolved questions
- one autosaved, searchable personal understanding field per canonical Bible book
- external study-resource providers
- copyable external-AI study context with no API dependency, plus optional Copy & open ChatGPT handoff
- study title/topic metadata editing with topic-aware search and Markdown export
- interpretation claims included in personal search, Markdown/AI export, backup/migration, and study-deletion lifecycle
- new claims default to Tentative; Explicit and Strong inference require at least one exact textual-evidence reference
- version-aware full backup/restore
- PWA shell with network-first freshness and offline fallback
- responsive Bible-first desktop/mobile workspace
- browser-JavaScript syntax validation, source-license validation, and CI

## Development build

The repository includes a tiny Philippians 2 fixture so normal verification does not download the entire Bible dataset.

```bash
npm install
npm run build
npm run serve
```

The generated site is in `site/`.

## Full production data

The production build shallow-clones the public BSB data output repository plus the WEB transport mirror, vendors only the datasets Selah uses, validates both translation corpora and source identity, derives exact BSB verse bounds, builds the offline Scripture search index, then builds the app.

```bash
npm run build:production
```

Vercel is configured to use this production command automatically.

Generated Bible data lives under `.generated/` and is deliberately not committed.

## Data and licensing

Runtime data sources are declared in `data/manifests/sources.json`. World English Bible comparison data is normalized from the `midvash/bible-data` transport mirror, whose metadata identifies `https://worldenglish.bible/` as the upstream translation source and the edition as public domain. Selah validates that identity before and after vendoring. Required upstream attribution files are copied into the production data bundle. The application also exposes the bundled attribution through its Resources surface.

## Verification

```bash
npm run check
npm run build:site
```

The critical domain logic is tested independently from the browser UI because anchors, migrations, references, search indexes, and data transforms are the parts most capable of corrupting long-lived study data.

## Release guards

`npm run build` type-checks the core, validates source licensing metadata, runs the automated test suite, validates the static study workspace, and enforces bundle budgets. Backup import rejects malformed data and backups created by a newer unsupported Selah schema before touching IndexedDB.

# Selah

Selah is a local-first, passage-centered Bible study workspace for close reading, observation, cross-reference study, original-language investigation, structural analysis, durable synthesis, and long-term retention.

It intentionally has no Today page, dashboard, streaks, reading-plan layer, prayer manager, social feed, or built-in AI dependency. The primary UI is the Scripture study workspace.

## Product model

Selah is built around eight primitives:

1. canonical Scripture references
2. shared passage/selection context
3. source-independent Scripture and research providers
4. durable annotation anchors
5. studies, freeform study documents, and structured synthesis
6. recoverable workspace/research state
7. study-derived spaced review cards
8. versioned local persistence, backup, and migration

Every study tool consumes those primitives instead of maintaining its own competing state.

## Current implementation

Implemented and wired into the deployable static application:

- 66-book canonical reference parser and formatter
- exact verse-bound validation when the full data pack is present
- BSB Scripture provider with stable token IDs and original-language tokens
- passage context engine
- native IndexedDB persistence with schema migration
- Study / Workspace / Research Trail separation
- reference, text, and original-token annotation anchors
- notes, questions, and highlights
- persistent Study Document
- structured Synthesis for main idea, explanation, evidence, confidence, application, and prayer
- study-derived Review cards with Forgot / Difficult / Good scheduling
- persistent Phrasing (token-preserving clause splitting, merging, indentation) documents
- textual and Strong's pattern analysis
- cross-reference provider and in-workspace Peek model
- contextual Lens and Passage Guide
- lexicon, morphology, concordance, and original-language composition layer
- provider-driven translation comparison
- Scripture search and personal-study search
- external study-resource providers
- copyable external-AI study context with no API dependency
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

The production build shallow-clones the public BSB data output repository, vendors only the datasets Selah uses, derives exact verse bounds, builds the offline Scripture search index, validates the dataset, then builds the app.

```bash
npm run build:production
```

Vercel is configured to use this production command automatically.

Generated Bible data lives under `.generated/` and is deliberately not committed.

## Data and licensing

Runtime data sources are declared in `data/manifests/sources.json`. Required upstream attribution files are copied into the production data bundle. The application also exposes the bundled attribution through its Resources surface.

## Verification

```bash
npm run check
npm run build:site
```

The critical domain logic is tested independently from the browser UI because anchors, migrations, references, search indexes, and data transforms are the parts most capable of corrupting long-lived study data.

## Release guards

`npm run build` type-checks the core, validates source licensing metadata, runs the automated test suite, validates the static study workspace, and enforces bundle budgets. Backup import rejects malformed data and backups created by a newer unsupported Selah schema before touching IndexedDB.

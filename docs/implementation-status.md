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
- unresolved saved questions remain visible in Guide and Synthesis so interpretation does not silently bury open issues
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

- study archive/search drawer with Books and Topics grouping, topic-aware search, and recoverable archived studies
- atomic title + topic metadata editing plus archive/restore study management
- manually curated study topics are normalized, deduplicated, searchable, and included in Markdown exports
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

### P24 — longitudinal recall and study revisitation

- opted-in derived review cards automatically reconcile after Synthesis or Outline edits without surprise card creation
- custom review cards support study-specific retrieval questions and are protected from derived-card synchronization
- study-scoped due-review queues
- review cards identify their source type and can jump directly back to the source study
- read-only Study Snapshot surfaces passage, topics, main idea, structure, unresolved questions, application, and review state inside the existing archive
- snapshot-to-review and snapshot-to-study navigation
- optional one-click Copy & open ChatGPT handoff while plain Markdown export remains provider-independent and API-free

### P25 — book-level synthesis and personal knowledge archive

- IndexedDB / backup schema **v6**
- one durable personal book-understanding record per canonical Bible book
- book overview read model derives active passage studies, their main ideas, recurring manually curated topics, and unresolved questions directly from study data
- Books archive headers open personal Book Overviews rather than a generic encyclopedia page
- book understanding autosaves locally and is included in backup/migration
- personal search indexes book-level understanding
- book overview rendering extracted to an offline-precached UI module with its own enforced bundle budget

### P26 — genre-aware observation calibration & multi-genre qualification

- eight observational study lenses: Narrative, Gospel, Law, Poetry, Wisdom, Prophecy, Epistle, and Apocalyptic
- broad canonical-book defaults serve only as starting lenses; each Study can explicitly override or return to Auto
- genre changes the questions Selah asks without supplying interpretation
- every observation set retains the explicit-text baseline, structural-shift prompt, repeated textual signals, discourse markers, and anti-assumption check
- active lens is visible in Guide and carried into portable study context when explicitly overridden
- Passage Guide service itself is override-aware, not only the UI
- full BSB production smoke qualifies all eight literary defaults against real passages

### P27 — real local translation comparison

- BSB remains Selah's primary study/research translation
- local public-domain World English Bible provider added for comparison only
- verse-aligned Compare surface replaces the former block-style placeholder
- comparison unions verse references and explicitly marks verses not present in an edition instead of shifting text
- WEB runtime data is normalized to compact per-chapter JSON and works offline with no API
- WEB source identity is validated as the expected 66-book public-domain World English Bible before and after normalization
- `midvash/bible-data` is treated only as a transport mirror; `https://worldenglish.bible/` is recorded as the translation upstream
- full production qualification: **1,189 WEB chapters / 31,098 verses**
- WEB comparison payload: **4.09 MiB / 1,192 files**
- real production smoke verifies BSB + WEB together on Philippians 2:5–11

### P28 — interpretation claims & evidence discipline

- IndexedDB / backup schema **v7**
- dedicated Claims study surface between Synthesis and research tools
- claims classify support as Explicit in text / Strong inference / Tentative / Disputed
- every claim can attach exact Scripture evidence with optional evidence notes
- claim evidence is restricted to the current study passage and validated against installed Scripture data
- duplicate evidence references are normalized and runtime support-level values are validated
- claims are searchable alongside studies, notes, outlines, synthesis, review cards, and book understanding
- claims are independently selectable in Markdown / external-AI export
- Claims UI is an extracted, syntax-checked, offline-precached, bundle-budgeted module
- deleting a study now cascades all study-owned durable records consistently in memory and IndexedDB while preserving book-level synthesis

### P29 — interpretation coherence & evidence traceability

- Synthesis displays the user's Interpretation Claims, support classifications, and evidence references before final explanation/application
- new Claims default to **Tentative** instead of implicitly asserting certainty
- **Explicit** and **Strong inference** claims cannot be saved without textual evidence
- exact claim-evidence references resolve through Selah's canonical Scripture validator before persistence
- personal search is extracted into an offline-precached focused UI module
- personal search results are labeled by source type and return directly to Claims, Outline, Synthesis, Notes, or Book Overview as appropriate
- search extraction reduced the main controller below its 100 KB budget while retaining a separate UI-module budget
- Claims-to-Synthesis presentation remains read-only: Selah never promotes or rewrites the user's interpretation automatically

### P30 — study flow & recall coherence

- Claims now precede Synthesis in keyboard and visual tab order
- static release guard prevents regression back to Synthesis-before-Claims
- Synthesis displays exact Claims upstream and treats its free-text evidence field as an optional decisive-evidence summary rather than a second evidence database
- Study Snapshot includes support-classified claims and their Scripture evidence references
- claim recall rendering stays in the extracted Claims UI module rather than duplicating interpretation markup in the main controller
- no schema change: Snapshot content is derived from existing schema-v7 Claims/Synthesis/Outline data

### P31 — accessibility, focus management & mobile interaction hardening

- accessible focus containment and focus return for Studies and Review drawer-dialogs
- nonmodal Reference Peek restores focus to its invoking control
- visible global keyboard focus treatment and reduced-motion support
- mobile Study sheet exposes an explicit control with synchronized `aria-expanded` state
- collapsed mobile Study content becomes both `inert` and `aria-hidden` so hidden controls cannot remain keyboard/screen-reader reachable
- mobile study tabs and Scripture-selection actions enforce 44px minimum touch targets
- keyboard skip navigation jumps directly to Scripture or Study tools
- a single screen-reader page heading identifies the workspace without changing the visible layout
- Scripture and Study regions are programmatically focusable skip targets
- native dialogs and drawer-dialogs consistently expose accessible labels
- passage/save state and transient toast feedback use selective polite status announcements; high-volume Scripture/search content intentionally does not become a live region
- static release guards cover accessibility semantics, mobile-sheet control/inertness, touch targets, and skip navigation
- this phase is implementation hardening, **not** a claim of completed real-device or full screen-reader certification

### P32 — personal knowledge interlinking & cross-passage recall

- active saved Studies are matched to Scripture references through canonical passage-overlap logic rather than string equality
- archived studies are excluded from contextual personal-study matches
- outgoing cross-references and incoming backlinks surface a compact **Studied · [title]** marker when the referenced passage overlaps prior personal work
- Reference Peek also surfaces prior-study context for the passage being peeked itself
- the personal-study marker opens the existing Study Snapshot, which remains the single recall gateway to main idea, outline, claims, unresolved questions, application, review state, and Open study
- no duplicate graph or relationship persistence is introduced; contextual links are derived live from Study passage ownership
- personal-reference rendering is isolated in a focused UI module, syntax checked, offline precached, statically deployment-guarded, and counted inside the existing 20 KB focused-UI budget
- core overlap behavior has dedicated regression coverage
- exact P32 head qualification is pending the current GitHub Actions queue; the last fully executed P31-qualified head remains green

### P33 — contextual study recall expansion

- contextual Scripture connections now preserve **multiple** overlapping prior Studies instead of silently collapsing recall to the first match
- duplicate Study IDs are removed at the focused UI boundary before rendering
- cross-reference and backlink cards surface up to three directly recallable Study Snapshot actions, with explicit overflow count when more matches exist
- overflow is actionable rather than decorative: **+N more** expands the remaining matching studies in place so every recalled Study remains reachable
- Reference Peek now gives the peeked passage its own **Prior studies** recall section using the same shared renderer
- Passage Guide also surfaces overlapping prior Studies in Context, excluding the currently open Study so recall remains useful rather than self-referential
- Study Snapshot remains the only recall destination; P33 does not introduce a second summary surface, graph database, relationship table, or inferred theological connection
- archived-study exclusion and canonical passage-overlap ownership continue to come from the P32 domain behavior
- deployment validation now guards multi-study recall wiring, deduplication, expandable overflow, and Reference Peek integration
- focused Node regression coverage verifies deduplication, complete overflow reachability, and HTML escaping in the personal-reference renderer
- P33 stays local-first and offline-capable with no new schema, network dependency, or built-in AI behavior

### P34 — topic overview & cross-study evidence

- manually curated Study topics now open a dedicated Topic Overview instead of functioning only as archive/search labels
- topic membership is exact and case-insensitive; archived Studies are excluded and Selah does not infer topical relationships from text, embeddings, or AI
- the derived Topic Overview aggregates the active tagged Studies, canonical books represented, study main ideas, support-classified Interpretation Claims with their exact evidence references, and unresolved saved questions
- every studied passage remains reachable through the existing Study Snapshot recall gateway; claim evidence can return to Scripture through Reference Peek
- Topic Overview entry points are available from the Topics archive grouping and from topic chips in Book Overview
- no topic-level theological conclusion or duplicate persistence is created; P34 is a read model over existing Study, Synthesis, Claim, and Annotation ownership
- focused Topic Overview UI is syntax checked, offline precached, and statically deployment guarded; the derived core read model has dedicated regression coverage
- P33 personal-reference event wiring was extracted from the main controller so **app.js** remains inside its 100 KB controller ceiling as Selah grows
- the focused-UI budget is expanded to 30 KB to reflect deliberately extracted feature modules while retaining the 100 KB main-controller ceiling
- no schema migration, network dependency, or built-in AI behavior is introduced

### P35 — real-study workflow qualification & friction hardening

- added a scenario-level workflow harness that exercises a complete passage study through Study creation, normalized topics, notes/questions, Passage Outline, Interpretation Claims with evidence, Synthesis, review opt-in, Topic Overview recall, backup, and restore
- qualification matrix covers all eight literary defaults with representative passages: Narrative, Gospel, Law, Poetry, Wisdom, Prophecy, Epistle, and Apocalyptic
- exact active-study lookup is now a core StudyService capability rather than ad-hoc browser logic
- research navigation, Reference Peek → Open as main, and Back/Forward now re-resolve study ownership for the passage actually displayed; study tools can no longer remain silently attached to the previous passage
- global Review excludes archived Studies so archived work no longer keeps surfacing in the active due queue; deliberate study-scoped review remains available when revisiting archived work
- topic input normalization now accepts whitespace before optional hashtag prefixes, removing a small but recurring metadata-entry trap
- Topic Overview display casing is stable: when case variants exist, the most recently edited matching topic supplies the visible label while membership remains case-insensitive
- an older P32 overlap regression assertion was corrected, and the latent P33 Reference Peek template-syntax defect discovered during qualification was repaired
- static release validation now guards passage-to-study ownership rebinding
- **app.js** remains below the 100 KB controller ceiling; P35 did not relax the main-controller budget
- this phase qualifies automated real-workflow state transitions and cross-feature integration; it does **not** claim completed live-browser, real-device, or screen-reader certification because no Selah Vercel deployment is currently available in the connected account

### P36 — live browser, mobile & PWA acceptance + defect-only hardening

- Chromium acceptance is now a required CI gate through Playwright rather than a manual/static-only qualification claim
- desktop acceptance opens Philippians 2:5–11, saves an observation question into a durable Study, verifies archive visibility, reloads the app, and verifies the saved study state remains reachable
- mobile Chromium uses Pixel-class emulation to check viewport overflow, the collapsible Study sheet, tab interaction, and touch reachability
- PWA acceptance verifies manifest metadata, service-worker registration/control, and an offline reload of the previously opened passage
- PWA packaging now includes explicit app identity/scope plus 192px and 512px install icons; the service-worker shell cache was advanced and precaches the install assets
- live Chromium exposed and P36 fixed a Guide runtime crash caused by passing `referenceButtonHtml` / `backlinkButtonHtml` directly to `Array.map`, which accidentally supplied the array index as the renderer's `studies` argument
- mobile Chromium exposed and P36 fixed hidden drawers that still intercepted pointer input because authored `display:grid` overrode native `hidden` rendering; global `[hidden]` semantics are now enforced
- browser acceptance also verifies the compiled overlap helper contract so browser/runtime module behavior is checked in addition to Node source tests
- the existing 100 KB main-controller ceiling remains unchanged; exact qualified app size is 99,987 B
- a Vercel project was created for Selah and a production-target deployment was attempted; that deployment failed, while connector log inspection is currently blocked by missing authorization to the `thiepn-project` scope, so P36 does not falsely claim a green hosted-production deployment
- remaining human qualification is real physical-device touch/installation, full screen-reader certification, and extended multi-genre study sessions

### P37 — physical-device UX, accessibility & long-session study hardening

- expanded Playwright acceptance from desktop + Pixel-class mobile to a four-project Chromium matrix: desktop, Pixel-class mobile, 320×568 compact phone, and 768×1024 touch tablet
- compact-phone acceptance now enforces no document-level horizontal overflow plus 44×44 minimum touch targets for the primary Study, Review, and chapter-navigation controls
- mobile touch hardening increases the Studies/Review and chapter-navigation targets without changing the desktop layout; compact passage metadata spacing was tightened to preserve the narrow viewport
- Study Document now has a programmatic accessible name rather than relying on placeholder text
- keyboard drawer qualification verifies initial focus, focus-loop wrapping, Escape close, and focus restoration to the invoking control
- touch-tablet qualification verifies both Scripture and Study panes remain meaningfully usable at 768px width without forcing a new tablet-specific layout
- long-session acceptance creates and saves work in two distinct passage Studies, adds an outline, repeatedly switches primary passages, and verifies each passage retains only its own notes and structure
- live long-session testing exposed a real P35 regression: Notes and Synthesis fresh-study save paths still called the removed `getStudyForPassage()` helper after exact lookup moved to `StudyService.forPassage()`; both save paths now use the maintained core service
- the autosave repair preserves the existing local-draft fallback while restoring successful durable IndexedDB saves for previously unstudied passages
- P37 deliberately does not redefine the top-bar Back/Forward buttons as global reference-input history; those controls remain scoped to Selah's research trail
- exact qualification: **95/95 Node tests** and **9 applicable Playwright scenarios passing** across the four browser/device projects
- bundle ceilings remain unchanged: **app.js 99,999 B**, focused UI modules **26,059 B**, CSS **51,000 B**, core JS **144,693 B**
- no schema migration, new study feature, network dependency, or built-in AI behavior was added
- true physical-device installation/touch testing and full screen-reader certification remain human qualification work; browser emulation is not mislabeled as hardware certification

### P38 — V1 release candidate, hosted deployment recovery & human-study certification gate

- Selah is versioned as **1.0.0-rc.1**; RC status is deliberate and remains below V1 final until human study certification is signed
- a dedicated full-production GitHub Actions qualification proved `npm run build:production` succeeds outside Vercel with the complete upstream data pipeline and the same browser acceptance suite
- exact production qualification: **95/95 Node tests**, **9 applicable Playwright scenarios**, all eight literary-mode production research smoke cases, BSB/WEB comparison, original-language research, concordance, and bidirectional references
- measured RC1 static payload: **157.48 MiB / 4,893 files**, including BSB **135.84 MiB / 3,600 files** and WEB **4.09 MiB / 1,192 files**
- this isolates the earlier Vercel `ERROR` deployments from Selah's build: the same production command is green in GitHub Actions, while Vercel project/log inspection remains blocked by a 403 authorization error for the `thiepn-project` scope
- hosted deployment was recovered through **GitHub Pages**, which now rebuilds production data, reruns Chromium acceptance, uploads the already-tested `site/` artifact, and deploys that exact artifact
- first Pages production deployment completed successfully and reported the environment URL **http://thiepn.dev/selah/**
- GitHub Pages is therefore the canonical RC1 production host; Vercel remains an optional secondary target until its scope is reauthorized and separately qualified
- the temporary duplicate production-qualification workflow is retained as **manual-only**; normal `main` pushes use Selah CI plus the Pages production pipeline
- added an explicit human-study certification protocol covering sustained multi-genre study, physical-device/PWA behavior, data ownership/persistence, offline return, backup/restore, ergonomics, and accessibility
- automated/browser qualification is not mislabeled as human certification: **human signoff remains pending**, so RC1 is not yet declared V1 final
- no study-domain feature, schema migration, or new network runtime dependency was introduced in P38

### P39 — RC1 human field trial, defect triage & V1 final promotion

- P39 adds no product feature and does not manufacture a human PASS; RC1 remains the release state until real field-trial evidence is recorded
- human certification now has a machine-checkable source of truth at `docs/v1-human-certification.json`, initialized to **pending**
- validation covers all four multi-genre sessions, minimum field-use durations, desktop keyboard/200% zoom, physical-phone PWA installation, software-keyboard usability, offline return, close/reopen restoration, backup/restore/writability, ratings, and final signoff
- severity policy is enforced: open S0/S1 defects block V1; S2 must be fixed or explicitly accepted with a written rationale; S3 may be deferred
- regression tests prove pending evidence cannot accidentally pass and that S0/S1/S2 policy is enforced
- added a structured GitHub issue form for RC1 field-trial defects
- added manual-only **Selah V1 Final Promotion Gate**: validates human evidence against the stable RC1 SHA, rebuilds full production data, reruns Chromium/device acceptance, and smoke-tests the live production URL
- V1 version promotion is deliberately not automatic; once the manual gate is genuinely green, a final version/tag/deployment commit can promote `1.0.0-rc.1` to `1.0.0`
- current release decision: **HOLD AT RC1 — human field-trial signoff pending**

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
- automated Node suite: **95/95 passing**, including scenario-level full-study workflow qualification across all eight literary defaults
- Playwright Chromium acceptance is required in CI: **9 applicable scenarios passing** across desktop, Pixel-class mobile, 320×568 compact phone, and 768×1024 touch-tablet projects
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
  - BSB research pack: **135.84 MiB / 3,600 files**
  - WEB comparison pack: **4.09 MiB / 1,192 files**
  - Scripture search index: **17.22 MiB**
  - reverse-reference index: **5.00 MiB**
  - Strong's concordance: **4.14 MiB**
  - complete RC1 static site: **157.48 MiB / 4,893 files**
- current application code remains small relative to data: **99,999 B app JS + 26,059 B focused UI modules + 51,000 B CSS + 144,693 B core JS** before compression

## Open qualification work

- physical-device mobile/tablet PWA installation and touch qualification beyond browser emulation
- full screen-reader certification beyond the implemented semantic/keyboard improvements
- additional translation providers where redistribution terms permit
- V1 human multi-genre real-study certification (protocol prepared; signoff pending)

## Product boundaries still enforced

Selah intentionally has no Today/dashboard surface, streak system, prayer manager, reading-plan layer, social feed, sermon manager, or built-in AI dependency. Observation prompts ask text-grounded, literary-mode-aware questions but do not generate interpretation. Interpretation Claims are always user-authored and must show what the studied passage itself supports. Review exists only as a retention layer for conclusions, structure, and custom retrieval questions the user deliberately created. Book Overviews are derived from the user's own passage studies rather than prefilled encyclopedia content. The default experience remains Scripture first, with study tools operating contextually around the passage.

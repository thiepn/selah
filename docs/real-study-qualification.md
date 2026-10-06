# P35 real-study workflow qualification

P35 is a friction-hardening phase rather than a feature-expansion phase. Qualification is automated at the application/service boundary because Selah does not currently have a Vercel deployment in the connected account, so this document does not claim real-device or full browser certification.

## Qualified workflow

The scenario harness covers:

1. open a passage and create one durable Study
2. normalize title/topics
3. save observations and unresolved questions
4. build a non-overlapping Passage Outline
5. create support-classified Interpretation Claims with exact in-passage evidence
6. write structured Synthesis
7. deliberately opt the study into Review
8. recover the study through Topic Overview
9. export and restore the full local snapshot
10. resolve the restored Study by its exact canonical passage

## Cross-passage research qualification

The research workflow verifies that an exact saved Study is resolved from the passage currently on screen. Opening an unrelated reference detaches study ownership; returning through research history reattaches the original Study; navigating to another independently saved passage attaches that Study instead. Archived Studies are not auto-attached.

This closes a high-risk defect where study tools could remain bound to the passage visited before a research-navigation change.

## Genre matrix

Representative passages are qualified for every default literary mode:

- Narrative — Genesis 22:1–14
- Gospel — Mark 4:1–20
- Law — Deuteronomy 6:4–9
- Poetry — Psalm 23
- Wisdom — Proverbs 3:1–12
- Prophecy — Isaiah 6:1–8
- Epistle — Philippians 2:5–11
- Apocalyptic — Revelation 4:1–11

## Friction defects fixed during P35

- whitespace before optional topic hashtags no longer prevents normalization
- archived-study cards no longer pollute the global Review queue
- Topic Overview casing no longer depends on canonical passage sort order
- research navigation can no longer leave Notes/Claims/Synthesis attached to a stale Study
- the P33 Reference Peek template syntax regression was repaired
- a malformed overlap-test assertion was corrected

## Still requires human/device qualification

- real mobile touch behavior
- actual browser dialog/focus behavior across supported browsers
- full screen-reader pass
- long-form real-study sessions using production Bible data
- live deployment/offline-PWA behavior on installed devices

These remain release qualification tasks, not reasons to add new product surfaces.

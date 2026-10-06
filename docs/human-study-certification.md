# Selah V1 human-study certification

**Status: PASS — PROMOTED TO V1.0.0**

This protocol is the final gate between `1.0.0-rc.1` and V1 final. Automated browser/device emulation does not satisfy this document.

## Certification rules

Use the live production build, not a local development server. Record every defect when it occurs; do not mentally work around it and mark the step as passed.

A blocking defect is any issue that causes data loss, wrong-passage ownership, a crash, an inaccessible essential control, unusable physical-device layout, broken offline return, or a workflow interruption severe enough that a normal study cannot reasonably continue.

Minor visual polish and optional-feature requests do not block V1.

## Session 1 — Epistle, complete workflow

Suggested passage: **Philippians 2:5–11**

Target duration: **60–90 minutes**.

Complete a normal study without testing the software mechanically:

- read and navigate the passage
- use Guide observations
- write anchored notes and at least one genuine unresolved question
- create a Passage Outline
- inspect at least one cross-reference through Peek
- use original-language/word research where it genuinely helps
- create at least two Interpretation Claims with evidence
- write a Synthesis with main idea, explanation, confidence, application, and prayer
- opt into Review
- leave the app, return, and confirm all study work is intact
- reopen the Study through Studies/Snapshot rather than only browser history

Pass criteria:

- no wrong-passage Study attachment
- no lost or duplicated content
- save state resolves normally
- navigation remains understandable after extended use
- the interface does not pressure the user into irrelevant tools

## Session 2 — Poetry or wisdom

Suggested passage: **Psalm 23**.

Target duration: **30–60 minutes**.

Focus on whether Selah adapts cleanly to a non-epistle:

- literary-mode observation prompts make sense
- structure can be represented without forcing prose/argument assumptions
- pattern tools help rather than distract
- Notes, Claims, and Synthesis remain flexible enough for poetic material
- revisit the passage after closing/reloading and confirm state integrity

## Session 3 — Narrative

Suggested passage: **Genesis 22:1–14**.

Target duration: **45–75 minutes**.

Check:

- observation flow supports sequence, characters, tension, repetition, and turning points
- Passage Outline handles narrative units naturally
- cross-references/word tools stay secondary to close reading
- claims remain tied to actual textual evidence
- no stale state appears when moving between narrative and previously saved studies

## Session 4 — Apocalyptic/vision material

Suggested passage: **Revelation 4:1–11**.

Target duration: **45–75 minutes**.

Check:

- apocalyptic literary-mode prompts are useful without supplying interpretations
- repeated imagery and structural observations are easy to record
- tentative/disputed claim support feels usable for uncertain interpretation
- Synthesis does not imply more confidence than the study actually supports

## Physical-device pass

### Primary desktop/laptop

Use Selah for at least one complete long session.

- keyboard-only access to major navigation and drawers
- tab order remains understandable
- Escape/focus restoration works
- 200% browser zoom does not make the core workflow unusable
- long notes and synthesis fields remain comfortable to edit

### Primary phone

Install/open the production PWA and use it for at least **30 minutes**.

- passage entry works with the software keyboard
- Study sheet controls remain reachable
- no control is obscured by browser chrome or keyboard
- scrolling Scripture does not unexpectedly move/lock the Study surface
- Notes can be written and saved
- close/reopen restores the study
- enable airplane/offline mode after a previously opened passage and confirm offline return

### Tablet, if part of normal use

Use the split study layout for at least **20 minutes**.

- both Scripture and Study panes remain meaningfully readable
- touch targets are comfortable
- rotation does not strand or corrupt the workspace

## Accessibility signoff

Automated semantic/keyboard checks already pass, but assistive-technology certification requires an actual AT session.

Record at least one of:

- VoiceOver
- TalkBack
- NVDA
- JAWS

Required checks:

- reference field is announced clearly
- Study tabs communicate selected state
- Study Document and synthesis fields have useful names
- drawers/dialogs announce usable context
- focus does not disappear behind closed overlays
- live save/status messages are not excessively noisy

If no screen reader is available for V1, mark this section **not certified** rather than assuming a pass.

## Ownership and resilience

On real study data:

- create a backup
- verify the backup file is actually present outside Selah
- make a small new change
- restore the prior backup
- confirm the expected prior state returns
- repeat a normal save afterward to ensure the restored database remains writable

## Friction log

For every material issue, record:

| Time/session | Device | Passage | Surface | What happened | Severity | Reproducible? | Blocking? |
|---|---|---|---|---|---|---|---|

Severity:

- **S0** — data loss/security/corruption
- **S1** — core study cannot reasonably continue
- **S2** — significant repeated friction; fix before V1 if common
- **S3** — minor polish or rare inconvenience

V1 cannot ship with an open S0 or S1 defect. An S2 requires an explicit release decision.

## Final human signoff

Complete only after the sessions above.

- Tester:
- Date:
- Production URL:
- Primary desktop/browser:
- Primary phone/browser/PWA:
- Tablet tested: yes / no
- Screen reader tested:
- Blocking defects remaining:
- Non-blocking defects deferred:
- Overall sustained-study rating (1–5):
- Data-confidence rating (1–5):
- Physical-device comfort rating (1–5):

### Decision

- [x] **PASS — promote RC1 to V1 final**
- [ ] **CONDITIONAL — fix listed blockers and rerun affected sections**
- [ ] **FAIL — return to defect hardening**

PASS was explicitly attested and then validated by the V1 promotion gate. Selah was promoted to V1.0.0 after the full production rebuild, browser/device acceptance, and live-site smoke test also passed.

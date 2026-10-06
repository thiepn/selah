# P37 device, accessibility & long-session hardening

P37 is a defect-only hardening phase. It does not add another Bible-study feature layer.

## Automated device matrix

Selah now runs the browser acceptance suite against four Chromium projects:

- desktop Chromium
- Pixel-class mobile Chromium
- 320×568 compact-phone Chromium with touch enabled
- 768×1024 touch-tablet Chromium

These are browser/device emulations, not claims of testing on physical hardware.

## Compact-phone acceptance

At 320px width Selah must:

- avoid document-level horizontal overflow
- keep the mobile Study handle reachable
- expose Studies and Review as at least 44×44 touch targets
- expose previous/next chapter controls as at least 44×44 touch targets
- retain usable passage metadata spacing after the larger controls are applied

P37 found the Studies action was only 29px high and corrected the mobile touch-target rules.

## Accessibility acceptance

The automated keyboard/accessibility flow verifies:

- Studies opens with focus in its search control
- the drawer focus loop wraps from the first focusable control to the last
- Escape closes the drawer
- focus returns to the invoking Studies button
- visible Study textareas have a programmatic accessible name

P37 found the freeform Study Document textarea depended on placeholder text rather than an accessible name. It now exposes `aria-label="Study document"`.

This is focused keyboard/semantic qualification, not full assistive-technology certification.

## Touch-tablet acceptance

At a 768×1024 touch viewport Selah must remain free of document-level horizontal overflow while preserving usable widths for both Scripture and Study panes.

The existing split workspace passed this qualification, so P37 did not introduce a speculative tablet redesign.

## Long-session acceptance

The browser performs a sustained stateful study flow:

1. open Philippians 2:5–8
2. enter a linked freeform Study Document and wait for durable save
3. create a passage-outline section
4. switch to Philippians 2:9–11
5. write and save a second Study Document
6. revisit the first passage through the normal reference field
7. verify its Study Document and outline are restored
8. revisit the second passage
9. verify its distinct Study Document is restored

This validates passage-owned state over repeated edits and navigation rather than only a single save/reload cycle.

## Defect found: fresh-study autosave regression

P35 replaced ad-hoc exact passage lookup with `StudyService.forPassage()`. Two browser save paths still referenced the removed `getStudyForPassage()` helper:

- debounced Study Document persistence
- Synthesis persistence for a passage with no existing Study

Because those calls occur inside save error handling, the browser degraded to `unsaved draft preserved` instead of completing the IndexedDB write.

Both paths now use `studyService.forPassage(passage)`.

The existing localStorage draft fallback remains intact for genuine persistence failures.

## Research-history semantics

Typing a new primary passage intentionally creates a fresh research trail. Therefore the top-bar Back/Forward buttons are not treated as global reference-input history.

The long-session test revisits primary passages through the reference field and verifies durable Study ownership instead of changing that established navigation model.

## Exact qualification

- Node/core: 95 passed, 0 failed
- Playwright matrix: 36 generated project/test combinations
- applicable browser scenarios: 9 passed
- intentionally inapplicable project variants: 27 skipped
- app controller: 99,999 B / 100,000 B
- focused UI modules: 26,059 B
- CSS: 51,000 B
- core JS: 144,693 B

## Still requires human qualification

- physical Android phone installation and touch use
- physical iPhone/iPad PWA behavior
- mobile browser chrome and software-keyboard behavior on real hardware
- VoiceOver, TalkBack, NVDA, or JAWS certification
- extended human Bible-study sessions beyond automated interaction timing

# P36 browser, mobile & PWA acceptance

P36 is a defect-only release-candidate acceptance pass. It adds no new study domain or content feature.

## Automated browser matrix

CI builds Selah, installs Chromium through Playwright, starts the static release candidate with the repository's production-like HTTP server, and executes:

### Desktop study persistence
- open Philippians 2:5–11 through the normal reference field
- require a functioning Passage Guide
- save a Guide observation question, creating/using the passage Study through normal UI behavior
- open Studies and verify the Study is recallable
- reload
- return to Notes and verify durable study content is still available

### Mobile interaction
- emulate a Pixel-class Chromium viewport
- open the same passage
- assert the document does not overflow horizontally
- open the bottom Study sheet using the visible touch control
- verify synchronized `aria-expanded`
- switch to Notes and keep the Study sheet operable

### PWA/offline
- fetch and validate the installed web manifest
- require standalone display, app start URL, and 192px / 512px icon coverage
- wait for service-worker readiness and controller acquisition
- switch the browser context offline
- reload
- require the previously opened passage and Scripture content to remain available offline

### Browser module contract
- import the built core study/reference modules from the actual static site
- verify the compiled passage-overlap helper preserves its array-returning browser contract

## Defects found by live Chromium

### Guide cross-reference callback arity
The Guide passed `referenceButtonHtml` and `backlinkButtonHtml` directly to `Array.map`. The map index was therefore passed as the renderer's optional second `studies` argument, eventually producing `studies is not iterable` in the browser. Explicit one-argument callbacks now preserve the intended renderer contract.

### Hidden drawer pointer interception
Selah's authored `.drawer { display:grid }` rule overrode native rendering of the HTML `hidden` attribute. A hidden Review drawer could therefore cover mobile controls and intercept taps. A global `[hidden]{display:none!important}` rule restores the platform contract and protects every hidden overlay/badge from authored display rules.

### PWA packaging
The previous manifest had no install icons. Selah now ships explicit 192px and 512px app icons, app identity/scope metadata, and service-worker shell precaching for those assets.

## Hosted deployment status

A Vercel project (`selah`) and production-target deployment were created from GitHub during P36. The first production build ended in ERROR. The connected Vercel integration can create deployments but cannot inspect this project's build logs because it lacks authorization for the `thiepn-project` scope. Hosted-production certification therefore remains explicitly open rather than being inferred from the green browser CI.

## Still outside automated certification

- touch behavior on physical phones/tablets
- browser-specific Safari/Firefox differences beyond Chromium
- install UX on Android/iOS/desktop operating systems
- full screen-reader certification
- extended human studies using multiple real biblical genres

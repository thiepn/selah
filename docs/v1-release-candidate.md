# Selah V1 release candidate

## Candidate

- Version: **1.0.0-rc.1**
- Product: local-first, passage-centered Bible study workspace
- Canonical production host: **GitHub Pages**
- Pages environment URL reported by deployment: **http://thiepn.dev/selah/**
- Release status: **RC — automated and hosted qualification passed; human certification pending**

V1 final must not be declared until the human-study certification in `docs/human-study-certification.md` has been completed and blocking defects are closed.

## Automated release evidence

RC1 requires all of the following:

- strict TypeScript core compilation
- source/license manifest validation
- 95/95 Node tests
- static site integrity validation
- browser-JavaScript syntax validation
- unchanged bundle ceilings
- full production BSB and WEB vendoring/validation
- exact verse bounds, Scripture search, Strong's concordance, and reverse-reference generation
- production research smoke across all eight literary modes
- 4-project Playwright matrix:
  - desktop Chromium
  - Pixel-class mobile Chromium
  - 320×568 compact-phone Chromium
  - 768×1024 touch-tablet Chromium
- 9 applicable browser scenarios passing
- production Pages artifact upload
- successful Pages deployment of the already-tested artifact

The first P38 production qualification measured:

- BSB research pack: **135.84 MiB / 3,600 files**
- WEB comparison pack: **4.09 MiB / 1,192 files**
- Scripture search: **17.22 MiB**
- reverse references: **5.00 MiB**
- Strong's concordance: **4.14 MiB**
- final static site: **157.48 MiB / 4,893 files**

## Hosting decision

Two Vercel production-target deployments ended in `ERROR`. P38 proved that the exact production build command succeeds in GitHub Actions, so those failures are not treated as evidence of a broken Selah build.

The connected Vercel integration cannot read project settings or build logs because access to the `thiepn-project` scope returns HTTP 403. Vercel therefore cannot be release-certified from this environment.

GitHub Pages is the RC1 release authority because it:

1. builds the complete production data set,
2. runs browser acceptance against that output,
3. uploads only after those gates pass,
4. deploys that same tested artifact.

Vercel may be reconsidered later after scope reauthorization, but it is not a V1 blocker.

## V1-final blockers

Only these categories may block promotion from RC1 to V1 final:

- a reproducible crash, data-loss bug, passage/study ownership error, or failed save/restore
- a physical-device interaction defect that prevents normal study
- a PWA installation/offline defect on the user's actual primary device
- a serious keyboard or assistive-technology blocker
- a sustained-study workflow defect that materially interrupts observation → research → claims → synthesis → review
- failed backup/restore of real study data

Cosmetic preferences and feature requests that do not break the existing study workflow belong after V1 unless they are severe enough to make sustained study impractical.

## Release decision

**Current decision: RC1 accepted for human certification.**

Automated qualification and hosted deployment are green. Human certification is intentionally pending.

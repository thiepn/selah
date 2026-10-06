# P39 RC1 field trial, defect triage & V1 promotion

## Current state

RC1 is technically qualified and hosted, but the human field-trial certification remains **pending**. P39 therefore does not promote Selah to V1 merely because automated checks are green.

## Source of truth

Human evidence is stored in `docs/v1-human-certification.json`.

The prose checklist in `docs/human-study-certification.md` explains how to perform the trial. The JSON file records the release evidence in a machine-checkable form.

## Triage policy

- **S0** — data loss, corruption, security: must be fixed and retested.
- **S1** — core study cannot reasonably continue: must be fixed and retested.
- **S2** — significant repeated friction: fix before V1 or explicitly accept with a written release rationale.
- **S3** — minor polish / rare inconvenience: may be deferred.

Every S0/S1 in the certification record must be `closed`. An S2 may be `accepted` only with an explicit rationale.

A GitHub issue form is available at `.github/ISSUE_TEMPLATE/selah-rc-defect.yml` for field-trial defects.

## Promotion gate

Run:

```bash
npm run release:v1:check
```

The gate fails unless:

- the exact candidate is `1.0.0-rc.1`
- the evidence SHA matches `release/v1.0.0-rc.1`
- all four sustained study sessions pass with their minimum durations
- desktop field use passes, including keyboard and 200% zoom
- phone field use passes for 30+ minutes
- the PWA is actually installed on the phone
- software-keyboard interaction passes
- offline return passes
- closing/reopening restores the study
- backup/export/restore/writability all pass
- there are no open S0/S1 defects
- accepted S2 defects have release rationales
- the three human ratings are at least 3/5
- a named tester, date, and final PASS decision are recorded

Full screen-reader certification is recorded separately and may be `not-certified`; it is never silently represented as passing.

## Final promotion workflow

`Selah V1 Final Promotion Gate` is manual-only.

Before any version bump it:

1. validates the human evidence,
2. verifies it points to the stable RC1 branch SHA,
3. rebuilds the entire production data set,
4. reruns the browser/device matrix,
5. smoke-tests the live production endpoint.

Only after that workflow is green should the repository be changed from `1.0.0-rc.1` to `1.0.0`.

## Current decision

**HOLD AT RC1.**

Reason: no real human field-trial signoff has been recorded yet. This is the expected P39 state until a human actually performs the certification.

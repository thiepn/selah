# Platform P10 — Bible Family Consolidation

P10 consolidates Bible product identity without turning Selah, My Daily Devotion, TMS60 and Biblical Greek into one database or one application.

## Canonical modules

- `bible/study` → Selah
- `bible/devotion` → My Daily Devotion
- `bible/tms60` → TMS60
- `bible/greek` → Biblical Greek

The Bible product remains **staged** because there is not yet one canonical public Bible-family launch surface.

## Provider ownership

Selah remains passage-study software. MDD remains devotional/prayer software. TMS60 remains Scripture-memory software. Greek remains language-learning software.

Shared Scripture references may be represented across modules, but each provider keeps ownership of its notes, annotations, reflections, prayer state, memorization progress, course progress and exports.

P10 does not create a universal Bible database and does not ask one module to proxy writes into another.

## Compatibility

Existing public URLs stay unchanged. Existing local-first stores stay unchanged. Existing aliases remain valid, with `selah → bible/study` added as a product-facing compatibility identity.

A later phase may build a unified Bible launch/navigation surface over this boundary. That UI migration is separate from storage migration.

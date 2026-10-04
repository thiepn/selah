# Architecture

Selah treats the current Scripture context as its operating system.

```text
Reference Engine
      ↓
Passage Context
      ↓
┌──────────────┬───────────────┬──────────────┐
│ Scripture    │ Research      │ Personal     │
│ reading      │ Guide / Lens  │ notes        │
│ compare      │ references    │ questions    │
│ patterns     │ words         │ highlights   │
│ phrasing     │ resources     │ study doc    │
└──────────────┴───────────────┴──────────────┘
      ↓
Study / Workspace / Research Trail
      ↓
IndexedDB + backup/export
```

## Permanent domain distinctions

### Passage

A canonical location in Scripture. It is not user data.

### Study

Durable intellectual work centered on a primary passage. Studies contain or relate to notes, questions, the Study Document, phrasing, and tags.

### Workspace

Recoverable interaction state: current passage, selected translation, open study panes, research history, and later scroll/pane geometry. Workspace state is not the source of truth for study content.

## Context rule

Guide, Lens, Notes, References, Words, Compare, Patterns, Phrasing, and Resources never own their own current-passage state. They consume `PassageContext` and provider services.

## Data rule

Upstream Bible formats never become Selah's domain model directly:

```text
upstream BSB data
      ↓
validated ingest/provider layer
      ↓
Selah ScriptureToken / VerseRef / PassageRef
      ↓
study engines
```

This allows providers or upstream schemas to change without rewriting annotations and study data.

## Anchoring rule

Reference anchors are translation-independent. Text-selection anchors are translation-specific and store stable token IDs plus quoted fallback text. Original-language anchors use corpus/token IDs.

## Local-first rule

No backend is required for V1. IndexedDB is the local source of truth. Full backup/export is mandatory. Future THIEPN Account sync must remain optional and must not make local study dependent on network availability.

## UI rule

The product opens into Scripture, not a dashboard. Desktop permits one primary Bible pane plus at most two secondary study surfaces. Mobile keeps Scripture primary and exposes study tools in a secondary sheet.

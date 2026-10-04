# Data-source policy

Every bundled dataset must have a manifest entry with:

- stable source id
- source URL
- license identifier
- attribution requirements
- data category
- upstream version / revision when known
- retrieval/build date
- checksum when vendored

Runtime schemas are Selah-owned. Upstream schemas are transformed during ingestion so application code never depends directly on an external repository layout.

Initial planned sources:

- Berean Standard Bible display/text data — public domain / CC0 outputs.
- BSB concordance and public-domain cross-reference outputs where applicable.
- Open Scriptures Hebrew morphology — CC BY 4.0 where used.
- STEPBible-derived lexical material — only under the stated upstream attribution license.
- SBLGNT may be added as an additional Greek corpus under its current CC BY license after ingestion is implemented.

Licensing must be revalidated when an upstream dataset version or source changes.

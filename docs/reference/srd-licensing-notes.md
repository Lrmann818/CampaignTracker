# SRD Licensing Notes

_Last updated: 2026-04-17_

## Purpose

This document records the current licensing approach for SRD-derived content used by Lore Ledger's character builder and related rules/content systems.

It exists to answer these questions:

- Which SRD source documents are we using?
- What licensing model applies to each one?
- What is the safe builtin-content policy for Lore Ledger?
- What attribution obligations do we need to satisfy?
- What should contributors avoid when adding new builtin content?

This is a project guidance document, not legal advice.

---

## Canonical Reference Files

The official source reference files stored in this repo are:

- `docs/reference/SRD_CC_v5.2.1.pdf`
- `docs/reference/SRD_OGL_v5.1.pdf`

These PDFs are kept for provenance and reference.

They are **not** the preferred working format for implementation. Implementation-facing content decisions should be captured in markdown and structured JSON files elsewhere in the repo.

---

## Current Project Direction

Lore Ledger should follow a conservative, production-friendly content policy:

- Use **SRD-permitted content only** for shipped builtin content.
- Treat anything outside the approved builtin scope as **custom user content**.
- Keep builtin content clearly separated from user-created content in both code and data.
- Keep licensing attribution explicit and easy to audit.
- Avoid depending on ambiguous or unofficial content sources.

This matches the project's overall architecture goals: stable, well-documented, and boringly reliable.

---

## SRD 5.2.1

`SRD 5.2.1` is provided by Wizards of the Coast under the **Creative Commons Attribution 4.0 International License (CC BY 4.0)**. The SRD itself states that users are free to use the content as permitted by CC BY 4.0, provided they include the attribution statement supplied in the document.  [oai_citation:0‡SRD_CC_v5.2.1.pdf](sediment://file_000000009064722f8981ca4561917792)

The SRD 5.2.1 document also provides the attribution statement that must be included in works using that material, and it specifically says not to include other attribution to Wizards or its parent/affiliates beyond the provided statement. It also says a work may describe itself as “compatible with fifth edition” or “5E compatible.”  [oai_citation:1‡SRD_CC_v5.2.1.pdf](sediment://file_000000009064722f8981ca4561917792)

### Practical meaning for Lore Ledger

For Lore Ledger, SRD 5.2.1 should be treated as the **primary source** for future builtin rules/content work whenever the needed content exists there.

Reasons:

- clearer modern licensing model for project use
- explicit attribution language included in the document
- easier long-term maintenance than relying on OGL-governed text
- cleaner provenance story for a portfolio app

### Attribution text for SRD 5.2.1

When Lore Ledger distributes builtin material derived from SRD 5.2.1, include this attribution statement exactly as given in the SRD:

> This work includes material from the System Reference Document 5.2.1 (“SRD 5.2.1”) by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.

Source of this required attribution text: SRD 5.2.1 legal information page.  [oai_citation:2‡SRD_CC_v5.2.1.pdf](sediment://file_000000009064722f8981ca4561917792)

### Recommended implementation rule

If Lore Ledger ships builtin content derived from SRD 5.2.1, the app and repo should contain a clear attribution notice in an appropriate place such as:

- About / Credits / Legal section in-app
- distributed NOTICE / acknowledgments documentation
- any future website or README section covering third-party content attribution

---

## SRD 5.1

`SRD 5.1` is released for use through the **Open Gaming License v1.0a**. The document says permission to copy, modify, and distribute SRD 5.1 is granted solely through use of the OGL v1.0a, and it instructs the reader to read and understand that license before using the material.  [oai_citation:3‡SRD-OGL_V5.1.pdf](sediment://file_00000000bacc722f841e47b69d027b27)

The SRD 5.1 file also identifies certain items as **Product Identity** and says all the rest of SRD 5.1 is Open Game Content.  [oai_citation:4‡SRD-OGL_V5.1.pdf](sediment://file_00000000bacc722f841e47b69d027b27)

The OGL text included in SRD 5.1 also says:

- you must update the COPYRIGHT NOTICE portion when copying, modifying, or distributing Open Game Content
- you must clearly indicate which portions of the distributed work are Open Game Content
- you must include a copy of the license with every copy of the Open Game Content you distribute
- you may not use Product Identity except as separately licensed  [oai_citation:5‡SRD-OGL_V5.1.pdf](sediment://file_00000000bacc722f841e47b69d027b27)

### Practical meaning for Lore Ledger

SRD 5.1 should be treated as a **reference and fallback source**, not the preferred basis for new shipped builtin content, unless there is a deliberate reason to use it.

Why:

- it has more licensing handling requirements than SRD 5.2.1
- it requires care around OGL notice handling and Product Identity boundaries
- it is less clean as a modern default for new project content policy

### Conservative project rule for SRD 5.1

For Lore Ledger:

- prefer SRD 5.2.1 over SRD 5.1 for new builtin content whenever possible
- do not casually mix SRD 5.1-derived text into builtin files unless we have intentionally decided how OGL compliance will be handled
- if any future shipped builtin content depends on SRD 5.1 specifically, document that dependency explicitly in repo docs before implementation

---

## Product Identity and Safe Naming

SRD 5.1 explicitly identifies certain names and terms as Product Identity and therefore not Open Game Content. The document includes examples such as Dungeons & Dragons, D&D, various setting names, and many protected creature/proper names.  [oai_citation:6‡SRD-OGL_V5.1.pdf](sediment://file_00000000bacc722f841e47b69d027b27)

### Project rule

Lore Ledger contributors should avoid:

- using protected product identity terms as builtin branded content
- implying official endorsement
- using non-SRD proprietary subclasses, species, settings, monsters, or named lore as shipped builtin data unless their status has been explicitly reviewed and documented

When in doubt:

- do not add it as builtin
- treat it as user-added custom content instead

---

## Builtin vs Custom Content Policy

Lore Ledger uses a strict separation:

### Builtin content

Builtin content is content that ships with the app and is stored in the repo as project-owned structured data.

Builtin content must be:

- clearly within approved SRD scope
- documented in repo policy files
- stored in machine-friendly project data files
- attributable in a way that is easy to audit

### Custom content

Custom content is any user-authored or user-imported content that does not ship as official builtin data.

Examples include:

- homebrew species
- homebrew classes/subclasses
- non-approved 5E content
- campaign-specific rules content
- anything outside the approved greenlist

This separation is important both for legal clarity and for clean architecture.

---

## Recommended Source Hierarchy

When adding or modifying builtin character-builder content, use this priority order:

1. `builder-scope-greenlist.md`
2. structured content files under `game-data/srd/`
3. `content-registry-plan.md`
4. official SRD PDFs in `docs/reference/`

Interpretation rule:

- the PDFs are canonical source references
- the markdown policy/docs define project decisions
- the JSON files define implementation-ready approved builtin data

If there is a conflict between raw SRD text and project implementation files, stop and resolve the discrepancy explicitly rather than guessing.

---

## Contributor Rules

When working on Lore Ledger builtin content:

1. Do not add non-greenlit content as builtin.
2. Do not assume "common D&D knowledge" is automatically safe to ship.
3. Do not use unofficial websites as authority for builtin content decisions.
4. Prefer SRD 5.2.1 as the source for new builtin content.
5. Keep legal/policy reasoning in markdown and implementation data in JSON.
6. If source status is unclear, do not implement it as builtin until reviewed.

---

## Current Working Recommendation

At the current stage of Lore Ledger's builder work, the safest approach is:

- keep the official SRD PDFs in `docs/reference/`
- use a project-maintained greenlist to define what may ship as builtin
- model approved builtin data in `game-data/srd/*.json`
- treat everything else as custom user content

This keeps the content system explicit, auditable, and maintainable.

---

## Open Questions for Later

These questions do not block current document setup, but should be finalized before broad builtin content expansion:

- exact in-app location of attribution text
- whether any shipped builtin data will intentionally rely on SRD 5.1 instead of SRD 5.2.1
- whether NOTICE/CREDITS text will live only in-app, only in repo docs, or both
- how import/export should label builtin-source versus custom-source content in portable files

---

## Summary

Current Lore Ledger licensing posture:

- **Primary builtin-content source:** SRD 5.2.1
- **Reference/fallback source:** SRD 5.1
- **Policy stance:** conservative, greenlist-based, builtin vs custom separated
- **Default rule:** if it is not clearly approved for builtin scope, treat it as custom content

This document should be updated whenever the project's shipped builtin content scope or attribution strategy changes.
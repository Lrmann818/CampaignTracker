All of A through D — that's actually the most diagnostic answer you could've given. Means we're dealing with multiple problems stacked on top of each other, and a single fix won't address them all. Good — better to know that upfront than to apply the wrong tool.

Let me actually run the audit. I'll clone the Refactoring branch and walk through `docs/` systematically.Okay. The audit is in, and I can confirm — you're not imagining it. **You have all four problems**, and they're worse than you probably realized. Let me show you what's actually going on, because seeing it concretely is the first step toward not feeling overwhelmed by it.

## What I found

The repo has **27 markdown files** total: 10 at the root, 13 in `docs/`, and 4 in `docs/reference/`. Some of those are correct and load-bearing. A lot of them are sprawl, duplication, or completed-work artifacts that never got archived.

Here are the specific problems, with evidence:

**Problem 1: Three overlapping AI-instruction files at the root.** This one is actively harmful, not just messy.

- `AGENTS.md` (243 lines) — "tells coding agents how to work safely"
- `AI_RULES.md` (441 lines) — "AI coding assistants MUST follow these rules"
- `CLAUDE.md` (309 lines) — Claude-specific instructions

These almost certainly contradict each other in places. Three different files telling Claude Code, Codex, and Cursor different rules means those tools get confused signals. This isn't aesthetic — it's tooling actively working against itself. AGENTS.md and CLAUDE.md are *special filenames* that specific tools look for (AGENTS.md is the OpenAI/Codex convention; CLAUDE.md is Anthropic's convention for Claude Code), so we can't just delete them. But they need to be consolidated so they say *the same thing*, not three different things.

**Problem 2: Smoke testing has four overlapping documents.**

- `VITE_SMOKE_TEST.md` (root, 35 lines)
- `docs/browser-smoke-plan.md` (67 lines)
- `docs/pre-ship-smoke-test.md` (93 lines)
- `docs/testing-guide.md` (422 lines)

Worse: `testing-guide.md` literally says "*pulls together guidance from `docs/SMOKE_TEST.md`, `SMOKE_TEST.md`, and `docs/CSP_AUDIT.md`*" — and **two of those files don't exist anymore**. So the canonical testing doc is referencing files that have been deleted. That's stale text in a current doc, which is one of the worst kinds of documentation rot.

**Problem 3: Plans and design docs scattered between root and docs/.**

- `MULTI-CHARACTER_DESIGN.md` lives at root (522 lines), describes work across Steps 1-4, says "Status: Complete, audited, and fully verified" multiple times — meaning it's a *historical record* of completed work, not an active plan, but it's still in the most-prominent location in the repo.
- `NEW-FEATURES-ROADMAP.md` at root (229 lines) — active forward-looking plan.
- `docs/LORE_LEDGER_BUILDER_PLAN.md` (465 lines) — also an active plan, but in a different location.
- `docs/character-portability.md` (143 lines) — describes Step 4 of the multi-character work, lives in docs/, but `MULTI-CHARACTER_DESIGN.md` (the parent doc) lives at root. They're related but separated.

So plans and design docs are scattered with no clear convention for "active vs archived" or "where do these live."

**Problem 4: No navigation, no index.**

There is no `docs/README.md`. There is no entry-point that says "here are your operational docs, here are your reference docs, here are your active plans, here's what each one is for." So when you open the docs folder you're staring at 13 alphabetically-sorted markdown files with no story.

## Why you're feeling overwhelmed

Now you can see why all four pain points (a, b, c, d) hit at once. It's:

- **(a) too many files in one folder** — 13 files in `docs/`, no subdividing, no sense of category
- **(b) can't tell what's current vs stale** — completed work mixed with active plans, stale references inside current docs
- **(c) repeated info, no canonical source** — three AI rules files, four smoke test docs
- **(d) plans you wrote ages ago without context** — `MULTI-CHARACTER_DESIGN.md` is from work that shipped; do you still need it?

You're not bad at organization. You just hit the natural sprawl point that every project hits around the time it's been actively developed for several months. The fix is mechanical, but it's not "just add a folder."

## What I'd propose (target structure)

Here's a target structure. **This is a proposal, not a prescription** — I want your pushback before any of it happens:

```
/                              (repo root — keep small)
├── README.md                  Project overview (keep)
├── CHANGELOG.md               Version history (keep)
├── CONTRIBUTING.md            For humans (keep)
├── LEGAL.md                   SRD attribution (must stay at root)
├── AGENTS.md                  THE canonical agent rules file (consolidate AI_RULES + CLAUDE into this)
└── CLAUDE.md                  THIN — "see AGENTS.md" pointer for Claude Code
└── docs/
    ├── README.md              NEW — navigation/index for everything below
    ├── architecture.md        Current architecture (keep — load-bearing, current)
    ├── state-schema.md        Current schema (keep — load-bearing, current)
    │
    ├── reference/             EXISTS — ratified policies (keep as-is)
    │   ├── attribution-requirements.md
    │   ├── builder-scope-greenlist.md
    │   ├── content-registry-plan.md
    │   └── srd-licensing-notes.md
    │
    ├── operations/            NEW — maintenance and release
    │   ├── release-process.md          (moved from docs/)
    │   ├── testing-guide.md            (moved from docs/, fixes stale refs)
    │   ├── troubleshooting.md          (moved from docs/)
    │   ├── pre-ship-smoke-test.md      (moved from docs/)
    │   ├── browser-smoke-plan.md       (moved from docs/)
    │   ├── PWA_NOTES.md                (moved from docs/)
    │   ├── CSP_AUDIT.md                (moved from docs/)
    │   ├── security-privacy.md         (moved from docs/)
    │   └── storage-and-backups.md      (moved from docs/)
    │
    ├── plans/                 NEW — active forward-looking plans
    │   ├── LORE_LEDGER_BUILDER_PLAN.md (moved from docs/)
    │   └── NEW-FEATURES-ROADMAP.md     (moved from root)
    │
    ├── features/              NEW — per-feature design docs (survive shipping)
    │   └── character-portability.md    (moved from docs/)
    │
    └── archive/               NEW — historical records of completed design work
        └── MULTI-CHARACTER_DESIGN.md   (moved from root)
```

**Files that get deleted entirely:** `VITE_SMOKE_TEST.md` at root (its content is already in or should be merged into `testing-guide.md`).

**How this fixes each pain point:**

- (a) Folders subdivide by purpose. No folder has more than ~10 files.
- (b) `archive/` makes "this is historical" explicit. No more wondering if MULTI-CHARACTER_DESIGN is current work.
- (c) AGENTS.md becomes the single canonical source for AI rules; CLAUDE.md is a thin pointer. Smoke testing docs get reconciled (probably testing-guide.md absorbs the rest, or vice versa).
- (d) `docs/README.md` tells you what to read when. No more staring blankly at the folder.

## Honest caveats about my proposal

A few things I'm uncertain about and want your input on:

1. **`features/` vs `archive/` for `character-portability.md`.** It documents shipped functionality. Is it operational reference (someone uses this when building related features) or archived design (read once, never again)? I leaned features/, but you'd know better.

2. **VITE_SMOKE_TEST.md merging into testing-guide.md.** I'm assuming the content is redundant. I haven't actually diffed them. If VITE_SMOKE_TEST has unique content, we keep it (likely in operations/) and don't delete.

3. **Whether `CLAUDE.md` should be a pointer or a real file with Claude-specific guidance.** Some teams prefer CLAUDE.md to have Claude-specific stuff that AGENTS.md doesn't. I lean "pointer" for simplicity but it's a real call.

4. **My folder names might not be your preferred vocabulary.** "operations/" vs "ops/" vs "maintenance/", "plans/" vs "roadmaps/", etc. If you have preferences, now's the moment.

## Staged work, not one big push

This is a lot. Doing it all in one session would be exhausting and error-prone. I'd suggest staging:

**Stage 1 — Decide.** You react to the proposed structure. We refine it together. No file moves yet. (~30 min, conversational.)

**Stage 2 — High-impact consolidation.** Fix the AI rules problem first because it's actively harmful. Read all three files (AGENTS.md, AI_RULES.md, CLAUDE.md) carefully, identify contradictions, produce a single reconciled AGENTS.md and a thin CLAUDE.md pointer. (~1 session.)

**Stage 3 — Reorganize files into the new folder structure.** Mechanical moves, no content rewrites. (~1 session.)

**Stage 4 — Reconcile smoke test docs and fix stale references.** Read all four smoke-test docs, decide which is canonical, merge or delete the rest, fix the broken references. (~1 session.)

**Stage 5 — Write `docs/README.md` as the navigation index.** Last because it depends on the final structure being settled. (~30 min.)

**Stage 6 — Absorb the vertical-slice-schema.md decisions into content-registry-plan.md and AGENTS.md** (the work we already had queued from yesterday).

You don't have to commit to all of this right now. You don't even have to do it in this order. But here's what I'd ask before we touch anything:

1. Does the audit match what you intuited, or did I miss something / overdramatize something?
2. Does the proposed structure feel right? Push back on any folder name, any move, any deletion.
3. Of the staged work, which feels most urgent to you? My instinct says Stage 2 (the AI rules consolidation) because it's actively interfering with your tooling, but you might feel differently.
4. Do you want me to do this work alongside you, or do you want to do parts of it yourself with Claude Code (since the file moves and consolidations are the kind of mechanical work it handles well)?

Take your time. This is exactly the kind of moment where slowing down and getting the plan right pays off way more than rushing the cleanup.



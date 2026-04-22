# CLAUDE.md

The canonical coding-agent rules for this repo live in [`AGENTS.md`](./AGENTS.md). **Read that file first**, before this one and before any other doc.

This file exists as a pointer because Claude Code looks for `CLAUDE.md` at the repo root for orientation. The rules themselves are in `AGENTS.md` so that all coding agents (Claude Code, Codex, Cursor, etc.) work from the same source of truth.

If anything in this file appears to conflict with `AGENTS.md`, **`AGENTS.md` wins**. Update this file to match.

---

## Commands

- `npm run dev` — Start Vite dev server
- `npm run build` — Production build to `dist/`
- `npm run test` — Run Vitest in watch mode
- `npm run test:run` — Run Vitest once
- `npm run verify` — Run the full verification gate when available
- Playwright smoke tests may run in CI and must not be bypassed casually

---

## The Five Most Important Rules (Summary)

This is a quick-reference summary. The full rules and reasoning are in `AGENTS.md`.

1. **Do not break existing behavior.** Saved data, mobile layout, PWA behavior, backup/import/export, and existing UI contracts are non-negotiable. ([Prime Directive](./AGENTS.md#prime-directive))
2. **Hard bans are non-negotiable.** No frameworks, no TypeScript rewrite, no storage format changes without migration, no feature removal, no large CSS rewrites for cleanliness, no new modal frameworks, no duplicating canonical data. ([Hard Bans](./AGENTS.md#hard-bans))
3. **Scope discipline.** If a change is discovered mid-task to require touching more than ~3 files (or significantly more than the original plan), stop and explain before continuing. This is a circuit breaker for scope drift, not a planning constraint. ([Scope Discipline](./AGENTS.md#scope-discipline-circuit-breaker))
4. **SRD/Builder work has its own rules.** SRD 5.1 is the active source. SRD 5.2.1 is retired. Read `docs/reference/srd-licensing-notes.md`, `docs/reference/builder-scope-greenlist.md`, and `docs/reference/content-registry-plan.md` before any builder work. ([SRD / Builder Content Rules](./AGENTS.md#srd--builder-content-rules))
5. **Output format.** When reporting work, use the five-part structure: Executive summary / Exact files changed / What changed and why / Verification performed / Remaining risks or follow-ups. Be honest about anything not verified. ([Output Expectations](./AGENTS.md#output-expectations))

---

For everything else — architecture overview, character architecture, UI contracts, workspace rules, JavaScript/CSS/accessibility rules, state and persistence rules, testing expectations, and the full SRD content rules — see `AGENTS.md`.

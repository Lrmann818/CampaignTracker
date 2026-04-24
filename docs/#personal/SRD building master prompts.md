## SRD Building Prompts
  Best way to use these:

  * Start with the master audit prompt
  * If it says not safe to move on, feed the confirmed issues into the master patch prompt
  * Then do one more read-only verification audit
  * Only move to the next SRD file when it says the remaining items are optional
 
  That workflow fits the “source of truth, production-grade, trust it before moving on” standard really well.

# Audit Prompt
  A strict reusable master Codex audit prompt for any SRD registry file when your standard is “do not move on until this is trustworthy.”

# Prompt:
  You are performing a strict source-of-truth audit for a Lore Ledger SRD registry file.

  Goal:
  This file is intended to become a source-of-truth builder data file for a production character creator. Do not treat it like a draft seed. Audit it as if downstream derivation logic will trust it.

  Target file:
  - [REPLACE WITH FILE PATH]

  Project rules:
  - SRD 5.1 is the active source of truth
  - SRD 5.2.1 is reference/archive only
  - Builtin content must stay within approved SRD-safe scope
  - These SRD JSON files should be as complete, correct, and internally consistent as reasonably possible before we move on
  - Prefer official SRD-style terminology and labels where practical
  - Prefer structured data over fake/helper labels when the file’s schema already supports structured modeling
  - Do not leak subclass, feat, spell-list-only, or other cross-file content into the wrong base record
  - Be conservative and production-minded
  - Do not recommend broad speculative redesign unless it is directly relevant to correctness or source-of-truth reliability

  What to audit:
  1. Mechanical correctness against SRD 5.1
  2. Missing required progression tables or required structured fields
  3. Wrong levels, wrong counts, wrong granted options, wrong feature placement
  4. Internal consistency across records in the same file
  5. Schema consistency with the file’s existing established patterns
  6. Suspicious helper labels that should clearly be represented by structured fields already used elsewhere in the file
  7. Cross-record contamination
    - subclass content in base class/species/background files
    - feature content in the wrong record type
    - granted spell references that contradict project scope
  8. Explicitness/completeness
    - whether values that should be complete tables are sparse, inconsistent, or ambiguous
  9. Naming consistency
    - ids
    - feature names
    - enum-like string values
    - progression field names
  10. Builder risk
    - anything likely to cause incorrect derivation, overgranting, undergranting, or misleading UI

  How strict to be:
   - Confirmed correctness bugs should be called out clearly
   - Likely issues should be separated from confirmed ones
   - Minor style nits should not be mixed with real source-of-truth problems
   - If something is acceptable but imperfect, say so plainly
   - If the file is not safe to treat as source of truth yet, say so directly
 
  Important constraints:
   - Read-only audit only
   - Do not edit anything 
   - Do not assume the current file shape is correct just because it is present
   - Do not default to “good enough” language unless you can defend it
   - Do not suggest moving on if confirmed correctness bugs remain
   - Do not recommend future nice-to-have schema work unless it affects correctness, consistency, or builder safety

  Output format: 
   1. Executive summary
   2. Confirmed issues
   3. Likely issues needing human verification
   4. Consistency/schema issues
   5. Builder-risk issues
   6. Exact suggested fixes
   7. Safe to move on?
    - yes / no
    - with short reasoning
   8. Deferred but acceptable items
    - only include truly optional items that should not block progress

  Definition of “safe to move on”:
  A file is only safe to move on from if: 
   - no confirmed SRD 5.1 correctness bugs remain
   - no obvious missing required progression data remains
   - no cross-record contamination remains
   - no high-risk schema inconsistency remains that would likely break builder derivation
   - any remaining issues are genuinely optional polish rather than correctness or trust problems


# Patch Prompt
 master patch prompt you can reuse after an audit identifies concrete fixes

# Prompt:
You are patching a source-of-truth SRD registry file for Lore Ledger.

Goal:
This file is intended to become a source-of-truth builder data file for a production character creator. Patch it conservatively and correctly. Do not do speculative redesign. Do not leave known correctness bugs behind.

Target file:
- [REPLACE WITH FILE PATH]

Project rules:
- SRD 5.1 is the active source of truth
- SRD 5.2.1 is reference/archive only
- Builtin content must remain within approved SRD-safe scope
- These SRD JSON files should be as complete, correct, and internally consistent as reasonably possible before we move on
- Prefer official SRD-style terminology and labels where practical
- Prefer structured progression fields over fake/helper labels when the file already uses structured modeling patterns
- Do not leak subclass, feat, spell-list-only, or other cross-file content into the wrong record type
- Be conservative and production-minded

Task:
Patch the target file to resolve the confirmed issues from the prior audit.

Patch standard:
- Fix confirmed correctness bugs first
- Fix high-risk schema inconsistencies if they directly affect source-of-truth reliability
- Reuse existing file conventions wherever possible
- Do not invent new schema concepts unless absolutely necessary to correctly represent data that the file already clearly intends to model
- Do not perform broad cleanup unrelated to the confirmed issues
- Preserve formatting/style as much as possible

Required fixes:
- [PASTE CONFIRMED FIXES HERE]

Constraints:
- Do not patch unrelated records unless required for JSON validity, local consistency, or to fully resolve a confirmed issue
- Do not add optional future-facing schema enhancements unless they are necessary for correctness
- Do not rename unrelated fields
- Do not normalize unrelated style differences unless they block consistency or derivation safety
- If a suggested fix from the audit is ambiguous, choose the safest explicit representation and state the assumption clearly

After editing, return:
1. Executive summary
2. Exact changes made
3. Assumptions made
4. Anything intentionally not changed
5. Any remaining concerns that still need a verification pass
6. A short “ready for audit” note
